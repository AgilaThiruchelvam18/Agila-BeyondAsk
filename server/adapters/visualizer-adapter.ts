import { eq, and } from 'drizzle-orm';
import { db } from '../postgresql';
import {
  VisualizerBoard,
  InsertVisualizerBoard,
  VisualizerChatConversation,
  InsertVisualizerChatConversation
} from '../../shared/schema';
import { 
  visualizerBoards, 
  visualizerChatConversations 
} from '../../shared/schema';

export class VisualizerAdapter {
  async getVisualizerBoard(id: number): Promise<VisualizerBoard | undefined> {
    const results = await db
      .select()
      .from(visualizerBoards)
      .where(eq(visualizerBoards.id, id))
      .limit(1);
    
    return results[0];
  }

  async getVisualizerBoardsByUserId(userId: number): Promise<VisualizerBoard[]> {
    const results = await db
      .select()
      .from(visualizerBoards)
      .where(eq(visualizerBoards.userId, userId))
      .orderBy(visualizerBoards.updatedAt);
    
    return results;
  }

  async createVisualizerBoard(board: InsertVisualizerBoard): Promise<VisualizerBoard> {
    const now = new Date();
    const boardData = {
      ...board,
      createdAt: now,
      updatedAt: now
    };
    
    const results = await db
      .insert(visualizerBoards)
      .values(boardData)
      .returning();
    
    return results[0];
  }

  async getVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<VisualizerChatConversation | undefined> {
    const results = await db
      .select()
      .from(visualizerChatConversations)
      .where(
        and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        )
      )
      .limit(1);
    
    return results[0];
  }

  async createVisualizerChatConversation(conversation: InsertVisualizerChatConversation): Promise<VisualizerChatConversation> {
    const results = await db
      .insert(visualizerChatConversations)
      .values(conversation)
      .returning();
    
    return results[0];
  }

  async updateVisualizerChatConversation(boardId: number, chatNodeId: string, data: Partial<VisualizerChatConversation>): Promise<VisualizerChatConversation | undefined> {
    const results = await db
      .update(visualizerChatConversations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        )
      )
      .returning();
    
    return results[0];
  }

  async deleteVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<boolean> {
    const result = await db
      .delete(visualizerChatConversations)
      .where(
        and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        )
      )
      .returning({ id: visualizerChatConversations.id });
    
    return result.length > 0;
  }



  async updateVisualizerBoard(id: number, boardData: Partial<VisualizerBoard>): Promise<VisualizerBoard | undefined> {
    const results = await db
      .update(visualizerBoards)
      .set({
        ...boardData,
        updatedAt: new Date()
      })
      .where(eq(visualizerBoards.id, id))
      .returning();
    
    return results[0];
  }

  async deleteVisualizerBoard(id: number): Promise<boolean> {
    const result = await db
      .delete(visualizerBoards)
      .where(eq(visualizerBoards.id, id))
      .returning({ id: visualizerBoards.id });
    
    return result.length > 0;
  }
}