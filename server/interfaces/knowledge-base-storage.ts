import { KnowledgeBase, InsertKnowledgeBase } from '@shared/schema';

/**
 * Knowledge Base Storage Interface
 * Defines all knowledge base-related database operations with consistent signatures
 */
export interface IKnowledgeBaseStorage {
  // Core CRUD operations
  getKnowledgeBase(id: string | number): Promise<KnowledgeBase | undefined>;
  getKnowledgeBasesByUserId(userId: string | number): Promise<KnowledgeBase[]>;
  createKnowledgeBase(insertKb: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBase(id: string | number, kbData: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBase(id: string | number): Promise<boolean>;
  
  // Dependency management
  getKnowledgeBaseDependencies(id: string | number): Promise<{ 
    documents: number;
    agents: number;
    unansweredQuestions: number;
  }>;
  
  // Cascade operations
  cascadeDeleteKnowledgeBase(id: string | number): Promise<boolean>;
  
  // Helper operations
  getKnowledgeBaseDocumentCount(kbId: string | number): Promise<number>;
}