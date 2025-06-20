import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from '../postgresql';
import {
  Conversation,
  InsertConversation,
  Message,
  ConversationMemory,
  InsertConversationMemory,
  // Database tables
  conversations,
  messages,
  conversationMemories,
} from '../../shared/schema';

/**
 * ConversationAdapter - Specialized adapter for conversation and message operations
 * Handles conversation management, message operations, and conversation memory
 */
export class ConversationAdapter {
  
  /**
   * Get conversation by ID
   */
  async getConversation(id: number): Promise<Conversation | undefined> {
    console.log(`[ConversationAdapter] getConversation: { id: ${id} }`);
    try {
      const results = await db.select().from(conversations).where(eq(conversations.id, id));
      const result = results.length > 0 ? results[0] : undefined;
      console.log(`[ConversationAdapter] getConversation completed: { resultCount: '${result ? 'single' : 'none'}' }`);
      return result;
    } catch (error) {
      console.error('Error getting conversation:', error);
      return undefined;
    }
  }

  /**
   * Get conversations by user ID
   */
  async getConversationsByUserId(userId: number): Promise<Conversation[]> {
    console.log(`[ConversationAdapter] getConversationsByUserId: { userId: ${userId} }`);
    try {
      const results = await db.select().from(conversations).where(eq(conversations.userId, userId));
      console.log(`[ConversationAdapter] getConversationsByUserId completed: { resultCount: ${results.length} }`);
      return results;
    } catch (error) {
      console.error('Error getting conversations by user ID:', error);
      return [];
    }
  }

