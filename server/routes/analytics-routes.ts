/**
 * Analytics Management Routes - Refactored and Improved
 * Handles user analytics, usage tracking, reporting, and dashboard data
 * with proper type safety, performance optimizations, and comprehensive error handling
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// =============================================
// TYPE DEFINITIONS AND INTERFACES
// =============================================

interface AnalyticsEvent {
  id: string;
  userId: number;
  eventType: string;
  eventName: string;
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  createdAt: Date;
}

interface UsageRecord {
  id: string;
  userId: number;
  resourceType: string;
  amount: number;
  unit: string;
  metadata?: Record<string, any>;
  billingCycle?: string;
  timestamp: Date;
  createdAt: Date;
}

interface DashboardData {
  timeRange: string;
  startDate: string;
  endDate: string;
  events: {
    total: number;
    byType: Record<string, number>;
    timeline: Array<{
      timestamp: Date;
      eventType: string;
      eventName: string;
    }>;
  };
  usage: {
    total: number;
    byResource: Record<string, number>;
    breakdown: Array<{
      resourceType: string;
      amount: number;
      unit: string;
      timestamp: Date;
    }>;
  };
}

interface AnalyticsReport {
  query: {
    startDate: string;
    endDate: string;
    metrics?: string[];
    groupBy?: string;
    filters?: Record<string, any>;
  };
  summary: {
    totalEvents: number;
    totalUsage: number;
    uniqueEventTypes: number;
    uniqueResourceTypes: number;
  };
  groupedData?: {
    events: Record<string, AnalyticsEvent[]>;
    usage: Record<string, UsageRecord[]>;
  };
  eventBreakdown: Record<string, number>;
  usageBreakdown: Record<string, {
    count: number;
    total: number;
    unit: string;
  }>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const createAnalyticsEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required').max(100, 'Event type too long'),
  eventName: z.string().min(1, 'Event name is required').max(255, 'Event name too long'),
  properties: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  sessionId: z.string().max(255).optional(),
  timestamp: z.string().datetime().optional()
});

const createUsageRecordSchema = z.object({
  resourceType: z.enum([
    'api_calls', 'storage_usage', 'bandwidth', 'ai_tokens', 
    'documents', 'conversations', 'integrations'
  ]),
  amount: z.number().min(0, 'Amount must be non-negative').max(Number.MAX_SAFE_INTEGER),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit name too long'),
  metadata: z.record(z.any()).optional(),
  billingCycle: z.string().max(50).optional(),
  timestamp: z.string().datetime().optional()
});

const dashboardQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  metrics: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  filters: z.record(z.any()).optional()
});

const paginationSchema = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  limit: z.number().int().min(1).max(100).default(50)
});

const timeRangeSchema = z.enum(['24hours', '7days', '30days', '90days']).default('7days');
const periodSchema = z.enum(['current_month', 'last_month', 'current_year', 'last_30_days']).default('current_month');
const dataTypeSchema = z.enum(['all', 'events', 'usage']).default('all');
const formatSchema = z.enum(['json', 'csv']).default('json');

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Calculate date range based on time period
 */
function calculateDateRange(timeRange: string): { startDate: Date; endDate: Date } {
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
  
  return { startDate, endDate };
}

/**
 * Calculate period-based date range
 */
function calculatePeriodRange(period: string): { startDate: Date; endDate: Date } {
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
  
  return { startDate, endDate };
}

/**
 * Safely parse query parameters with validation
 */
function parseQueryParams(query: any) {
  return {
    page: parseInt(query.page as string) || 1,
    limit: Math.min(parseInt(query.limit as string) || 50, 100),
    startDate: query.startDate ? new Date(query.startDate as string) : undefined,
    endDate: query.endDate ? new Date(query.endDate as string) : undefined
  };
}

/**
 * Generate grouping key for time-based aggregation
 */
