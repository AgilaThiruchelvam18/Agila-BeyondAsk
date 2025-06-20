import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { dailyUsageMetrics, DailyUsageMetric, InsertDailyUsageMetric, users } from '@shared/schema';
import { BaseAdapter } from './base-adapter';
import { IUsageMetricsStorage } from '../interfaces/usage-metrics-storage';

/**
 * Optimized Usage Metrics Domain Adapter
 * Handles all usage metrics and analytics database operations with consistent error handling,
 * detailed logging, and zero code duplication
 */
export class UsageMetricsAdapter extends BaseAdapter implements IUsageMetricsStorage {
  
  /**
   * Track daily usage metric (increment if exists for today, create if new)
   */
  async trackDailyUsageMetric(
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
  ): Promise<DailyUsageMetric> {
    return this.executeQuery(
      'trackDailyUsageMetric',
      async () => {
        const today = new Date().toISOString().split('T')[0];
        
        // First check if there's an existing metric for today with the same type
        const existingMetrics = await this.db.select()
          .from(dailyUsageMetrics)
          .where(
            and(
              eq(dailyUsageMetrics.userId, userId),
              eq(dailyUsageMetrics.metricType, metricType),
              eq(dailyUsageMetrics.date, today),
              options?.teamId ? eq(dailyUsageMetrics.teamId, options.teamId) : sql`true`,
              options?.region ? eq(dailyUsageMetrics.region, options.region) : sql`true`,
              options?.storageType ? eq(dailyUsageMetrics.storageType, options.storageType) : sql`true`,
              options?.source ? eq(dailyUsageMetrics.source, options.source) : sql`true`
            )
          );

        // If metric exists for today, update it by incrementing the value
        if (existingMetrics.length > 0) {
          const existingMetric = existingMetrics[0];
          const updatedMetric = await this.db.update(dailyUsageMetrics)
            .set({
              metricValue: existingMetric.metricValue + metricValue,
              updatedAt: new Date()
            })
            .where(eq(dailyUsageMetrics.id, existingMetric.id))
            .returning();
          
          return updatedMetric[0];
        }
        
        // Otherwise, create a new metric
        const newMetric = {
          userId,
          metricType,
          metricValue,
          date: today,
          teamId: options?.teamId || undefined,
          region: options?.region || undefined,
          storageType: options?.storageType || undefined,
          source: options?.source || undefined,
          metadata: options?.metadata || {}
        };
        
        const results = await this.db.insert(dailyUsageMetrics).values([newMetric]).returning();
        return results[0];
      },
      { userId, metricType, metricValue, options }
    );
  }

