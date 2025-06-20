/**
 * Analytics Management Routes
 * Handles user analytics, usage tracking, reporting, and dashboard data
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError, sendNotFound } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createAnalyticsEventSchema = z.object({
  eventType: z.enum(['page_view', 'button_click', 'form_submit', 'api_call', 'document_upload', 'conversation_start', 'message_sent', 'agent_created', 'integration_test', 'search_query']),
  eventName: z.string().min(1, 'Event name is required'),
  properties: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

const createUsageRecordSchema = z.object({
  resourceType: z.enum(['api_calls', 'storage_usage', 'bandwidth', 'ai_tokens', 'documents', 'conversations', 'integrations']),
  amount: z.number().min(0, 'Amount must be non-negative'),
  unit: z.string().min(1, 'Unit is required'),
  metadata: z.record(z.any()).optional(),
  billingCycle: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

const dashboardQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  metrics: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  filters: z.record(z.any()).optional()
});

/**
 * Get user analytics dashboard data
 */
router.get('/analytics/dashboard', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const timeRange = req.query.timeRange as string || '7days';
    const metrics = req.query.metrics as string || 'all';
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '24hours':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get analytics data
    const [events, usage] = await Promise.all([
      storage.getAnalyticsEvents(userId, startDate, endDate),
      storage.getUsageRecords(userId, startDate, endDate)
    ]);
    
    // Process metrics
    const dashboardData = {
      timeRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      events: {
        total: events.length,
        byType: events.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timeline: events.map(event => ({
          timestamp: event.timestamp,
          eventType: event.eventType,
          eventName: event.eventName
        }))
      },
      usage: {
        total: usage.reduce((sum, record) => sum + record.amount, 0),
        byResource: usage.reduce((acc, record) => {
          acc[record.resourceType] = (acc[record.resourceType] || 0) + record.amount;
          return acc;
        }, {} as Record<string, number>),
        breakdown: usage.map(record => ({
          resourceType: record.resourceType,
          amount: record.amount,
          unit: record.unit,
          timestamp: record.timestamp
        }))
      }
    };
    return res.json(dashboardData);
    //sendSuccess(res, dashboardData, 'Analytics dashboard data retrieved successfully');
  } catch (error) {
    console.error('Error fetching analytics dashboard:', getErrorMessage(error));
    sendError(res, 'Failed to fetch analytics dashboard', 500);
  }
});

/**
 * Track analytics event
 */
router.post('/analytics/events', authenticateToken, async (req: any, res: Response) => {
  try {
    const validation = createAnalyticsEventSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid event data', 400, JSON.stringify(validation.error.errors));
    }
    
    const userId = req.user!.id;
    const eventData = {
      ...validation.data,
      userId: userId,
      timestamp: validation.data.timestamp ? new Date(validation.data.timestamp) : new Date(),
      userAgent: req.get('User-Agent') || undefined,
      ipAddress: req.ip || undefined
    };
    
    const event = await storage.createAnalyticsEvent(eventData);
    return res.json(event);
    //sendSuccess(res, event, 'Analytics event tracked successfully', 201);
  } catch (error) {
    console.error('Error tracking analytics event:', getErrorMessage(error));
    sendError(res, 'Failed to track analytics event', 500);
  }
});

/**
 * Get analytics events
 */
router.get('/analytics/events', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const eventType = req.query.eventType as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const events = await storage.getAnalyticsEvents(userId, startDate, endDate, eventType, page, limit);
    return res.json(events);
    //sendSuccess(res, events, 'Analytics events retrieved successfully');
  } catch (error) {
    console.error('Error fetching analytics events:', getErrorMessage(error));
    sendError(res, 'Failed to fetch analytics events', 500);
  }
});

/**
 * Record usage data
 */
router.post('/analytics/usage', authenticateToken, async (req: any, res: Response) => {
  try {
    const validation = createUsageRecordSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid usage data', 400, JSON.stringify(validation.error.errors));
    }
    
    const userId = req.user!.id;
    const usageData = {
      ...validation.data,
      userId: userId,
      timestamp: validation.data.timestamp ? new Date(validation.data.timestamp) : new Date()
    };
    
    const record = await storage.createUsageRecord(usageData);
    return res.json(record);
    //sendSuccess(res, record, 'Usage data recorded successfully', 201);
  } catch (error) {
    console.error('Error recording usage data:', getErrorMessage(error));
    sendError(res, 'Failed to record usage data', 500);
  }
});

/**
 * Get usage records
 */
router.get('/analytics/usage', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const resourceType = req.query.resourceType as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const records = await storage.getUsageRecords(userId, startDate, endDate, resourceType, page, limit);
    return res.json(records);
    //sendSuccess(res, records, 'Usage records retrieved successfully');
  } catch (error) {
    console.error('Error fetching usage records:', getErrorMessage(error));
    sendError(res, 'Failed to fetch usage records', 500);
  }
});

/**
 * Get usage summary
 */
