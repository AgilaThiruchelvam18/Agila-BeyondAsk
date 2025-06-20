import { DailyUsageMetric, InsertDailyUsageMetric } from '@shared/schema';

/**
 * Usage Metrics Storage Interface
 * Defines all usage metrics and analytics database operations with consistent signatures
 */
export interface IUsageMetricsStorage {
  // Core Usage Metrics operations
  trackDailyUsageMetric(
    userId: number, 
    metricType: string, 
    metricValue: number, 
    options?: {
      teamId?: number,
      region?: string,
      storageType?: string,
      source?: string,
      metadata?: any
    }
  ): Promise<DailyUsageMetric>;
  
  getDailyUsageMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      metricType?: string | string[],
      groupBy?: string
    }
  ): Promise<DailyUsageMetric[]>;
  
  getUsageSummary(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      currentPeriodOnly?: boolean
    }
  ): Promise<Record<string, { current: number, lifetime: number }>>;
  
  // Regional and analytics operations
  getRegionalMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ region: string, value: number }[]>;
  
  getStorageUtilization(
    userId: number,
    params: {
      teamId?: number
    }
  ): Promise<{ type: string, sizeKb: number }[]>;
  
  // Advanced metrics operations
  getDailyMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      granularity?: string
    }
  ): Promise<DailyUsageMetric[]>;
  
  getMetricsBySource(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      source?: string
    }
  ): Promise<DailyUsageMetric[]>;
  
  getMetricTrends(
    userId: number,
    params: {
      teamId?: number,
      metricType: string,
      period: 'day' | 'week' | 'month',
      limit?: number
    }
  ): Promise<{ date: string, value: number }[]>;
  
  // Team analytics operations
  getTeamUsageMetrics(
    teamId: number,
    params: {
      startDate?: string,
      endDate?: string,
      metricType?: string | string[]
    }
  ): Promise<DailyUsageMetric[]>;
  
  getTeamMemberUsage(
    teamId: number,
    params: {
      startDate?: string,
      endDate?: string,
      metricType?: string
    }
  ): Promise<{ userId: number, username: string, totalUsage: number }[]>;
  
  // Performance and monitoring operations
  getTopMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ metricType: string, totalValue: number }[]>;
  
  getUsageQuota(
    userId: number,
    params: {
      teamId?: number,
      metricType: string,
      period: 'current' | 'monthly' | 'yearly'
    }
  ): Promise<{ used: number, limit: number, percentage: number }>;
  
  cleanupOldMetrics(
    beforeDate: string,
    params: {
      keepSummaries?: boolean,
      batchSize?: number
    }
  ): Promise<number>;
}