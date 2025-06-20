import { eq, and, sql, count, desc, asc, gte, lte, like, or, lt, gt } from 'drizzle-orm';
import { Message, InsertMessage, messages, conversations } from '../../shared/schema';
import { BaseAdapter } from './base-adapter';
import { IMessageStorage } from '../interfaces/message-storage';

/**
 * Optimized Message Domain Adapter
 * Handles all message-related database operations with consistent error handling,
 * detailed logging, and zero code duplication
 */
export class MessageAdapter extends BaseAdapter implements IMessageStorage {
  
  /**
   * Get a single message by ID
   */
  async getMessage(id: string | number): Promise<Message | undefined> {
    return this.executeQuery(
      'getMessage',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.select()
          .from(messages)
          .where(eq(messages.id, numericId))
          .limit(1);
        return results[0];
      },
      { id }
    );
  }

  /**
   * Get all messages for a conversation
   */
  async getMessagesByConversationId(conversationId: string | number): Promise<Message[]> {
    return this.executeQuery(
      'getMessagesByConversationId',
      async () => {
        const numericId = this.validateId(conversationId);
        return await this.db.select()
          .from(messages)
          .where(eq(messages.conversationId, numericId))
          .orderBy(asc(messages.createdAt));
      },
      { conversationId }
    );
  }

  /**
   * Create a new message
   */
  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    return this.executeQuery(
      'createMessage',
      async () => {
        const msgData = {
          conversationId: insertMsg.conversationId,
          role: insertMsg.role,
          content: insertMsg.content,
          metadata: insertMsg.metadata || {},
          userId: insertMsg.userId || null,
          agentId: insertMsg.agentId || null,
          tokenCount: insertMsg.tokenCount || null
        };
        
        const results = await this.db.insert(messages)
          .values([msgData as any])
          .returning();
        return results[0];
      },
      { conversationId: insertMsg.conversationId, role: insertMsg.role }
    );
  }

  /**
   * Update an existing message
   */
  async updateMessage(id: string | number, msgData: Partial<Message>): Promise<Message | undefined> {
    return this.executeQuery(
      'updateMessage',
      async () => {
        const numericId = this.validateId(id);
        const updateData = {
          ...msgData,
          updatedAt: new Date()
        };
        
        const results = await this.db.update(messages)
          .set(updateData)
          .where(eq(messages.id, numericId))
          .returning();
        return results[0];
      },
      { id, fieldsToUpdate: Object.keys(msgData) }
    );
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteMessage',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.delete(messages)
          .where(eq(messages.id, numericId))
          .returning();
        return results.length > 0;
      },
      { id }
    );
  }

  /**
   * Get conversation messages with advanced filtering and pagination
   */
  async getConversationMessages(conversationId: string | number, options?: {
    limit?: number;
    offset?: number;
    filters?: {
      beforeId?: number;
      afterId?: number;
      role?: string;
      startDate?: Date;
      endDate?: Date;
    };
  }): Promise<Message[]> {
    return this.executeQuery(
      'getConversationMessages',
      async () => {
        const numericId = this.validateId(conversationId);
        const { limit = 50, offset = 0, filters } = options || {};
        
        let conditions = [eq(messages.conversationId, numericId)];
        
        if (filters?.beforeId) {
          conditions.push(lt(messages.id, filters.beforeId));
        }
        
        if (filters?.afterId) {
          conditions.push(gt(messages.id, filters.afterId));
        }
        
        if (filters?.role) {
          conditions.push(eq(messages.role, filters.role));
        }
        
        if (filters?.startDate) {
          conditions.push(gte(messages.createdAt, filters.startDate));
        }
        
        if (filters?.endDate) {
          conditions.push(lte(messages.createdAt, filters.endDate));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        return await this.db.select()
          .from(messages)
          .where(whereClause)
          .orderBy(asc(messages.createdAt))
          .limit(limit)
          .offset(offset);
      },
      { conversationId, options }
    );
  }

  /**
   * Search messages with comprehensive filtering
   */
  async searchMessages(params: {
    query?: string;
    conversationId?: number;
    userId?: number;
    role?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Message[]> {
    return this.executeQuery(
      'searchMessages',
      async () => {
        const { query, conversationId, userId, role, limit = 50, offset = 0, startDate, endDate } = params;
        
        let conditions = [];
        
        if (query) {
          conditions.push(
            or(
              like(messages.content, `%${query}%`),
              sql`${messages.metadata}::text LIKE ${`%${query}%`}`
            )
          );
        }
        
        if (conversationId) {
          conditions.push(eq(messages.conversationId, conversationId));
        }
        
        if (userId) {
          conditions.push(eq(messages.userId, userId));
        }
        
        if (role) {
          conditions.push(eq(messages.role, role));
        }
        
        if (startDate) {
          conditions.push(gte(messages.createdAt, startDate));
        }
        
        if (endDate) {
          conditions.push(lte(messages.createdAt, endDate));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        return await this.db.select()
          .from(messages)
          .where(whereClause)
          .orderBy(desc(messages.createdAt))
          .limit(limit)
          .offset(offset);
      },
      params
    );
  }

  /**
   * Get message statistics and analytics
   */
  async getMessageStats(params: {
    conversationId?: number;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    byRole: { role: string; count: number }[];
    averageLength: number;
    messagesByDay: { date: string; count: number }[];
  }> {
    return this.executeQuery(
      'getMessageStats',
      async () => {
        const { conversationId, userId, startDate, endDate } = params;
        
        let conditions = [];
        
        if (conversationId) {
          conditions.push(eq(messages.conversationId, conversationId));
        }
        
        if (userId) {
          conditions.push(eq(messages.userId, userId));
        }
        
        if (startDate) {
          conditions.push(gte(messages.createdAt, startDate));
        }
        
        if (endDate) {
          conditions.push(lte(messages.createdAt, endDate));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        // Get total count
        const totalResult = await this.db.select({ count: count() })
          .from(messages)
          .where(whereClause);
        
        // Get count by role
        const roleResults = await this.db.select({
          role: messages.role,
          count: count()
        })
          .from(messages)
          .where(whereClause)
          .groupBy(messages.role);
        
        // Get average content length
        const avgResult = await this.db.select({
          avgLength: sql<number>`AVG(LENGTH(${messages.content}))`
        })
          .from(messages)
          .where(whereClause);
        
        // Get messages by day
        const dailyResults = await this.db.select({
          date: sql<string>`DATE(${messages.createdAt})`,
          count: count()
        })
          .from(messages)
          .where(whereClause)
          .groupBy(sql`DATE(${messages.createdAt})`)
          .orderBy(sql`DATE(${messages.createdAt})`);
        
        return {
          total: totalResult[0]?.count || 0,
          byRole: roleResults.map(row => ({
            role: row.role || 'unknown',
            count: row.count
          })),
          averageLength: avgResult[0]?.avgLength || 0,
          messagesByDay: dailyResults.map(row => ({
            date: row.date || '',
            count: row.count
          }))
        };
      },
      params
    );
  }

  /**
   * Create multiple messages in a single transaction
   */
  async createMessages(insertMsgs: InsertMessage[]): Promise<Message[]> {
    return this.executeQuery(
      'createMessages',
      async () => {
        const msgDataArray = insertMsgs.map(insertMsg => ({
          conversationId: insertMsg.conversationId,
          role: insertMsg.role,
          content: insertMsg.content,
          metadata: insertMsg.metadata || {},
          userId: insertMsg.userId || undefined,
          agentId: insertMsg.agentId || undefined,
          tokenCount: insertMsg.tokenCount || undefined
        }));
        
        const results = await this.db.insert(messages)
          .values(msgDataArray as any)
          .returning();
        return results;
      },
      { messageCount: insertMsgs.length }
    );
  }

  /**
   * Delete all messages for a conversation
   */
  async deleteMessagesByConversationId(conversationId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteMessagesByConversationId',
      async () => {
        const numericId = this.validateId(conversationId);
        const results = await this.db.delete(messages)
          .where(eq(messages.conversationId, numericId))
          .returning();
        return results.length > 0;
      },
      { conversationId }
    );
  }

  /**
   * Get recent messages for a user across all conversations
   */
  async getRecentMessages(userId: string | number, limit: number = 20): Promise<Message[]> {
    return this.executeQuery(
      'getRecentMessages',
      async () => {
        const numericId = this.validateId(userId);
        return await this.db.select()
          .from(messages)
          .where(eq(messages.userId, numericId))
          .orderBy(desc(messages.createdAt))
          .limit(limit);
      },
      { userId, limit }
    );
  }

  /**
   * Get messages by role for a specific conversation
   */
  async getMessagesByRole(conversationId: string | number, role: string): Promise<Message[]> {
    return this.executeQuery(
      'getMessagesByRole',
      async () => {
        const numericId = this.validateId(conversationId);
        return await this.db.select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, numericId),
              eq(messages.role, role)
            )
          )
          .orderBy(asc(messages.createdAt));
      },
      { conversationId, role }
    );
  }

  /**
   * Get total message count for a conversation
   */
  async getConversationMessageCount(conversationId: string | number): Promise<number> {
    return this.executeQuery(
      'getConversationMessageCount',
      async () => {
        const numericId = this.validateId(conversationId);
        const results = await this.db.select({ count: count() })
          .from(messages)
          .where(eq(messages.conversationId, numericId));
        return results[0]?.count || 0;
      },
      { conversationId }
    );
  }
}