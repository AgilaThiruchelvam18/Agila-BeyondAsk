import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from '../postgresql';
import {
  KnowledgeBase,
  InsertKnowledgeBase,
  Document,
  Agent,
  // Database tables
  knowledgeBases,
  documents,
  agents,
  activityLogs,
  teamResourcePermissions,
} from '../../shared/schema';

/**
 * KnowledgeBaseAdapter - Specialized adapter for knowledge base operations
 * Handles all knowledge base CRUD operations, document associations, and access control
 */
export class KnowledgeBaseAdapter {
  
  /**
   * Get knowledge base by ID
   */
  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    console.log(`[KnowledgeBaseAdapter] getKnowledgeBase: { id: ${id} }`);
    try {
      const results = await db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id));
      const result = results.length > 0 ? results[0] : undefined;
      console.log(`[KnowledgeBaseAdapter] getKnowledgeBase completed: { resultCount: '${result ? 'single' : 'none'}' }`);
      return result;
    } catch (error) {
      console.error('Error getting knowledge base:', error);
      return undefined;
    }
  }

  /**
   * Get knowledge bases by user ID
   */
  async getKnowledgeBasesByUserId(userId: number, includeShared: boolean = false): Promise<KnowledgeBase[]> {
    console.log(`[KnowledgeBaseAdapter] getKnowledgeBasesByUserId: { userId: ${userId} }`);
    try {
      if (!includeShared) {
        const results = await db.select().from(knowledgeBases).where(eq(knowledgeBases.userId, userId));
        console.log(`[KnowledgeBaseAdapter] getKnowledgeBasesByUserId completed: { resultCount: ${results.length} }`);
        return results;
      }

      // TODO: Implement shared knowledge bases query when team permissions are ready
      const results = await db.select().from(knowledgeBases).where(eq(knowledgeBases.userId, userId));
      console.log(`[KnowledgeBaseAdapter] getKnowledgeBasesByUserId completed: { resultCount: ${results.length} }`);
      return results;
    } catch (error) {
      console.error('Error getting knowledge bases by user ID:', error);
      return [];
    }
  }

  /**
   * Get knowledge bases by IDs (batch operation)
   */
  async getKnowledgeBasesByIds(ids: number[]): Promise<KnowledgeBase[]> {
    if (ids.length === 0) return [];
    console.log(`[PERF] getKnowledgeBasesByIds: Batch fetching ${ids.length} knowledge bases`);
    const startTime = Date.now();
    
    const results = await db.select().from(knowledgeBases).where(inArray(knowledgeBases.id, ids));
    
    const endTime = Date.now();
    console.log(`[PERF] getKnowledgeBasesByIds: Completed in ${endTime - startTime}ms, found ${results.length} knowledge bases`);
    
    return results;
  }

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(insertKnowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase> {
    console.log(`[KnowledgeBaseAdapter] createKnowledgeBase: { name: '${insertKnowledgeBase.name}', userId: ${insertKnowledgeBase.userId} }`);
    try {
      const results = await db.insert(knowledgeBases).values([insertKnowledgeBase as any]).returning();
      const result = results[0];
      console.log(`[KnowledgeBaseAdapter] createKnowledgeBase completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      throw error;
    }
  }

  /**
   * Update knowledge base
   */
  async updateKnowledgeBase(id: number, knowledgeBaseData: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    console.log(`[KnowledgeBaseAdapter] updateKnowledgeBase: { id: ${id} }`);
    try {
      const [result] = await db.update(knowledgeBases)
        .set(knowledgeBaseData)
        .where(eq(knowledgeBases.id, id))
        .returning();
      
      console.log(`[KnowledgeBaseAdapter] updateKnowledgeBase completed: { updated: ${!!result} }`);
      return result;
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      return undefined;
    }
  }

  /**
   * Delete knowledge base
   */
  async deleteKnowledgeBase(id: number): Promise<boolean> {
    console.log(`[KnowledgeBaseAdapter] deleteKnowledgeBase: { id: ${id} }`);
    try {
      await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
      console.log(`[KnowledgeBaseAdapter] deleteKnowledgeBase completed: { deleted: true }`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      return false;
    }
  }

  /**
   * Get document count for a knowledge base
   */
  async getDocumentCountByKnowledgeBaseId(kbId: number): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(documents).where(eq(documents.knowledgeBaseId, kbId));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting document count for KB:', error);
      return 0;
    }
  }

  /**
   * Get knowledge base document count (alias for consistency)
   */
  async getKnowledgeBaseDocumentCount(kbId: string | number): Promise<number> {
    const numericId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    return this.getDocumentCountByKnowledgeBaseId(numericId);
  }

  /**
   * Get agent count for a knowledge base
   */
  async getKnowledgeBaseAgentCount(kbId: string | number): Promise<number> {
    const numericId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const result = await db.select({ count: count() })
        .from(agents)
        .where(sql`${agents.knowledgeBaseIds} @> ${JSON.stringify([numericId])}`);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base agent count:', error);
      return 0;
    }
  }

  /**
   * Get recent documents for a knowledge base
   */
  async getKnowledgeBaseRecentDocuments(kbId: string | number, limit: number = 5): Promise<Document[]> {
    const numericId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.select()
        .from(documents)
        .where(eq(documents.knowledgeBaseId, numericId))
        .orderBy(desc(documents.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting knowledge base recent documents:', error);
      return [];
    }
  }

  /**
   * Check knowledge base access permissions
   */
  async checkKnowledgeBaseAccess(kbId: string | number, userId: string | number): Promise<boolean> {
    const numericKbId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    try {
      const kb = await this.getKnowledgeBase(numericKbId);
      if (!kb) return false;
      
      // Owner has access
      if (kb.userId === numericUserId) return true;
      
      // Public knowledge bases are accessible
      if (kb.isPublic) return true;
      
      // TODO: Check team-based permissions when implemented
      return false;
    } catch (error) {
      console.error('Error checking knowledge base access:', error);
      return false;
    }
  }

  /**
   * Get unanswered questions count for a knowledge base
   */
  async getKnowledgeBaseUnansweredQuestions(kbId: string | number): Promise<number> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      // Import unansweredQuestions table reference
      const { unansweredQuestions } = require('../../shared/schema');
      const result = await db.select({ count: count() })
        .from(unansweredQuestions)
        .where(eq(unansweredQuestions.knowledgeBaseId, knowledgeBaseId));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base unanswered questions count:', error);
      return 0;
    }
  }

  /**
   * Get knowledge base dependencies for cascade operations
   */
  async getKnowledgeBaseDependencies(kbId: string | number): Promise<{
    documents: number;
    agents: number;
    unansweredQuestions: number;
  }> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    
    try {
      const [documentsCount, agentsCount, unansweredQuestionsCount] = await Promise.all([
        this.getDocumentCountByKnowledgeBaseId(knowledgeBaseId),
        this.getKnowledgeBaseAgentCount(knowledgeBaseId),
        this.getKnowledgeBaseUnansweredQuestions(knowledgeBaseId)
      ]);

      return {
        documents: documentsCount,
        agents: agentsCount,
        unansweredQuestions: unansweredQuestionsCount
      };
    } catch (error) {
      console.error('Error getting knowledge base dependencies:', error);
      return { documents: 0, agents: 0, unansweredQuestions: 0 };
    }
  }

  /**
   * Delete knowledge base documents
   */
  async deleteKnowledgeBaseDocuments(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(documents).where(eq(documents.knowledgeBaseId, knowledgeBaseId)).returning();
      console.log(`Deleted ${results.length} documents from knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base documents:', error);
      return false;
    }
  }

  /**
   * Delete knowledge base activity logs
   */
  async deleteKnowledgeBaseActivities(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(activityLogs)
        .where(
          and(
            eq(activityLogs.entityType, 'knowledge_base'),
            eq(activityLogs.entityId, knowledgeBaseId.toString())
          )
        )
        .returning();
      console.log(`Deleted ${results.length} activity logs for knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base activities:', error);
      return false;
    }
  }

  /**
   * Delete knowledge base shares
   */
  async deleteKnowledgeBaseShares(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.resourceType, 'knowledge_base'),
            eq(teamResourcePermissions.resourceId, knowledgeBaseId)
          )
        )
        .returning();
      console.log(`Deleted ${results.length} shares for knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base shares:', error);
      return false;
    }
  }

  /**
   * Cascade delete knowledge base and all dependencies
   */
  async cascadeDeleteKnowledgeBase(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    
    try {
      console.log(`Starting cascade delete for knowledge base ${knowledgeBaseId}`);
      
      // Delete in dependency order
      await this.deleteKnowledgeBaseDocuments(knowledgeBaseId);
      await this.deleteKnowledgeBaseActivities(knowledgeBaseId);
      await this.deleteKnowledgeBaseShares(knowledgeBaseId);
      
      // Finally delete the knowledge base itself
      await this.deleteKnowledgeBase(knowledgeBaseId);
      
      console.log(`Cascade delete completed for knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error in cascade delete for knowledge base:', error);
      return false;
    }
  }

  /**
   * Helper: Get knowledge base activity count
   */
  private async getKnowledgeBaseActivityCount(kbId: number): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.entityType, 'knowledge_base'),
            eq(activityLogs.entityId, kbId.toString())
          )
        );
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base activity count:', error);
      return 0;
    }
  }

  /**
   * Helper: Get knowledge base share count
   */
  private async getKnowledgeBaseShareCount(kbId: number): Promise<number> {
    try {
      const result = await db.select({ count: count() })
        .from(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.resourceType, 'knowledge_base'),
            eq(teamResourcePermissions.resourceId, kbId)
          )
        );
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base share count:', error);
      return 0;
    }
  }
}