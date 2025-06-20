import { db } from './postgresql';
import { ApiKey, InsertApiKey, apiKeys } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * PostgreSQL adapter implementations for API key operations
 * This will be imported by the PostgresqlAdapter class
 */
export const postgresqlApiKeyMethods = {
  async getApiKey(id: number): Promise<ApiKey | undefined> {
    try {
      const results = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .limit(1);
        
      return results[0];
    } catch (error) {
      console.error('Error getting API key:', error);
      return undefined;
    }
  },

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    try {
      const results = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);
        
      return results[0];
    } catch (error) {
      console.error('Error getting API key by hash:', error);
      return undefined;
    }
  },

  async getApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | undefined> {
    try {
      const results = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyPrefix, keyPrefix))
        .limit(1);
        
      return results[0];
    } catch (error) {
      console.error('Error getting API key by prefix:', error);
      return undefined;
    }
  },

  async getApiKeysByUserId(userId: number): Promise<ApiKey[]> {
    try {
      return await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
    } catch (error) {
      console.error('Error getting API keys by user ID:', error);
      return [];
    }
  },

  async createApiKey(apiKey: InsertApiKey & { keyHash: string, keyPrefix: string }): Promise<ApiKey> {
    try {
      const [created] = await db
        .insert(apiKeys)
        .values([{
          userId: apiKey.userId,
          teamId: apiKey.teamId,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          keyHash: apiKey.keyHash,
          scopes: apiKey.scopes as any,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          revoked: false
        }])
        .returning();
        
      return created;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw new Error('Failed to create API key');
    }
  },

  async updateApiKey(id: number, apiKeyData: Partial<ApiKey>): Promise<boolean> {
    try {
      // Always update the updatedAt timestamp
      const updateData = {
        ...apiKeyData,
        updatedAt: new Date()
      };
      
      await db
        .update(apiKeys)
        .set(updateData)
        .where(eq(apiKeys.id, id));
        
      return true;
    } catch (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  },

  async updateApiKeyLastUsed(id: number): Promise<boolean> {
    try {
      await db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(apiKeys.id, id));
        
      return true;
    } catch (error) {
      console.error('Error updating API key last used:', error);
      return false;
    }
  },

  async revokeApiKey(id: number): Promise<boolean> {
    try {
      await db
        .update(apiKeys)
        .set({
          revoked: true,
          updatedAt: new Date()
        })
        .where(eq(apiKeys.id, id));
        
      return true;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }
};