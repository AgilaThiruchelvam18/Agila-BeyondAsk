import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from '../postgresql';
import {
  UnansweredQuestion,
  InsertUnansweredQuestion,
  ScheduledKnowledgeUpdate,
  InsertScheduledKnowledgeUpdate,
  // Database tables
  unansweredQuestions,
  scheduledKnowledgeUpdates,
} from '../../shared/schema';

/**
 * AnalyticsAdapter - Specialized adapter for analytics and tracking operations
 * Handles unanswered questions, scheduled updates, and performance metrics
 */
export class AnalyticsAdapter {
  
  /**
   * Get unanswered question by ID
   */
  async getUnansweredQuestion(id: number): Promise<UnansweredQuestion | undefined> {
    const results = await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.id, id)).limit(1);
    return results[0];
  }

  /**
   * Get unanswered questions by user ID
   */
  async getUnansweredQuestionsByUserId(userId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.userId, userId));
  }

  /**
   * Get unanswered questions by agent ID
   */
  async getUnansweredQuestionsByAgentId(agentId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.agentId, agentId));
  }

  /**
   * Get unanswered questions by knowledge base ID
   */
  async getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.knowledgeBaseId, knowledgeBaseId));
  }

  /**
   * Get unanswered questions by status
   */
  async getUnansweredQuestionsByStatus(status: string): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.status, status));
  }

  /**
   * Create unanswered question with data sanitization
   */
  async createUnansweredQuestion(insertQuestion: InsertUnansweredQuestion): Promise<UnansweredQuestion> {
    try {
      const now = new Date();
      
      // Helper function to recursively sanitize objects and remove null bytes
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj.replace(/\0/g, '');
        }
        if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
          }
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        return obj;
      };
      
      // Ensure all required fields are present and sanitize text fields
      const questionData = {
        question: insertQuestion.question ? insertQuestion.question.replace(/\0/g, '') : '',
        agentId: insertQuestion.agentId,
        userId: insertQuestion.userId || undefined,
        knowledgeBaseId: insertQuestion.knowledgeBaseId || undefined,
        conversationId: insertQuestion.conversationId || undefined,
        messageId: insertQuestion.messageId || undefined,
        context: insertQuestion.context ? insertQuestion.context.replace(/\0/g, '') : undefined,
        confidenceScore: insertQuestion.confidenceScore || undefined,
        status: insertQuestion.status ? insertQuestion.status.replace(/\0/g, '') : 'pending',
        resolution: insertQuestion.resolution ? insertQuestion.resolution.replace(/\0/g, '') : undefined,
        newDocumentId: insertQuestion.newDocumentId || undefined,
        source: insertQuestion.source ? insertQuestion.source.replace(/\0/g, '') : 'chat',
        metadata: sanitizeObject(insertQuestion.metadata || {}),
        updatedAt: now
      };
      
      const results = await db.insert(unansweredQuestions).values([questionData]).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating unanswered question:', error);
      throw error;
    }
  }

  /**
   * Update unanswered question
   */
  async updateUnansweredQuestion(id: number, questionData: Partial<UnansweredQuestion>): Promise<UnansweredQuestion | undefined> {
    const dataWithUpdatedTimestamp = {
      ...questionData,
      updatedAt: new Date()
    };
    
    const results = await db.update(unansweredQuestions)
      .set(dataWithUpdatedTimestamp)
      .where(eq(unansweredQuestions.id, id))
      .returning();
    return results[0];
  }

  /**
   * Get scheduled knowledge update by ID
   */
  async getScheduledKnowledgeUpdate(id: number): Promise<ScheduledKnowledgeUpdate | undefined> {
    const results = await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.id, id)).limit(1);
    return results[0];
  }

  /**
   * Get scheduled knowledge updates by user ID
   */
  async getScheduledKnowledgeUpdatesByUserId(userId: number): Promise<ScheduledKnowledgeUpdate[]> {
    return await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.userId, userId));
  }

  /**
   * Get scheduled knowledge updates by agent ID
   */
  async getScheduledKnowledgeUpdatesByAgentId(agentId: number): Promise<ScheduledKnowledgeUpdate[]> {
    return await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.agentId, agentId));
  }

  /**
   * Get scheduled knowledge updates that are due for execution
   */
  async getScheduledKnowledgeUpdatesDue(): Promise<ScheduledKnowledgeUpdate[]> {
    const now = new Date();
    return await db.select()
      .from(scheduledKnowledgeUpdates)
      .where(
        and(
          eq(scheduledKnowledgeUpdates.isActive, true),
          sql`${scheduledKnowledgeUpdates.nextRun} IS NOT NULL AND ${scheduledKnowledgeUpdates.nextRun} <= ${now}`
        )
      );
  }

  /**
   * Create scheduled knowledge update
   */
  async createScheduledKnowledgeUpdate(insertUpdate: InsertScheduledKnowledgeUpdate): Promise<ScheduledKnowledgeUpdate> {
    try {
      const now = new Date();
      
      // Process schedule data
      const scheduleData = typeof insertUpdate.schedule === 'string' 
        ? JSON.parse(insertUpdate.schedule) 
        : insertUpdate.schedule;

      // Convert knowledgeBaseIds to proper array format using temporary type assertion
      let kbIds: number[] | undefined;
      if (Array.isArray(insertUpdate.knowledgeBaseIds)) {
        kbIds = Array.from(insertUpdate.knowledgeBaseIds) as number[];
      } else if (typeof insertUpdate.knowledgeBaseIds === 'string') {
        try {
          const parsed = JSON.parse(insertUpdate.knowledgeBaseIds);
          kbIds = Array.isArray(parsed) ? parsed as number[] : undefined;
        } catch {
          kbIds = undefined;
        }
      } else {
        kbIds = undefined;
      }

      const updateData = {
        userId: insertUpdate.userId,
        agentId: insertUpdate.agentId || undefined,
        knowledgeBaseIds: kbIds,
        name: insertUpdate.name,
        schedule: scheduleData,
        isActive: insertUpdate.isActive !== undefined ? insertUpdate.isActive : true,
        lastRun: undefined,
        nextRun: undefined,
        createdAt: now,
        updatedAt: now
      };

      const results = await db.insert(scheduledKnowledgeUpdates).values([updateData]).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating scheduled knowledge update:', error);
      throw error;
    }
  }

  /**
   * Update scheduled knowledge update
   */
  async updateScheduledKnowledgeUpdate(id: number, updateData: Partial<ScheduledKnowledgeUpdate>): Promise<ScheduledKnowledgeUpdate | undefined> {
    const dataWithUpdatedTimestamp = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const results = await db.update(scheduledKnowledgeUpdates)
      .set(dataWithUpdatedTimestamp)
      .where(eq(scheduledKnowledgeUpdates.id, id))
      .returning();
    return results[0];
  }

  /**
   * Delete scheduled knowledge update
   */
  async deleteScheduledKnowledgeUpdate(id: number): Promise<boolean> {
    try {
      await db.delete(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting scheduled knowledge update:', error);
      return false;
    }
  }

  /**
   * Get analytics summary for unanswered questions
   */
  async getUnansweredQuestionsAnalytics(userId?: number): Promise<{
    total: number;
    pending: number;
    resolved: number;
    rejected: number;
    byAgent: Array<{ agentId: number; count: number }>;
    byKnowledgeBase: Array<{ knowledgeBaseId: number; count: number }>;
    recentTrends: Array<{ date: string; count: number }>;
  }> {
    try {
      const whereCondition = userId ? eq(unansweredQuestions.userId, userId) : undefined;

      const [totalResult, pendingResult, resolvedResult, rejectedResult] = await Promise.all([
        db.select({ count: count() }).from(unansweredQuestions).where(whereCondition),
        db.select({ count: count() }).from(unansweredQuestions).where(
          whereCondition ? and(whereCondition, eq(unansweredQuestions.status, 'pending')) : eq(unansweredQuestions.status, 'pending')
        ),
        db.select({ count: count() }).from(unansweredQuestions).where(
          whereCondition ? and(whereCondition, eq(unansweredQuestions.status, 'resolved')) : eq(unansweredQuestions.status, 'resolved')
        ),
        db.select({ count: count() }).from(unansweredQuestions).where(
          whereCondition ? and(whereCondition, eq(unansweredQuestions.status, 'rejected')) : eq(unansweredQuestions.status, 'rejected')
        )
      ]);

      // Get counts by agent
      const byAgentResults = await db.select({
        agentId: unansweredQuestions.agentId,
        count: count()
      })
      .from(unansweredQuestions)
      .where(whereCondition)
      .groupBy(unansweredQuestions.agentId);

      // Get counts by knowledge base
      const byKnowledgeBaseResults = await db.select({
        knowledgeBaseId: unansweredQuestions.knowledgeBaseId,
        count: count()
      })
      .from(unansweredQuestions)
      .where(whereCondition)
      .groupBy(unansweredQuestions.knowledgeBaseId);

      return {
        total: totalResult[0]?.count || 0,
        pending: pendingResult[0]?.count || 0,
        resolved: resolvedResult[0]?.count || 0,
        rejected: rejectedResult[0]?.count || 0,
        byAgent: byAgentResults.map(r => ({ agentId: r.agentId || 0, count: r.count })),
        byKnowledgeBase: byKnowledgeBaseResults.map(r => ({ knowledgeBaseId: r.knowledgeBaseId || 0, count: r.count })),
        recentTrends: [] // TODO: Implement time-based trending analysis
      };
    } catch (error) {
      console.error('Error getting unanswered questions analytics:', error);
      return {
        total: 0,
        pending: 0,
        resolved: 0,
        rejected: 0,
        byAgent: [],
        byKnowledgeBase: [],
        recentTrends: []
      };
    }
  }

  /**
   * Get recent unanswered questions
   */
  async getRecentUnansweredQuestions(userId?: number, limit: number = 20): Promise<UnansweredQuestion[]> {
    try {
      const whereCondition = userId ? eq(unansweredQuestions.userId, userId) : undefined;
      
      const results = await db.select()
        .from(unansweredQuestions)
        .where(whereCondition)
        .orderBy(desc(unansweredQuestions.createdAt))
        .limit(limit);
      
      return results;
    } catch (error) {
      console.error('Error getting recent unanswered questions:', error);
      return [];
    }
  }

  /**
   * Get performance metrics for agents
   */
  async getAgentPerformanceMetrics(agentId: number): Promise<{
    totalQuestions: number;
    unansweredQuestions: number;
    averageConfidence: number;
    resolutionRate: number;
  }> {
    try {
      const [totalResult, unansweredResult, avgConfidenceResult, resolvedResult] = await Promise.all([
        db.select({ count: count() }).from(unansweredQuestions).where(eq(unansweredQuestions.agentId, agentId)),
        db.select({ count: count() }).from(unansweredQuestions).where(
          and(eq(unansweredQuestions.agentId, agentId), eq(unansweredQuestions.status, 'pending'))
        ),
        db.select({ 
          avgConfidence: sql`AVG(${unansweredQuestions.confidenceScore})`
        }).from(unansweredQuestions).where(eq(unansweredQuestions.agentId, agentId)),
        db.select({ count: count() }).from(unansweredQuestions).where(
          and(eq(unansweredQuestions.agentId, agentId), eq(unansweredQuestions.status, 'resolved'))
        )
      ]);

      const total = totalResult[0]?.count || 0;
      const resolved = resolvedResult[0]?.count || 0;
      const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;

      return {
        totalQuestions: total,
        unansweredQuestions: unansweredResult[0]?.count || 0,
        averageConfidence: Number(avgConfidenceResult[0]?.avgConfidence) || 0,
        resolutionRate: Math.round(resolutionRate * 100) / 100
      };
    } catch (error) {
      console.error('Error getting agent performance metrics:', error);
      return {
        totalQuestions: 0,
        unansweredQuestions: 0,
        averageConfidence: 0,
        resolutionRate: 0
      };
    }
  }
}