import { Document, InsertDocument } from '../../shared/schema';

/**
 * Document Storage Interface
 * Defines all document-related database operations with consistent signatures
 */
export interface IDocumentStorage {
  // Core CRUD operations
  getDocument(id: string | number): Promise<Document | undefined>;
  getDocumentsByKnowledgeBaseId(kbId: string | number): Promise<Document[]>;
  createDocument(insertDoc: InsertDocument): Promise<Document>;
  updateDocument(id: string | number, docData: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string | number): Promise<boolean>;
  
  // Batch operations
  getDocumentsByIds(ids: number[]): Promise<Document[]>;
  updateDocumentProcessingStatus(id: string | number, status: string, metadata?: any): Promise<Document | undefined>;
  
  // Search and filtering
  searchDocuments(params: {
    knowledgeBaseId?: number;
    query?: string;
    status?: string;
    sourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Document[]>;
  
  // Analytics and metrics
  getDocumentsByType(kbId: string | number): Promise<Record<string, number>>;
  getDocumentProcessingStats(kbId: string | number): Promise<{
    total: number;
    processing: number;
    completed: number;
    failed: number;
  }>;
  
  // Content management
  updateDocumentContent(id: string | number, content: string, chunks?: any[]): Promise<Document | undefined>;
  getRecentDocuments(kbId: string | number, limit?: number): Promise<Document[]>;
}