router.get('/analytics/usage/summary', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const period = req.query.period as string || 'current_month';
    
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate = now;
    
    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const records = await storage.getUsageRecords(userId, startDate, endDate);
    
    // Calculate summary
    const summary = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalRecords: records.length,
      byResourceType: records.reduce((acc, record) => {
        if (!acc[record.resourceType]) {
          acc[record.resourceType] = {
            count: 0,
            totalAmount: 0,
            unit: record.unit
          };
        }
        acc[record.resourceType].count++;
        acc[record.resourceType].totalAmount += record.amount;
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number; unit: string }>),
      dailyTotals: records.reduce((acc, record) => {
        const date = record.timestamp.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, totalAmount: 0, recordCount: 0 };
        }
        acc[date].totalAmount += record.amount;
        acc[date].recordCount++;
        return acc;
      }, {} as Record<string, { date: string; totalAmount: number; recordCount: number }>)
    };
    return res.json(summary);
    //sendSuccess(res, summary, 'Usage summary retrieved successfully');
  } catch (error) {
    console.error('Error fetching usage summary:', getErrorMessage(error));
    sendError(res, 'Failed to fetch usage summary', 500);
  }
});

/**
 * Get analytics reports
 */
router.post('/analytics/reports', authenticateToken, async (req: any, res: Response) => {
  try {
    const validation = dashboardQuerySchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid report query', 400, JSON.stringify(validation.error.errors));
    }
    
    const userId = req.user!.id;
    const { startDate, endDate, metrics, groupBy, filters } = validation.data;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get data for the specified period
    const [events, usage] = await Promise.all([
      storage.getAnalyticsEvents(userId, start, end),
      storage.getUsageRecords(userId, start, end)
    ]);
    
    // Apply filters if provided
    let filteredEvents = events;
    let filteredUsage = usage;
    
    if (filters) {
      if (filters.eventType) {
        filteredEvents = events.filter(event => event.eventType === filters.eventType);
      }
      if (filters.resourceType) {
        filteredUsage = usage.filter(record => record.resourceType === filters.resourceType);
      }
    }
    
    // Group data by specified period
    const groupEvents = (events: any[], groupBy: string) => {
      return events.reduce((acc, event) => {
        let key: string;
        const date = new Date(event.timestamp);
        
        switch (groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }
        
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(event);
        return acc;
      }, {} as Record<string, any[]>);
    };
    
    const groupUsage = (records: any[], groupBy: string) => {
      return records.reduce((acc, record) => {
        let key: string;
        const date = new Date(record.timestamp);
        
        switch (groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }
        
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(record);
        return acc;
      }, {} as Record<string, any[]>);
    };
    
    const report = {
      query: { startDate, endDate, metrics, groupBy, filters },
      summary: {
        totalEvents: filteredEvents.length,
        totalUsage: filteredUsage.reduce((sum, record) => sum + record.amount, 0),
        uniqueEventTypes: new Set(filteredEvents.map(e => e.eventType)).size,
        uniqueResourceTypes: new Set(filteredUsage.map(r => r.resourceType)).size
      },
      groupedData: groupBy ? {
        events: groupEvents(filteredEvents, groupBy),
        usage: groupUsage(filteredUsage, groupBy)
      } : null,
      eventBreakdown: filteredEvents.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      usageBreakdown: filteredUsage.reduce((acc, record) => {
        if (!acc[record.resourceType]) {
          acc[record.resourceType] = { count: 0, total: 0, unit: record.unit };
        }
        acc[record.resourceType].count++;
        acc[record.resourceType].total += record.amount;
        return acc;
      }, {} as Record<string, { count: number; total: number; unit: string }>)
    };
    return res.json(report);
    //sendSuccess(res, report, 'Analytics report generated successfully');
  } catch (error) {
    console.error('Error generating analytics report:', getErrorMessage(error));
    sendError(res, 'Failed to generate analytics report', 500);
  }
});

/**
 * Delete analytics data (GDPR compliance)
 */
router.delete('/analytics/data', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const dataType = req.query.dataType as string || 'all';
    const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate as string) : undefined;
    
    let deletedCount = 0;
    
    if (dataType === 'all' || dataType === 'events') {
      const eventsDeleted = await storage.deleteAnalyticsEvents(userId, beforeDate);
      deletedCount += eventsDeleted;
    }
    
    if (dataType === 'all' || dataType === 'usage') {
      const usageDeleted = await storage.deleteUsageRecords(userId, beforeDate);
      deletedCount += usageDeleted;
    }
    
    sendSuccess(res, { deletedCount, dataType, beforeDate }, 'Analytics data deleted successfully');
  } catch (error) {
    console.error('Error deleting analytics data:', getErrorMessage(error));
    sendError(res, 'Failed to delete analytics data', 500);
  }
});

/**
 * Get analytics data export
 */
router.get('/analytics/export', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const format = req.query.format as string || 'json';
    const dataType = req.query.dataType as string || 'all';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const exportData: any = {
      exportDate: new Date().toISOString(),
      userId: userId,
      dateRange: { startDate, endDate },
      format,
      dataType
    };
    
    if (dataType === 'all' || dataType === 'events') {
      exportData.events = await storage.getAnalyticsEvents(userId, startDate, endDate);
    }
    
    if (dataType === 'all' || dataType === 'usage') {
      exportData.usage = await storage.getUsageRecords(userId, startDate, endDate);
    }
    
    if (format === 'csv') {
      // For CSV format, we'd typically convert to CSV string
      // For now, return JSON with indication that CSV conversion would happen
      exportData._note = 'CSV conversion would be implemented here in production';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.json"`);
    }
    return res.json(exportData);
    //sendSuccess(res, exportData, 'Analytics data exported successfully');
  } catch (error) {
    console.error('Error exporting analytics data:', getErrorMessage(error));
    sendError(res, 'Failed to export analytics data', 500);
  }
});

export default router;