  /**
   * Get daily usage metrics with flexible filtering
   */
  async getDailyUsageMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      metricType?: string | string[],
      groupBy?: string
    }
  ): Promise<DailyUsageMetric[]> {
    return this.executeQuery(
      'getDailyUsageMetrics',
      async () => {
        // Default to last 30 days if no date range provided
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }
        
        // Build query conditions
        const conditions = [
          eq(dailyUsageMetrics.userId, userId),
          sql`${dailyUsageMetrics.date} >= ${startDate}`,
          sql`${dailyUsageMetrics.date} <= ${endDate}`
        ];
        
        // Add team filter if provided
        if (params.teamId) {
          conditions.push(eq(dailyUsageMetrics.teamId, params.teamId));
        }
        
        // Add metric type filter if provided
        if (params.metricType) {
          if (Array.isArray(params.metricType)) {
            conditions.push(inArray(dailyUsageMetrics.metricType, params.metricType));
          } else {
            conditions.push(eq(dailyUsageMetrics.metricType, params.metricType));
          }
        }

        const query = this.db.select()
          .from(dailyUsageMetrics)
          .where(and(...conditions));
        
        // Execute the query and return results
        return await query.orderBy(desc(dailyUsageMetrics.date));
      },
      { userId, dateRange: `${params.startDate || 'auto'} to ${params.endDate || 'today'}` }
    );
  }

  /**
   * Get usage summary with current and lifetime totals
   */
  async getUsageSummary(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      currentPeriodOnly?: boolean
    }
  ): Promise<Record<string, { current: number, lifetime: number }>> {
    return this.executeQuery(
      'getUsageSummary',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        // Get current period metrics
        const currentQuery = sql`
          SELECT 
            metric_type, 
            SUM(metric_value) AS total_value
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND date >= ${startDate}
            AND date <= ${endDate}
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
          GROUP BY metric_type
        `;
        
        const currentMetrics = await this.db.execute(currentQuery);

        // Get lifetime metrics if needed
        let lifetimeMetrics: any[] = [];
        if (!params.currentPeriodOnly) {
          const lifetimeQuery = sql`
            SELECT 
              metric_type, 
              SUM(metric_value) AS total_value
            FROM daily_usage_metrics
            WHERE 
              user_id = ${userId}
              ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
            GROUP BY metric_type
          `;
          
          lifetimeMetrics = await this.db.execute(lifetimeQuery);
        }

        // Build summary object
        const summary: Record<string, { current: number, lifetime: number }> = {};
        
        // Process current metrics
        currentMetrics.forEach((metric: any) => {
          const metricType = metric.metric_type;
          summary[metricType] = {
            current: Number(metric.total_value) || 0,
            lifetime: 0
          };
        });
        
        // Process lifetime metrics
        lifetimeMetrics.forEach((metric: any) => {
          const metricType = metric.metric_type;
          if (summary[metricType]) {
            summary[metricType].lifetime = Number(metric.total_value) || 0;
          } else {
            summary[metricType] = {
              current: 0,
              lifetime: Number(metric.total_value) || 0
            };
          }
        });

        return summary;
      },
      { userId, params }
    );
  }

  /**
   * Get regional usage metrics
   */
  async getRegionalMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ region: string, value: number }[]> {
    return this.executeQuery(
      'getRegionalMetrics',
      async () => {
        // Set default date range to last 30 days if not provided
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }
        
        // Use raw SQL to avoid column name conflicts
        const query = sql`
          SELECT 
            region, 
            SUM(metric_value) AS total_value
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND date >= ${startDate}
            AND date <= ${endDate}
            AND region IS NOT NULL
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
          GROUP BY region
          ORDER BY total_value DESC
          LIMIT ${params.limit || 10}
        `;
        
        const regionalMetrics = await this.db.execute(query);
        
        return regionalMetrics.map((item: any) => ({
          region: item.region || 'unknown',
          value: Number(item.total_value) || 0
        }));
      },
      { userId, params }
    );
  }

  /**
   * Get storage utilization by type
   */
  async getStorageUtilization(
    userId: number,
    params: {
      teamId?: number
    }
  ): Promise<{ type: string, sizeKb: number }[]> {
    return this.executeQuery(
      'getStorageUtilization',
      async () => {
        // Use raw SQL to avoid column name conflicts
        const query = sql`
          SELECT 
            storage_type AS type, 
            SUM(metric_value) AS total_size
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND storage_type IS NOT NULL
            AND metric_type = 'storage_usage'
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
          GROUP BY storage_type
          ORDER BY total_size DESC
        `;
        
        const storageMetrics = await this.db.execute(query);
        
        return storageMetrics.map((item: any) => ({
          type: item.type || 'unknown',
          sizeKb: Number(item.total_size) || 0
        }));
      },
      { userId, params }
    );
  }

  /**
   * Get daily metrics with granularity control
   */
  async getDailyMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      granularity?: string
    }
  ): Promise<DailyUsageMetric[]> {
    return this.executeQuery(
      'getDailyMetrics',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        let conditions = [
          eq(dailyUsageMetrics.userId, userId),
          sql`${dailyUsageMetrics.date} >= ${startDate}`,
          sql`${dailyUsageMetrics.date} <= ${endDate}`
        ];

        if (params.teamId) {
          conditions.push(eq(dailyUsageMetrics.teamId, params.teamId));
        }

        return await this.db.select()
          .from(dailyUsageMetrics)
          .where(and(...conditions))
          .orderBy(asc(dailyUsageMetrics.date));
      },
      { userId, params }
    );
  }

  /**
   * Get metrics filtered by source
   */
  async getMetricsBySource(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      source?: string
    }
  ): Promise<DailyUsageMetric[]> {
    return this.executeQuery(
      'getMetricsBySource',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        let conditions = [
          eq(dailyUsageMetrics.userId, userId),
          sql`${dailyUsageMetrics.date} >= ${startDate}`,
          sql`${dailyUsageMetrics.date} <= ${endDate}`
        ];

        if (params.teamId) {
          conditions.push(eq(dailyUsageMetrics.teamId, params.teamId));
        }

        if (params.source) {
          conditions.push(eq(dailyUsageMetrics.source, params.source));
        }

        return await this.db.select()
          .from(dailyUsageMetrics)
          .where(and(...conditions))
          .orderBy(desc(dailyUsageMetrics.date));
      },
      { userId, params }
    );
  }

  /**
   * Get metric trends over time
   */
  async getMetricTrends(
    userId: number,
    params: {
      teamId?: number,
      metricType: string,
      period: 'day' | 'week' | 'month',
      limit?: number
    }
  ): Promise<{ date: string, value: number }[]> {
    return this.executeQuery(
      'getMetricTrends',
      async () => {
        const limit = params.limit || 30;
        let dateFormat = 'date';
        
        if (params.period === 'week') {
          dateFormat = `DATE_TRUNC('week', date)`;
        } else if (params.period === 'month') {
          dateFormat = `DATE_TRUNC('month', date)`;
        }

        const query = sql`
          SELECT 
            ${sql.raw(dateFormat)} AS period_date,
            SUM(metric_value) AS total_value
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND metric_type = ${params.metricType}
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
          GROUP BY ${sql.raw(dateFormat)}
          ORDER BY period_date DESC
          LIMIT ${limit}
        `;
        
        const trends = await this.db.execute(query);
        
        return trends.map((item: any) => ({
          date: item.period_date,
          value: Number(item.total_value) || 0
        }));
      },
      { userId, params }
    );
  }

  /**
   * Get team usage metrics
   */
  async getTeamUsageMetrics(
    teamId: number,
    params: {
      startDate?: string,
      endDate?: string,
      metricType?: string | string[]
    }
  ): Promise<DailyUsageMetric[]> {
    return this.executeQuery(
      'getTeamUsageMetrics',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        let conditions = [
          eq(dailyUsageMetrics.teamId, teamId),
          sql`${dailyUsageMetrics.date} >= ${startDate}`,
          sql`${dailyUsageMetrics.date} <= ${endDate}`
        ];

        if (params.metricType) {
          if (Array.isArray(params.metricType)) {
            conditions.push(inArray(dailyUsageMetrics.metricType, params.metricType));
          } else {
            conditions.push(eq(dailyUsageMetrics.metricType, params.metricType));
          }
        }

        return await this.db.select()
          .from(dailyUsageMetrics)
          .where(and(...conditions))
          .orderBy(desc(dailyUsageMetrics.date));
      },
      { teamId, params }
    );
  }

  /**
   * Get team member usage breakdown
   */
  async getTeamMemberUsage(
    teamId: number,
    params: {
      startDate?: string,
      endDate?: string,
      metricType?: string
    }
  ): Promise<{ userId: number, username: string, totalUsage: number }[]> {
    return this.executeQuery(
      'getTeamMemberUsage',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        const query = sql`
          SELECT 
            dum.user_id,
            u.name AS username,
            SUM(dum.metric_value) AS total_usage
          FROM daily_usage_metrics dum
          JOIN users u ON dum.user_id = u.id
          WHERE 
            dum.team_id = ${teamId}
            AND dum.date >= ${startDate}
            AND dum.date <= ${endDate}
            ${params.metricType ? sql`AND dum.metric_type = ${params.metricType}` : sql``}
          GROUP BY dum.user_id, u.name
          ORDER BY total_usage DESC
        `;
        
        const memberUsage = await this.db.execute(query);
        
        return memberUsage.map((item: any) => ({
          userId: Number(item.user_id),
          username: item.username || 'Unknown',
          totalUsage: Number(item.total_usage) || 0
        }));
      },
      { teamId, params }
    );
  }

  /**
   * Get top metrics by value
   */
  async getTopMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ metricType: string, totalValue: number }[]> {
    return this.executeQuery(
      'getTopMetrics',
      async () => {
        const now = new Date();
        const endDate = params.endDate || now.toISOString().split('T')[0];
        
        let startDate: string;
        if (params.startDate) {
          startDate = params.startDate;
        } else {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        const query = sql`
          SELECT 
            metric_type,
            SUM(metric_value) AS total_value
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND date >= ${startDate}
            AND date <= ${endDate}
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
          GROUP BY metric_type
          ORDER BY total_value DESC
          LIMIT ${params.limit || 10}
        `;
        
        const topMetrics = await this.db.execute(query);
        
        return topMetrics.map((item: any) => ({
          metricType: item.metric_type,
          totalValue: Number(item.total_value) || 0
        }));
      },
      { userId, params }
    );
  }

  /**
   * Get usage quota information
   */
  async getUsageQuota(
    userId: number,
    params: {
      teamId?: number,
      metricType: string,
      period: 'current' | 'monthly' | 'yearly'
    }
  ): Promise<{ used: number, limit: number, percentage: number }> {
    return this.executeQuery(
      'getUsageQuota',
      async () => {
        let startDate: string;
        const now = new Date();

        if (params.period === 'monthly') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        } else if (params.period === 'yearly') {
          startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        } else {
          // Current period (last 30 days)
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }

        const endDate = now.toISOString().split('T')[0];

        const query = sql`
          SELECT SUM(metric_value) AS total_used
          FROM daily_usage_metrics
          WHERE 
            user_id = ${userId}
            AND metric_type = ${params.metricType}
            AND date >= ${startDate}
            AND date <= ${endDate}
            ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
        `;
        
        const result = await this.db.execute(query);
        const used = Number(result[0]?.total_used) || 0;
        
        // Default limits (these would typically come from subscription service)
        const defaultLimits: Record<string, number> = {
          'api_requests': 10000,
          'questions_asked': 1000,
          'storage_usage': 1000000, // 1GB in KB
          'contacts_captured': 5000
        };
        
        const limit = defaultLimits[params.metricType] || 1000;
        const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

        return { used, limit, percentage };
      },
      { userId, params }
    );
  }

  /**
   * Cleanup old metrics for data retention
   */
  async cleanupOldMetrics(
    beforeDate: string,
    params: {
      keepSummaries?: boolean,
      batchSize?: number
    }
  ): Promise<number> {
    return this.executeQuery(
      'cleanupOldMetrics',
      async () => {
        const batchSize = params.batchSize || 1000;
        
        if (params.keepSummaries) {
          // Keep monthly summaries, delete daily details
          const deleteQuery = sql`
            DELETE FROM daily_usage_metrics 
            WHERE date < ${beforeDate}
            AND id NOT IN (
              SELECT DISTINCT ON (DATE_TRUNC('month', date), user_id, metric_type) id
              FROM daily_usage_metrics 
              WHERE date < ${beforeDate}
              ORDER BY DATE_TRUNC('month', date), user_id, metric_type, date DESC
            )
            LIMIT ${batchSize}
          `;
          
          const result = await this.db.execute(deleteQuery);
          return result.length || 0;
        } else {
          // Delete all metrics before the date
          const deleteQuery = sql`
            DELETE FROM daily_usage_metrics 
            WHERE date < ${beforeDate}
            LIMIT ${batchSize}
          `;
          
          const result = await this.db.execute(deleteQuery);
          return result.length || 0;
        }
      },
      { beforeDate, params }
    );
  }
}