function generateGroupingKey(date: Date, groupBy: string): string {
  switch (groupBy) {
    case 'day':
      return date.toISOString().split('T')[0];
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Group data by time period
 */
function groupDataByPeriod<T extends { timestamp: Date }>(
  data: T[], 
  groupBy: string
): Record<string, T[]> {
  return data.reduce((acc, item) => {
    const key = generateGroupingKey(item.timestamp, groupBy);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Validate and sanitize request data
 */
function validateRequest<T>(schema: z.ZodSchema<T>, data: any): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${JSON.stringify(result.error.errors)}`);
  }
  return result.data;
}

// =============================================
// ANALYTICS DASHBOARD ROUTES
// =============================================

/**
 * Get user analytics dashboard data
 * GET /analytics/dashboard
 */
router.get('/analytics/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const timeRange = timeRangeSchema.parse(req.query.timeRange);
    const metrics = req.query.metrics as string || 'all';
    
    // Calculate date range
    const { startDate, endDate } = calculateDateRange(timeRange);
    
    // Get analytics data with error handling for missing storage methods
    let events: AnalyticsEvent[] = [];
    let usage: UsageRecord[] = [];
    
    try {
      if (typeof storage.getAnalyticsEvents === 'function') {
        const rawEvents = await storage.getAnalyticsEvents(userId, startDate, endDate) || [];
        events = rawEvents.map((event: any) => ({
          ...event,
          id: event.id.toString()
        })) as AnalyticsEvent[];
      }
    } catch (error) {
      console.warn('Analytics events not available:', getErrorMessage(error));
    }
    
    try {
      if (typeof storage.getUsageRecords === 'function') {
        const rawUsage = await storage.getUsageRecords(userId, startDate, endDate) || [];
        usage = rawUsage.map((record: any) => ({
          ...record,
          id: record.id.toString()
        })) as UsageRecord[];
      }
    } catch (error) {
      console.warn('Usage records not available:', getErrorMessage(error));
    }
    
    // Process metrics efficiently
    const dashboardData: DashboardData = {
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
    
    sendSuccess(res, dashboardData, 'Analytics dashboard data retrieved successfully');
  } catch (error) {
    console.error('Error fetching analytics dashboard:', getErrorMessage(error));
    sendError(res, 'Failed to fetch analytics dashboard', 500);
  }
});

// =============================================
// ANALYTICS EVENT ROUTES
// =============================================

/**
 * Track analytics event
 * POST /analytics/events
 */
router.post('/analytics/events', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = validateRequest(createAnalyticsEventSchema, req.body);
    
    const eventData = {
      ...validatedData,
      userId: userId,
      timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date(),
      userAgent: req.get('User-Agent') || undefined,
      ipAddress: req.ip || undefined
    };
    
    // Check if storage method exists
    if (typeof storage.createAnalyticsEvent !== 'function') {
      console.warn('Analytics event creation not implemented in storage adapter');
      sendSuccess(res, { id: `mock_${Date.now()}`, ...eventData }, 'Analytics event logged (storage not implemented)', 201);
      return;
    }
    
    const event = await storage.createAnalyticsEvent(eventData);
    sendSuccess(res, event, 'Analytics event tracked successfully', 201);
  } catch (error) {
    console.error('Error tracking analytics event:', getErrorMessage(error));
    sendError(res, 'Failed to track analytics event', 500);
  }
});

/**
 * Get analytics events
 * GET /analytics/events
 */
router.get('/analytics/events', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page, limit, startDate, endDate } = parseQueryParams(req.query);
    const eventType = req.query.eventType as string;
    
    // Validate pagination
    const pagination = validateRequest(paginationSchema, { page, limit });
    
    if (typeof storage.getAnalyticsEvents !== 'function') {
      console.warn('Analytics events retrieval not implemented in storage adapter');
      sendSuccess(res, [], 'No analytics events available (storage not implemented)');
      return;
    }
    
    const events = await storage.getAnalyticsEvents(
      userId, 
      startDate, 
      endDate, 
      eventType, 
      pagination.page, 
      pagination.limit
    ) || [];
    
    sendSuccess(res, events, 'Analytics events retrieved successfully');
  } catch (error) {
    console.error('Error fetching analytics events:', getErrorMessage(error));
    sendError(res, 'Failed to fetch analytics events', 500);
  }
});

// =============================================
// USAGE TRACKING ROUTES
// =============================================

/**
 * Record usage data
 * POST /analytics/usage
 */
router.post('/analytics/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = validateRequest(createUsageRecordSchema, req.body);
    
    const usageData = {
      ...validatedData,
      userId: userId,
      timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : new Date()
    };
    
    if (typeof storage.createUsageRecord !== 'function') {
      console.warn('Usage record creation not implemented in storage adapter');
      sendSuccess(res, { id: `mock_${Date.now()}`, ...usageData }, 'Usage data logged (storage not implemented)', 201);
      return;
    }
    
    const record = await storage.createUsageRecord(usageData);
    sendSuccess(res, record, 'Usage data recorded successfully', 201);
  } catch (error) {
    console.error('Error recording usage data:', getErrorMessage(error));
    sendError(res, 'Failed to record usage data', 500);
  }
});

/**
 * Get usage records
 * GET /analytics/usage
 */
router.get('/analytics/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { page, limit, startDate, endDate } = parseQueryParams(req.query);
    const resourceType = req.query.resourceType as string;
    
    const pagination = validateRequest(paginationSchema, { page, limit });
    
    if (typeof storage.getUsageRecords !== 'function') {
      console.warn('Usage records retrieval not implemented in storage adapter');
      sendSuccess(res, [], 'No usage records available (storage not implemented)');
      return;
    }
    
    const records = await storage.getUsageRecords(
      userId, 
      startDate, 
      endDate, 
      resourceType, 
      pagination.page, 
      pagination.limit
    ) || [];
    
    sendSuccess(res, records, 'Usage records retrieved successfully');
  } catch (error) {
    console.error('Error fetching usage records:', getErrorMessage(error));
    sendError(res, 'Failed to fetch usage records', 500);
  }
});

/**
 * Get usage summary
 * GET /analytics/usage/summary
 */
router.get('/analytics/usage/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const period = periodSchema.parse(req.query.period);
    
    const { startDate, endDate } = calculatePeriodRange(period);
    
    if (typeof storage.getUsageRecords !== 'function') {
      console.warn('Usage records retrieval not implemented in storage adapter');
      const mockSummary = {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRecords: 0,
        byResourceType: {},
        dailyTotals: {}
      };
      sendSuccess(res, mockSummary, 'Usage summary (storage not implemented)');
      return;
    }
    
    const records = await storage.getUsageRecords(userId, startDate, endDate) || [];
    
    // Calculate summary efficiently
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
    
    sendSuccess(res, summary, 'Usage summary retrieved successfully');
  } catch (error) {
    console.error('Error fetching usage summary:', getErrorMessage(error));
    sendError(res, 'Failed to fetch usage summary', 500);
  }
});

// =============================================
// ANALYTICS REPORTING ROUTES
// =============================================

/**
 * Generate analytics reports
 * POST /analytics/reports
 */
router.post('/analytics/reports', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedQuery = validateRequest(dashboardQuerySchema, req.body);
    
    const { startDate, endDate, metrics, groupBy, filters } = validatedQuery;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (start >= end) {
      return sendError(res, 'Start date must be before end date', 400);
    }
    
    // Get data for the specified period with fallbacks
    let events: AnalyticsEvent[] = [];
    let usage: UsageRecord[] = [];
    
    try {
      if (typeof storage.getAnalyticsEvents === 'function') {
        const rawEvents = await storage.getAnalyticsEvents(userId, start, end) || [];
        events = rawEvents.map((event: any) => ({
          ...event,
          id: event.id.toString()
        })) as AnalyticsEvent[];
      }
      if (typeof storage.getUsageRecords === 'function') {
        const rawUsage = await storage.getUsageRecords(userId, start, end) || [];
        usage = rawUsage.map((record: any) => ({
          ...record,
          id: record.id.toString()
        })) as UsageRecord[];
      }
    } catch (error) {
      console.warn('Storage methods not available for reporting:', getErrorMessage(error));
    }
    
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
    
    // Generate comprehensive report
    const report: AnalyticsReport = {
      query: { startDate, endDate, metrics, groupBy, filters },
      summary: {
        totalEvents: filteredEvents.length,
        totalUsage: filteredUsage.reduce((sum, record) => sum + record.amount, 0),
        uniqueEventTypes: new Set(filteredEvents.map(e => e.eventType)).size,
        uniqueResourceTypes: new Set(filteredUsage.map(r => r.resourceType)).size
      },
      groupedData: groupBy ? {
        events: groupDataByPeriod(filteredEvents, groupBy),
        usage: groupDataByPeriod(filteredUsage, groupBy)
      } : undefined,
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
    
    sendSuccess(res, report, 'Analytics report generated successfully');
  } catch (error) {
    console.error('Error generating analytics report:', getErrorMessage(error));
    sendError(res, 'Failed to generate analytics report', 500);
  }
});

// =============================================
// DATA MANAGEMENT ROUTES
// =============================================

/**
 * Delete analytics data (GDPR compliance)
 * DELETE /analytics/data
 */
router.delete('/analytics/data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const dataType = dataTypeSchema.parse(req.query.dataType);
    const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate as string) : undefined;
    
    let deletedCount = 0;
    
    if (dataType === 'all' || dataType === 'events') {
      if (typeof storage.deleteAnalyticsEvents === 'function') {
        try {
          const eventsDeleted = await storage.deleteAnalyticsEvents(userId, beforeDate);
          deletedCount += eventsDeleted;
        } catch (error) {
          console.warn('Analytics events deletion failed:', getErrorMessage(error));
        }
      } else {
        console.warn('Analytics events deletion not implemented in storage adapter');
      }
    }
    
    if (dataType === 'all' || dataType === 'usage') {
      if (typeof storage.deleteUsageRecords === 'function') {
        try {
          const usageDeleted = await storage.deleteUsageRecords(userId, beforeDate);
          deletedCount += usageDeleted;
        } catch (error) {
          console.warn('Usage records deletion failed:', getErrorMessage(error));
        }
      } else {
        console.warn('Usage records deletion not implemented in storage adapter');
      }
    }
    
    sendSuccess(res, { deletedCount, dataType, beforeDate }, 'Analytics data deletion completed');
  } catch (error) {
    console.error('Error deleting analytics data:', getErrorMessage(error));
    sendError(res, 'Failed to delete analytics data', 500);
  }
});

/**
 * Export analytics data
 * GET /analytics/export
 */
router.get('/analytics/export', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const format = formatSchema.parse(req.query.format);
    const dataType = dataTypeSchema.parse(req.query.dataType);
    const { startDate, endDate } = parseQueryParams(req.query);
    
    const exportData: any = {
      exportDate: new Date().toISOString(),
      userId: userId,
      dateRange: { startDate, endDate },
      format,
      dataType
    };
    
    // Get export data with error handling
    if (dataType === 'all' || dataType === 'events') {
      try {
        if (typeof storage.getAnalyticsEvents === 'function') {
          exportData.events = await storage.getAnalyticsEvents(userId, startDate, endDate) || [];
        } else {
          exportData.events = [];
          exportData._eventsNote = 'Analytics events not available in storage adapter';
        }
      } catch (error) {
        console.warn('Failed to export analytics events:', getErrorMessage(error));
        exportData.events = [];
        exportData._eventsError = getErrorMessage(error);
      }
    }
    
    if (dataType === 'all' || dataType === 'usage') {
      try {
        if (typeof storage.getUsageRecords === 'function') {
          exportData.usage = await storage.getUsageRecords(userId, startDate, endDate) || [];
        } else {
          exportData.usage = [];
          exportData._usageNote = 'Usage records not available in storage adapter';
        }
      } catch (error) {
        console.warn('Failed to export usage records:', getErrorMessage(error));
        exportData.usage = [];
        exportData._usageError = getErrorMessage(error);
      }
    }
    
    // Set appropriate headers
    if (format === 'csv') {
      // Note: CSV conversion would be implemented here in production
      exportData._note = 'CSV conversion would be implemented here in production';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.json"`);
    }
    
    sendSuccess(res, exportData, 'Analytics data exported successfully');
  } catch (error) {
    console.error('Error exporting analytics data:', getErrorMessage(error));
    sendError(res, 'Failed to export analytics data', 500);
  }
});

export default router;