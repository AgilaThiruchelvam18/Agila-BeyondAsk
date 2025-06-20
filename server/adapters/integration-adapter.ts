import { eq, and, sql, count, desc, asc, gte, lte, like, or } from 'drizzle-orm';
import { Integration, InsertIntegration, integrations } from '../../shared/schema';
import { BaseAdapter } from './base-adapter';
import { IIntegrationStorage } from '../interfaces/integration-storage';

/**
 * Optimized Integration Domain Adapter
 * Handles all integration-related database operations with consistent error handling,
 * detailed logging, and zero code duplication
 */
export class IntegrationAdapter extends BaseAdapter implements IIntegrationStorage {
  
  /**
   * Get a single integration by ID
   */
  async getIntegration(id: string | number): Promise<Integration | undefined> {
    return this.executeQuery(
      'getIntegration',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.select()
          .from(integrations)
          .where(eq(integrations.id, numericId))
          .limit(1);
        return results[0];
      },
      { id }
    );
  }

  /**
   * Get all integrations for a user
   */
  async getIntegrationsByUserId(userId: string | number): Promise<Integration[]> {
    return this.executeQuery(
      'getIntegrationsByUserId',
      async () => {
        const numericId = this.validateId(userId);
        return await this.db.select()
          .from(integrations)
          .where(eq(integrations.userId, numericId))
          .orderBy(desc(integrations.createdAt));
      },
      { userId }
    );
  }

  /**
   * Get all integrations for a team
   */
  async getIntegrationsByTeamId(teamId: string | number): Promise<Integration[]> {
    return this.executeQuery(
      'getIntegrationsByTeamId',
      async () => {
        const numericId = this.validateId(teamId);
        return await this.db.select()
          .from(integrations)
          .where(eq(integrations.teamId, numericId))
          .orderBy(desc(integrations.createdAt));
      },
      { teamId }
    );
  }

  /**
   * Create a new integration
   */
  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    return this.executeQuery(
      'createIntegration',
      async () => {
        const integrationData = {
          name: insertIntegration.name,
          type: insertIntegration.type,
          description: insertIntegration.description || null,
          providerId: insertIntegration.providerId,
          userId: insertIntegration.userId,
          teamId: insertIntegration.teamId || undefined,
          config: insertIntegration.config || {},
          credentials: insertIntegration.credentials || null,
          status: insertIntegration.status || 'pending_setup',
          lastSyncedAt: null, // Property not available in schema
          lastErrorMessage: null // Property not available in schema
        };
        
        const results = await this.db.insert(integrations)
          .values([integrationData])
          .returning();
        return results[0];
      },
      { name: insertIntegration.name, type: insertIntegration.type, providerId: insertIntegration.providerId }
    );
  }

  /**
   * Update an existing integration
   */
  async updateIntegration(id: string | number, integrationData: Partial<Integration>): Promise<Integration | undefined> {
    return this.executeQuery(
      'updateIntegration',
      async () => {
        const numericId = this.validateId(id);
        const updateData = {
          ...integrationData,
          updatedAt: new Date()
        };
        
        const results = await this.db.update(integrations)
          .set(updateData)
          .where(eq(integrations.id, numericId))
          .returning();
        return results[0];
      },
      { id, fieldsToUpdate: Object.keys(integrationData) }
    );
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteIntegration',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.delete(integrations)
          .where(eq(integrations.id, numericId))
          .returning();
        return results.length > 0;
      },
      { id }
    );
  }

  /**
   * Get integrations by type (using providerId)
   */
  async getIntegrationsByType(type: string): Promise<Integration[]> {
    return this.executeQuery(
      'getIntegrationsByType',
      async () => {
        // Convert type to providerId lookup if needed
        const providerId = parseInt(type);
        if (!isNaN(providerId)) {
          return await this.db.select()
            .from(integrations)
            .where(eq(integrations.providerId, providerId))
            .orderBy(desc(integrations.createdAt));
        }
        return [];
      },
      { type }
    );
  }

  /**
   * Get integrations by provider
   */
  async getIntegrationsByProvider(provider: string): Promise<Integration[]> {
    return this.executeQuery(
      'getIntegrationsByProvider',
      async () => {
        const providerId = parseInt(provider);
        if (!isNaN(providerId)) {
          return await this.db.select()
            .from(integrations)
            .where(eq(integrations.providerId, providerId))
            .orderBy(desc(integrations.createdAt));
        }
        return [];
      },
      { provider }
    );
  }

  /**
   * Get active integrations
   */
  async getActiveIntegrations(userId?: string | number): Promise<Integration[]> {
    return this.executeQuery(
      'getActiveIntegrations',
      async () => {
        let conditions = [eq(integrations.status, 'active')];
        
        if (userId) {
          const numericUserId = this.validateId(userId);
          conditions.push(eq(integrations.userId, numericUserId));
        }
        
        return await this.db.select()
          .from(integrations)
          .where(and(...conditions))
          .orderBy(desc(integrations.lastSyncedAt));
      },
      { userId }
    );
  }

  /**
   * Get integration by name for a user
   */
  async getIntegrationByName(name: string, userId: string | number): Promise<Integration | undefined> {
    return this.executeQuery(
      'getIntegrationByName',
      async () => {
        const numericUserId = this.validateId(userId);
        const results = await this.db.select()
          .from(integrations)
          .where(
            and(
              eq(integrations.name, name),
              eq(integrations.userId, numericUserId)
            )
          )
          .limit(1);
        return results[0];
      },
      { name, userId }
    );
  }

  /**
   * Update integration configuration
   */
  async updateIntegrationConfig(id: string | number, config: any): Promise<Integration | undefined> {
    return this.executeQuery(
      'updateIntegrationConfig',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.update(integrations)
          .set({
            config: config,
            updatedAt: new Date()
          })
          .where(eq(integrations.id, numericId))
          .returning();
        return results[0];
      },
      { id, configKeys: Object.keys(config || {}) }
    );
  }

  /**
   * Update integration OAuth data
   */
  async updateIntegrationOAuth(id: string | number, oauthData: any): Promise<Integration | undefined> {
    return this.executeQuery(
      'updateIntegrationOAuth',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.update(integrations)
          .set({
            credentials: oauthData,
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(integrations.id, numericId))
          .returning();
        return results[0];
      },
      { id, hasTokens: !!(oauthData?.accessToken || oauthData?.refreshToken) }
    );
  }

  /**
   * Validate integration configuration
   */
  async validateIntegrationConfig(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'validateIntegrationConfig',
      async () => {
        const numericId = this.validateId(id);
        const integration = await this.db.select({
          config: integrations.config,
          oauthData: integrations.oauthData,
          type: integrations.type
        })
          .from(integrations)
          .where(eq(integrations.id, numericId))
          .limit(1);
        
        if (!integration[0]) return false;
        
        const { config, oauthData, type } = integration[0];
        
        // Basic validation - check if required fields exist
        if (type === 'oauth' && !oauthData) return false;
        if (type === 'api' && !config) return false;
        
        return true;
      },
      { id }
    );
  }

  /**
   * Search integrations with filters
   */
  async searchIntegrations(params: {
    query?: string;
    type?: string;
    provider?: string;
    isActive?: boolean;
    userId?: number;
    teamId?: number;
    limit?: number;
    offset?: number;
  }): Promise<Integration[]> {
    return this.executeQuery(
      'searchIntegrations',
      async () => {
        const { query, type, provider, isActive, userId, teamId, limit = 50, offset = 0 } = params;
        
        let conditions = [];
        
        if (query) {
          conditions.push(
            or(
              like(integrations.name, `%${query}%`),
              like(integrations.description, `%${query}%`)
            )
          );
        }
        
        if (type) {
          const providerId = parseInt(type);
          if (!isNaN(providerId)) {
            conditions.push(eq(integrations.providerId, providerId));
          }
        }
        
        if (provider) {
          const providerId = parseInt(provider);
          if (!isNaN(providerId)) {
            conditions.push(eq(integrations.providerId, providerId));
          }
        }
        
        if (isActive !== undefined) {
          const status = isActive ? 'active' : 'inactive';
          conditions.push(eq(integrations.status, status));
        }
        
        if (userId) {
          conditions.push(eq(integrations.userId, userId));
        }
        
        if (teamId) {
          conditions.push(eq(integrations.teamId, teamId));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        return await this.db.select()
          .from(integrations)
          .where(whereClause)
          .orderBy(desc(integrations.createdAt))
          .limit(limit)
          .offset(offset);
      },
      params
    );
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(params: {
    userId?: number;
    teamId?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    active: number;
    byType: { type: string; count: number }[];
    byProvider: { provider: string; count: number }[];
  }> {
    return this.executeQuery(
      'getIntegrationStats',
      async () => {
        const { userId, teamId, type, startDate, endDate } = params;
        
        let conditions = [];
        
        if (userId) {
          conditions.push(eq(integrations.userId, userId));
        }
        
        if (teamId) {
          conditions.push(eq(integrations.teamId, teamId));
        }
        
        if (type) {
          conditions.push(eq(integrations.type, type));
        }
        
        if (startDate) {
          conditions.push(gte(integrations.createdAt, startDate));
        }
        
        if (endDate) {
          conditions.push(lte(integrations.createdAt, endDate));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        // Get total count
        const totalResult = await this.db.select({ count: count() })
          .from(integrations)
          .where(whereClause);
        
        // Get active count
        const activeConditions = [...conditions, eq(integrations.isActive, true)];
        const activeResult = await this.db.select({ count: count() })
          .from(integrations)
          .where(and(...activeConditions));
        
        // Get stats by type
        const typeStats = await this.db.select({
          type: integrations.type,
          count: count()
        })
          .from(integrations)
          .where(whereClause)
          .groupBy(integrations.type);
        
        return {
          total: totalResult[0]?.count || 0,
          active: activeResult[0]?.count || 0,
          byType: typeStats.map(stat => ({ type: stat.type, count: stat.count })),
          byProvider: typeStats.map(stat => ({ provider: stat.type, count: stat.count }))
        };
      },
      params
    );
  }

  /**
   * Get failed integrations
   */
  async getFailedIntegrations(userId?: string | number): Promise<Integration[]> {
    return this.executeQuery(
      'getFailedIntegrations',
      async () => {
        let conditions = [eq(integrations.syncStatus, 'error')];
        
        if (userId) {
          const numericUserId = this.validateId(userId);
          conditions.push(eq(integrations.userId, numericUserId));
        }
        
        return await this.db.select()
          .from(integrations)
          .where(and(...conditions))
          .orderBy(desc(integrations.updatedAt));
      },
      { userId }
    );
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(id: string | number, isActive: boolean): Promise<Integration | undefined> {
    return this.executeQuery(
      'updateIntegrationStatus',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.update(integrations)
          .set({
            isActive: isActive,
            syncStatus: isActive ? 'active' : 'inactive',
            updatedAt: new Date()
          })
          .where(eq(integrations.id, numericId))
          .returning();
        return results[0];
      },
      { id, isActive }
    );
  }
}