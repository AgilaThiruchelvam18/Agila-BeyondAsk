import { Message, InsertMessage } from '../../shared/schema';

/**
 * Message Storage Interface
 * Defines all message-related database operations with consistent signatures
 */
export interface IMessageStorage {
  // Core CRUD operations
  getMessage(id: string | number): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: string | number): Promise<Message[]>;
  createMessage(insertMsg: InsertMessage): Promise<Message>;
  updateMessage(id: string | number, msgData: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: string | number): Promise<boolean>;
  
  // Advanced message operations
  getConversationMessages(conversationId: string | number, options?: {
    limit?: number;
    offset?: number;
    filters?: {
      beforeId?: number;
      afterId?: number;
      role?: string;
      startDate?: Date;
      endDate?: Date;
    };
  }): Promise<Message[]>;
  
  // Message search and filtering
  searchMessages(params: {
    query?: string;
    conversationId?: number;
    userId?: number;
    role?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Message[]>;
  
  // Message analytics
  getMessageStats(params: {
    conversationId?: number;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    byRole: { role: string; count: number }[];
    averageLength: number;
    messagesByDay: { date: string; count: number }[];
  }>;
  
  // Bulk operations
  createMessages(insertMsgs: InsertMessage[]): Promise<Message[]>;
  deleteMessagesByConversationId(conversationId: string | number): Promise<boolean>;
  
  // Message management
  getRecentMessages(userId: string | number, limit?: number): Promise<Message[]>;
  getMessagesByRole(conversationId: string | number, role: string): Promise<Message[]>;
  getConversationMessageCount(conversationId: string | number): Promise<number>;
}