  /**
   * Get conversations by agent ID
   */
  async getConversationsByAgentId(agentId: number): Promise<Conversation[]> {
    console.log(`[ConversationAdapter] getConversationsByAgentId: { agentId: ${agentId} }`);
    try {
      const results = await db.select().from(conversations).where(eq(conversations.agentId, agentId));
      console.log(`[ConversationAdapter] getConversationsByAgentId completed: { resultCount: ${results.length} }`);
      return results;
    } catch (error) {
      console.error('Error getting conversations by agent ID:', error);
      return [];
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    console.log(`[ConversationAdapter] createConversation: { userId: ${insertConversation.userId}, agentId: ${insertConversation.agentId} }`);
    try {
      const [result] = await db.insert(conversations).values(insertConversation).returning();
      console.log(`[ConversationAdapter] createConversation completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation
   */
  async updateConversation(id: number, conversationData: Partial<Conversation>): Promise<Conversation | undefined> {
    console.log(`[ConversationAdapter] updateConversation: { id: ${id} }`);
    try {
      const [result] = await db.update(conversations)
        .set(conversationData)
        .where(eq(conversations.id, id))
        .returning();
      
      console.log(`[ConversationAdapter] updateConversation completed: { updated: ${!!result} }`);
      return result;
    } catch (error) {
      console.error('Error updating conversation:', error);
      return undefined;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(id: number): Promise<boolean> {
    console.log(`[ConversationAdapter] deleteConversation: { id: ${id} }`);
    try {
      await db.delete(conversations).where(eq(conversations.id, id));
      console.log(`[ConversationAdapter] deleteConversation completed: { deleted: true }`);
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }

  /**
   * Search conversations
   */
  async searchConversations(userId: number, query: string, limit: number = 20): Promise<Conversation[]> {
    try {
      const results = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            sql`${conversations.title} ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(userId: number): Promise<{
    total: number;
    active: number;
    archived: number;
    today: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalResult, activeResult, archivedResult, todayResult] = await Promise.all([
        db.select({ count: count() }).from(conversations).where(eq(conversations.userId, userId)),
        db.select({ count: count() }).from(conversations).where(
          and(eq(conversations.userId, userId), eq(conversations.status, 'active'))
        ),
        db.select({ count: count() }).from(conversations).where(
          and(eq(conversations.userId, userId), eq(conversations.status, 'archived'))
        ),
        db.select({ count: count() }).from(conversations).where(
          and(eq(conversations.userId, userId), gt(conversations.createdAt, today))
        )
      ]);

      return {
        total: totalResult[0]?.count || 0,
        active: activeResult[0]?.count || 0,
        archived: archivedResult[0]?.count || 0,
        today: todayResult[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return { total: 0, active: 0, archived: 0, today: 0 };
    }
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(userId: number, limit: number = 10): Promise<Conversation[]> {
    try {
      const results = await db.select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting recent conversations:', error);
      return [];
    }
  }

  /**
   * Get active conversations
   */
  async getActiveConversations(userId: number): Promise<Conversation[]> {
    try {
      const results = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            eq(conversations.status, 'active')
          )
        )
        .orderBy(desc(conversations.updatedAt));
      return results;
    } catch (error) {
      console.error('Error getting active conversations:', error);
      return [];
    }
  }

  /**
   * Archive conversation
   */
  async archiveConversation(id: number): Promise<boolean> {
    try {
      const [result] = await db.update(conversations)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return !!result;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      return false;
    }
  }

  /**
   * Restore conversation from archive
   */
  async restoreConversation(id: number): Promise<boolean> {
    try {
      const [result] = await db.update(conversations)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return !!result;
    } catch (error) {
      console.error('Error restoring conversation:', error);
      return false;
    }
  }

  /**
   * Get archived conversations
   */
  async getArchivedConversations(userId: number): Promise<Conversation[]> {
    try {
      const results = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            eq(conversations.status, 'archived')
          )
        )
        .orderBy(desc(conversations.updatedAt));
      return results;
    } catch (error) {
      console.error('Error getting archived conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation summary from memory
   */
  async getConversationSummary(conversationId: number): Promise<string | null> {
    try {
      // Check if conversation memory exists
      const memory = await db.select()
        .from(conversationMemories)
        .where(eq(conversationMemories.conversationId, conversationId))
        .limit(1);
      
      if (memory.length > 0 && memory[0].summary) {
        return memory[0].summary;
      }
      
      // If no memory exists, return null
      return null;
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return null;
    }
  }

  /**
   * Delete conversation messages
   */
  async deleteConversationMessages(conversationId: number): Promise<boolean> {
    try {
      await db.delete(messages).where(eq(messages.conversationId, conversationId));
      return true;
    } catch (error) {
      console.error('Error deleting conversation messages:', error);
      return false;
    }
  }

  /**
   * Create or update conversation memory
   */
  async createConversationMemory(insertMemory: InsertConversationMemory): Promise<ConversationMemory> {
    try {
      const [result] = await db.insert(conversationMemories).values(insertMemory).returning();
      return result;
    } catch (error) {
      console.error('Error creating conversation memory:', error);
      throw error;
    }
  }

  /**
   * Update conversation memory
   */
  async updateConversationMemory(conversationId: number, memoryData: Partial<ConversationMemory>): Promise<ConversationMemory | undefined> {
    try {
      const [result] = await db.update(conversationMemories)
        .set(memoryData)
        .where(eq(conversationMemories.conversationId, conversationId))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating conversation memory:', error);
      return undefined;
    }
  }

  /**
   * Get conversation memory
   */
  async getConversationMemory(conversationId: number): Promise<ConversationMemory | undefined> {
    try {
      const results = await db.select()
        .from(conversationMemories)
        .where(eq(conversationMemories.conversationId, conversationId))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting conversation memory:', error);
      return undefined;
    }
  }

  /**
   * Delete conversation memory
   */
  async deleteConversationMemory(conversationId: number): Promise<boolean> {
    try {
      await db.delete(conversationMemories).where(eq(conversationMemories.conversationId, conversationId));
      return true;
    } catch (error) {
      console.error('Error deleting conversation memory:', error);
      return false;
    }
  }
}