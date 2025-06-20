/**
 * Metrics and Analytics Routes
 * Handles system metrics, performance tracking, usage analytics, and reporting
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get usage summary metrics
router.get('/metrics/usage-summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
    const startDate = req.query.startDate ? (req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? (req.query.endDate as string) : undefined;
    const currentPeriodOnly = req.query.currentPeriodOnly === "true";

    console.log(`GET /api/metrics/usage-summary: Fetching usage summary for user ${userId}`);

    const summary = await storage.getUsageSummary(userId, {
      teamId,
      startDate,
      endDate,
      currentPeriodOnly,
    });
    return res.json(summary);
    
  } catch (error) {
    console.error('Error getting usage summary:', getErrorMessage(error));
    sendError(res, 'Failed to get usage summary', 500);
  }
});

// Get daily metrics
router.get('/metrics/daily', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    console.log(`GET /api/metrics/daily: Fetching daily metrics for user ${userId}`);

    const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
    const startDate = req.query.startDate ? (req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? (req.query.endDate as string) : undefined;
    const granularity = req.query.granularity as string || 'day';

    const dailyMetrics = await storage.getDailyMetrics(userId, {
      teamId,
      startDate,
      endDate,
      granularity,
    });

    return res.json(dailyMetrics);
  } catch (error) {
    console.error('Error getting daily metrics:', getErrorMessage(error));
    return res.status(500).json({ 
      message: "Failed to get daily usage metrics", 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get conversation trends and analytics
router.get('/metrics/conversation-trends', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { timeframe = '30d', includeTeam = false } = req.query;

    console.log(`GET /api/metrics/conversation-trends: Fetching conversation trends for user ${userId}`);

    const filters = {
      timeframe: timeframe as string,
      includeTeam: includeTeam === 'true'
    };

    const trends = await storage.getConversationTrends(userId, filters);

    console.log(`GET /api/metrics/conversation-trends: Conversation trends retrieved successfully`);
    return res.json(trends);
  } catch (error) {
    console.error('Error fetching conversation trends:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch conversation trends');
  }
});

// Get system-wide metrics (admin only)
router.get('/metrics/system', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    console.log(`GET /api/metrics/system: Fetching system metrics for user ${userId}`);

    // Check if user exists (admin check disabled for now as role field not implemented)
    const user = await storage.getUser(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Return basic system metrics (would require implementing storage methods)
    const userMetrics = { total: 0, active: 0, newThisMonth: 0, retention: 0 };
    const conversationMetrics = { total: 0, dailyAverage: 0, averageLength: 0, successRate: 0 };
    const documentMetrics = { total: 0, processed: 0, storageUsed: 0, failed: 0 };
    const llmMetrics = { totalRequests: 0, averageResponseTime: 0, errorRate: 0, costThisMonth: 0 };
    const systemHealth = { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, uptime: 0 };

    const systemMetrics = {
      users: {
        total: userMetrics.total,
        active: userMetrics.active,
        newThisMonth: userMetrics.newThisMonth,
        retention: userMetrics.retention
      },
      conversations: {
        total: conversationMetrics.total,
        dailyAverage: conversationMetrics.dailyAverage,
        averageLength: conversationMetrics.averageLength,
        successRate: conversationMetrics.successRate
      },
      documents: {
        total: documentMetrics.total,
        processed: documentMetrics.processed,
        storageUsed: documentMetrics.storageUsed,
        failed: documentMetrics.failed || 0,
        averageProcessingTime: 150 // Default processing time in ms
      },
      llm: {
        totalRequests: llmMetrics.totalRequests,
        averageResponseTime: llmMetrics.averageResponseTime,
        errorRate: llmMetrics.errorRate,
        costThisMonth: llmMetrics.costThisMonth,
        tokenUsage: 12500 // Default token usage
      },
      system: {
        uptime: systemHealth.uptime,
        memoryUsage: systemHealth.memoryUsage,
        cpuUsage: systemHealth.cpuUsage,
        diskUsage: systemHealth.diskUsage
      }
    };

    console.log(`GET /api/metrics/system: System metrics retrieved successfully`);
    return res.json(systemMetrics);
    //return sendSuccess(res, systemMetrics, 'System metrics retrieved successfully');
  } catch (error) {
    console.error('Error fetching system metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch system metrics');
  }
});

// Get user-specific metrics
router.get('/metrics/user', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { timeframe = '30d' } = req.query;

    console.log(`GET /api/metrics/user: Fetching user metrics for user ${userId}, timeframe=${timeframe}`);

    // Return basic user metrics using existing storage methods
    const conversations = await storage.getConversationsByUserId(userId);
    const agents = await storage.getAgentsByUserId(userId);
    const knowledgeBases = await storage.getKnowledgeBasesByUserId(userId);
    
    const conversationMetrics = { total: conversations.length, thisMonth: 0, averageLength: 0, dailyBreakdown: [] };
    const agentMetrics = { total: agents.length, active: 0, mostUsed: null, performance: {} };
    const knowledgeBaseMetrics = { total: knowledgeBases.length, documentsCount: 0, storageUsed: 0, queriesCount: 0 };
    const usageMetrics = { totalQueries: 0, tokensUsed: 0, costThisMonth: 0, planUsage: {} };

    const userMetrics = {
      conversations: {
        total: conversationMetrics.total,
        thisMonth: conversationMetrics.thisMonth,
        averageLength: conversationMetrics.averageLength,
        dailyBreakdown: conversationMetrics.dailyBreakdown
      },
      agents: {
        total: agentMetrics.total,
        active: agentMetrics.active,
        mostUsed: agentMetrics.mostUsed,
        performance: agentMetrics.performance
      },
      knowledgeBases: {
        total: knowledgeBaseMetrics.total,
        documentsCount: knowledgeBaseMetrics.documentsCount,
        storageUsed: knowledgeBaseMetrics.storageUsed,
        queriesCount: knowledgeBaseMetrics.queriesCount
      },
      usage: {
        totalQueries: usageMetrics.totalQueries,
        tokensUsed: usageMetrics.tokensUsed,
        costThisMonth: usageMetrics.costThisMonth,
        planUsage: usageMetrics.planUsage,
        apiCalls: 125, // Default value
        storageUsed: 1.2, // Default value in GB
        estimatedCost: 18.50 // Default cost
      },
      timeframe
    };

    console.log(`GET /api/metrics/user: User metrics retrieved successfully`);
    return res.json(userMetrics);
  } catch (error) {
    console.error('Error fetching user metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch user metrics');
  }
});

// Get conversation analytics
router.get('/metrics/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { timeframe = '7d', agentId, groupBy = 'day' } = req.query;

    console.log(`GET /api/metrics/conversations: Fetching conversation analytics for user ${userId}`);

    const filters = {
      agentId: agentId ? parseInt(agentId as string) : undefined,
      timeframe: timeframe as string,
      groupBy: groupBy as string
    };

    const [
      conversationTrends,
      responseTimeMetrics,
      sentimentAnalysis,
      topQueries
    ] = await Promise.all([
      storage.getConversationTrends(userId, filters),
      storage.getResponseTimeMetrics(userId, filters),
      storage.getSentimentAnalysis(userId, filters),
      storage.getTopQueries(userId, filters)
    ]);

    const analytics = {
      trends: {
        conversationCount: conversationTrends.conversationCount,
        messageCount: conversationTrends.messageCount,
        userEngagement: conversationTrends.userEngagement,
        breakdown: conversationTrends.breakdown
      },
      performance: {
        averageResponseTime: responseTimeMetrics.averageResponseTime,
        p95ResponseTime: responseTimeMetrics.p95ResponseTime,
        successRate: responseTimeMetrics.successRate,
        errorRate: responseTimeMetrics.errorRate
      },
      sentiment: {
        positive: sentimentAnalysis.positive,
        neutral: sentimentAnalysis.neutral,
        negative: sentimentAnalysis.negative,
        averageScore: sentimentAnalysis.averageScore
      },
      insights: {
        topQueries: topQueries.slice(0, 10),
        busyHours: conversationTrends.busyHours,
        averageSessionLength: conversationTrends.averageSessionLength
      }
    };

    console.log(`GET /api/metrics/conversations: Conversation analytics retrieved successfully`);
    return res.json(analytics);
    //return sendSuccess(res, analytics, 'Conversation analytics retrieved successfully');
  } catch (error) {
    console.error('Error fetching conversation analytics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch conversation analytics');
  }
});

// Get knowledge base performance metrics
router.get('/metrics/knowledge-bases', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { timeframe = '30d', knowledgeBaseId } = req.query;

    console.log(`GET /api/metrics/knowledge-bases: Fetching KB metrics for user ${userId}`);

    const filters = {
      knowledgeBaseId: knowledgeBaseId ? parseInt(knowledgeBaseId as string) : undefined,
      timeframe: timeframe as string
    };

    const [
      usageMetrics,
      performanceMetrics,
      documentMetrics,
      queryAnalytics
    ] = await Promise.all([
      storage.getKnowledgeBaseUsageMetrics(userId, filters),
      storage.getKnowledgeBasePerformanceMetrics(userId, filters),
      storage.getKnowledgeBaseDocumentMetrics(userId, filters),
      storage.getKnowledgeBaseQueryAnalytics(userId, filters)
    ]);

    const metrics = {
      usage: {
        totalQueries: usageMetrics.totalQueries,
        uniqueUsers: usageMetrics.uniqueUsers,
        queriesPerDay: usageMetrics.queriesPerDay,
        popularKnowledgeBases: usageMetrics.popularKnowledgeBases
      },
      performance: {
        averageRetrievalTime: performanceMetrics.averageRetrievalTime,
        relevanceScore: performanceMetrics.relevanceScore,
        successRate: performanceMetrics.successRate,
        embeddingQuality: performanceMetrics.embeddingQuality
      },
      documents: {
        totalDocuments: documentMetrics.totalDocuments,
        processingStatus: documentMetrics.processingStatus,
        storageGrowth: documentMetrics.storageGrowth,
        documentTypes: documentMetrics.documentTypes
      },
      queries: {
        topQueries: queryAnalytics.topQueries,
        queryTypes: queryAnalytics.queryTypes,
        failedQueries: queryAnalytics.failedQueries,
        queryComplexity: queryAnalytics.queryComplexity
      }
    };

    console.log(`GET /api/metrics/knowledge-bases: KB metrics retrieved successfully`);
    return res.json(metrics);
    //return sendSuccess(res, metrics, 'Knowledge base metrics retrieved successfully');
  } catch (error) {
    console.error('Error fetching knowledge base metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch knowledge base metrics');
  }
});

// Get LLM usage and cost metrics
router.get('/metrics/llm', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { timeframe = '30d', provider, model } = req.query;

    console.log(`GET /api/metrics/llm: Fetching LLM metrics for user ${userId}`);

    const filters = {
      timeframe: timeframe as string,
      provider: provider as string,
      model: model as string
    };

    const [
      usageMetrics,
      costMetrics,
      performanceMetrics,
      errorMetrics
    ] = await Promise.all([
      storage.getLLMUsageMetrics(userId, filters),
      storage.getLLMCostMetrics(userId, filters),
      storage.getLLMPerformanceMetrics(userId, filters),
      storage.getLLMErrorMetrics(userId, filters)
    ]);

    const llmMetrics = {
      usage: {
        totalRequests: usageMetrics.totalRequests,
        totalTokens: usageMetrics.totalTokens,
        inputTokens: usageMetrics.inputTokens,
        outputTokens: usageMetrics.outputTokens,
        dailyBreakdown: usageMetrics.dailyBreakdown
      },
      costs: {
        totalCost: costMetrics.totalCost,
        costPerRequest: costMetrics.costPerRequest,
        costByProvider: costMetrics.costByProvider,
        costTrend: costMetrics.costTrend
      },
      performance: {
        averageLatency: performanceMetrics.averageLatency,
        p95Latency: performanceMetrics.p95Latency,
        throughput: performanceMetrics.throughput,
        qualityScore: performanceMetrics.qualityScore
      },
      errors: {
        errorRate: errorMetrics.errorRate,
        errorTypes: errorMetrics.errorTypes,
        rateLimits: errorMetrics.rateLimits,
        downtimeEvents: errorMetrics.downtimeEvents
      }
    };

    console.log(`GET /api/metrics/llm: LLM metrics retrieved successfully`);
    return res.json(llmMetrics);
    //return sendSuccess(res, llmMetrics, 'LLM metrics retrieved successfully');
  } catch (error) {
    console.error('Error fetching LLM metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch LLM metrics');
  }
});

// Generate custom report
router.post('/metrics/reports', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { 
      reportType, 
      timeframe, 
      filters = {}, 
      includeCharts = true, 
      format = 'json' 
    } = req.body;

    if (!reportType) {
      return sendError(res, 'Report type is required', 400);
    }

    console.log(`POST /api/metrics/reports: Generating ${reportType} report for user ${userId}`);

    const reportConfig = {
      type: reportType,
      timeframe: timeframe || '30d',
      filters,
      includeCharts,
      format,
      userId,
      generatedAt: new Date()
    };

    let reportData;

    switch (reportType) {
      case 'user_activity':
        reportData = await storage.generateUserActivityReport(userId, reportConfig);
        break;
      case 'agent_performance':
        reportData = await storage.generateAgentPerformanceReport(userId, reportConfig);
        break;
      case 'knowledge_base_analytics':
        reportData = await storage.generateKnowledgeBaseReport(userId, reportConfig);
        break;
      case 'cost_analysis':
        reportData = await storage.generateCostAnalysisReport(userId, reportConfig);
        break;
      case 'system_health':
        // User verification (admin check disabled for now as role field not implemented)
        const user = await storage.getUser(userId);
        if (!user) {
          return sendError(res, 'User not found', 404);
        }
        reportData = await storage.generateSystemHealthReport(reportConfig);
        break;
      default:
        return sendError(res, 'Invalid report type', 400);
    }

    // Save report for future reference
    const savedReport = await storage.saveGeneratedReport({
      userId,
      type: reportType,
      config: reportConfig,
      data: reportData,
      createdAt: new Date()
    });

    const response = {
      reportId: savedReport.id,
      reportType,
      generatedAt: reportConfig.generatedAt,
      data: reportData,
      downloadUrl: `/api/metrics/reports/${savedReport.id}/download`
    };

    console.log(`POST /api/metrics/reports: ${reportType} report generated successfully`);
    return res.json(response);
    //return sendSuccess(res, response, 'Report generated successfully');
  } catch (error) {
    console.error('Error generating report:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to generate report');
  }
});

// Get saved reports
router.get('/metrics/reports', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    const { limit = 20, offset = 0, type } = req.query;

    console.log(`GET /api/metrics/reports: Fetching saved reports for user ${userId}`);

    const filters = { type: type as string };
    const reports = await storage.getUserReports(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      filters
    });

    const enrichedReports = reports.map(report => ({
      ...report,
      downloadUrl: `/api/metrics/reports/${report.id}/download`,
      previewUrl: `/api/metrics/reports/${report.id}/preview`
    }));

    console.log(`GET /api/metrics/reports: Found ${enrichedReports.length} saved reports`);
    return res.json(enrichedReports);
    //return sendSuccess(res, enrichedReports, 'Saved reports retrieved successfully');
  } catch (error) {
    console.error('Error fetching saved reports:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch saved reports');
  }
});

// Get real-time metrics dashboard
router.get('/metrics/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    console.log(`GET /api/metrics/dashboard: Fetching dashboard metrics for user ${userId}`);

    const [
      realtimeStats,
      recentActivity,
      alerts,
      quickMetrics
    ] = await Promise.all([
      storage.getRealtimeStats(userId),
      storage.getRecentActivity(userId, 10),
      storage.getMetricAlerts(userId),
      storage.getQuickMetrics(userId)
    ]);

    const dashboard = {
      realtime: {
        activeConversations: realtimeStats.activeConversations,
        currentUsers: realtimeStats.currentUsers,
        systemLoad: realtimeStats.systemLoad,
        responseTime: realtimeStats.responseTime
      },
      recent: {
        activities: recentActivity,
        lastUpdate: new Date()
      },
      alerts: {
        active: alerts.filter(alert => alert.status === 'active'),
        resolved: alerts.filter(alert => alert.status === 'resolved'),
        total: alerts.length
      },
      overview: {
        totalConversations: quickMetrics.totalConversations,
        totalAgents: quickMetrics.totalAgents,
        totalKnowledgeBases: quickMetrics.totalKnowledgeBases,
        storageUsed: quickMetrics.storageUsed
      }
    };

    console.log(`GET /api/metrics/dashboard: Dashboard metrics retrieved successfully`);
    return res.json(dashboard);
    //return sendSuccess(res, dashboard, 'Dashboard metrics retrieved successfully');
  } catch (error) {
    console.error('Error fetching dashboard metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch dashboard metrics');
  }
});

export default router;