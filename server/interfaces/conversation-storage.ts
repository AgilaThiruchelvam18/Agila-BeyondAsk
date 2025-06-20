import { Conversation, InsertConversation } from '../../shared/schema';

/**
 * Conversation Storage Interface
 * Defines all conversation-related database operations with consistent signatures
 */
export interface IConversationStorage {
  // Core CRUD operations
  getConversation(id: string | number): Promise<Conversation | undefined>;
  getConversationsByUserId(userId: string | number): Promise<Conversation[]>;
  getConversationsByAgentId(agentId: string | number): Promise<Conversation[]>;
  createConversation(insertConv: InsertConversation): Promise<Conversation>;
  updateConversation(id: string | number, convData: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string | number): Promise<boolean>;
  
  // Search and filtering
  searchConversations(params: {
    userId?: number;
    agentId?: number;
    query?: string;
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Conversation[]>;
  
  // Conversation analytics
  getConversationStats(params: {
    userId?: number;
    agentId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    active: number;
    completed: number;
    averageLength: number;
  }>;
  
  // Recent and active conversations
  getRecentConversations(userId: string | number, limit?: number): Promise<Conversation[]>;
  getActiveConversations(userId: string | number): Promise<Conversation[]>;
  
  // Conversation management
  archiveConversation(id: string | number): Promise<Conversation | undefined>;
  restoreConversation(id: string | number): Promise<Conversation | undefined>;
  getArchivedConversations(userId: string | number): Promise<Conversation[]>;
}