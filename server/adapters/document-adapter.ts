import { eq, and, sql, count, inArray, desc, asc, or, like, gte, lte } from 'drizzle-orm';
import { Document, InsertDocument, documents } from '../../shared/schema';
import { BaseAdapter } from './base-adapter';
import { IDocumentStorage } from '../interfaces/document-storage';

/**
 * Optimized Document Domain Adapter
 * Handles all document-related database operations with consistent error handling,
 * detailed logging, and zero code duplication
 */
export class DocumentAdapter extends BaseAdapter implements IDocumentStorage {
  
  /**
   * Get a single document by ID
   */
  async getDocument(id: string | number): Promise<Document | undefined> {
    return this.executeQuery(
      'getDocument',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.select()
          .from(documents)
          .where(eq(documents.id, numericId))
          .limit(1);
        return results[0];
      },
      { id }
    );
  }

  /**
   * Get all documents for a knowledge base
   */
  async getDocumentsByKnowledgeBaseId(kbId: string | number): Promise<Document[]> {
    return this.executeQuery(
      'getDocumentsByKnowledgeBaseId',
      async () => {
        const numericId = this.validateId(kbId);
        return await this.db.select()
          .from(documents)
          .where(eq(documents.knowledgeBaseId, numericId))
          .orderBy(desc(documents.createdAt));
      },
      { kbId }
    );
  }

  /**
   * Create a new document
   */
  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    return this.executeQuery(
      'createDocument',
      async () => {
        const docData = {
          title: insertDoc.title,
          content: insertDoc.content || null,
          sourceType: insertDoc.sourceType,
          knowledgeBaseId: insertDoc.knowledgeBaseId,
          status: insertDoc.status || 'pending',
          userId: insertDoc.userId,
          sourceUrl: insertDoc.sourceUrl || null,
          description: insertDoc.description || null,
          metadata: insertDoc.metadata || {},
          tags: (insertDoc.tags || []) as string[],
          fileSize: insertDoc.fileSize || null,
          filePath: insertDoc.filePath || null,
          isS3: insertDoc.isS3 || false,
          processingInfo: null,
          embeddingIds: "[]",
          customFields: {}
        };
        
        const results = await this.db.insert(documents)
          .values([docData as any])
          .returning();
        return results[0];
      },
      { title: insertDoc.title, kbId: insertDoc.knowledgeBaseId }
    );
  }

  /**
   * Update an existing document
   */
  async updateDocument(id: string | number, docData: Partial<Document>): Promise<Document | undefined> {
    return this.executeQuery(
      'updateDocument',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.update(documents)
          .set(docData)
          .where(eq(documents.id, numericId))
          .returning();
        return results[0];
      },
      { id, fieldsToUpdate: Object.keys(docData) }
    );
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteDocument',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.delete(documents)
          .where(eq(documents.id, numericId))
          .returning();
        return results.length > 0;
      },
      { id }
    );
  }

  /**
   * Get multiple documents by IDs (batch operation)
   */
  async getDocumentsByIds(ids: number[]): Promise<Document[]> {
    return this.executeQuery(
      'getDocumentsByIds',
      async () => {
        if (ids.length === 0) return [];
        return await this.db.select()
          .from(documents)
          .where(inArray(documents.id, ids));
      },
      { count: ids.length }
    );
  }

  /**
   * Get documents by status
   */
  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return this.executeQuery(
      'getDocumentsByStatus',
      async () => {
        return await this.db.select()
          .from(documents)
          .where(eq(documents.status, status))
          .orderBy(desc(documents.createdAt));
      },
      { status }
    );
  }

  /**
   * Update document processing status
   */
  async updateDocumentProcessingStatus(id: string | number, status: string, metadata?: any): Promise<Document | undefined> {
    return this.executeQuery(
      'updateDocumentProcessingStatus',
      async () => {
        const numericId = this.validateId(id);
        const updateData: Partial<Document> = { status };
        if (metadata) {
          updateData.metadata = metadata;
        }
        
        const results = await this.db.update(documents)
          .set(updateData)
          .where(eq(documents.id, numericId))
          .returning();
        return results[0];
      },
      { id, status }
    );
  }

  /**
   * Search documents with filters
   */
  async searchDocuments(params: {
    knowledgeBaseId?: number;
    query?: string;
    status?: string;
    sourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Document[]> {
    return this.executeQuery(
      'searchDocuments',
      async () => {
        const { knowledgeBaseId, query, status, sourceType, limit = 50, offset = 0 } = params;
        
        let conditions = [];
        
        if (knowledgeBaseId) {
          conditions.push(eq(documents.knowledgeBaseId, knowledgeBaseId));
        }
        
        if (query) {
          conditions.push(
            or(
              like(documents.title, `%${query}%`),
              like(documents.description, `%${query}%`),
              like(documents.content, `%${query}%`)
            )
          );
        }
        
        if (status) {
          conditions.push(eq(documents.status, status));
        }
        
        if (sourceType) {
          conditions.push(eq(documents.sourceType, sourceType));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        return await this.db.select()
          .from(documents)
          .where(whereClause)
          .orderBy(desc(documents.createdAt))
          .limit(limit)
          .offset(offset);
      },
      params
    );
  }

  /**
   * Get document count by type for a knowledge base
   */
  async getDocumentsByType(kbId: string | number): Promise<Record<string, number>> {
    return this.executeQuery(
      'getDocumentsByType',
      async () => {
        const numericId = this.validateId(kbId);
        const results = await this.db.select({
          sourceType: documents.sourceType,
          count: count()
        })
          .from(documents)
          .where(eq(documents.knowledgeBaseId, numericId))
          .groupBy(documents.sourceType);
        
        const documentsByType: Record<string, number> = {};
        results.forEach(row => {
          documentsByType[row.sourceType] = row.count;
        });
        
        return documentsByType;
      },
      { kbId }
    );
  }

  /**
   * Get document processing statistics
   */
  async getDocumentProcessingStats(kbId: string | number): Promise<{
    total: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return this.executeQuery(
      'getDocumentProcessingStats',
      async () => {
        const numericId = this.validateId(kbId);
        
        // Get total count
        const totalResult = await this.db.select({ count: count() })
          .from(documents)
          .where(eq(documents.knowledgeBaseId, numericId));
        
        // Get status breakdown
        const statusResults = await this.db.select({
          status: documents.status,
          count: count()
        })
          .from(documents)
          .where(eq(documents.knowledgeBaseId, numericId))
          .groupBy(documents.status);
        
        const stats = {
          total: totalResult[0]?.count || 0,
          processing: 0,
          completed: 0,
          failed: 0
        };
        
        statusResults.forEach(row => {
          const status = row.status || 'completed';
          if (status === 'processing') {
            stats.processing = row.count;
          } else if (status === 'completed') {
            stats.completed = row.count;
          } else if (status === 'failed') {
            stats.failed = row.count;
          }
        });
        
        return stats;
      },
      { kbId }
    );
  }

  /**
   * Update document content and chunks
   */
  async updateDocumentContent(id: string | number, content: string, chunks?: any[]): Promise<Document | undefined> {
    return this.executeQuery(
      'updateDocumentContent',
      async () => {
        const numericId = this.validateId(id);
        const updateData: Partial<Document> = { 
          content,
          status: 'completed',
          updatedAt: new Date()
        };
        
        const results = await this.db.update(documents)
          .set(updateData)
          .where(eq(documents.id, numericId))
          .returning();
        return results[0];
      },
      { id, contentLength: content?.length || 0 }
    );
  }

  /**
   * Get recent documents for a knowledge base
   */
  async getRecentDocuments(kbId: string | number, limit: number = 5): Promise<Document[]> {
    return this.executeQuery(
      'getRecentDocuments',
      async () => {
        const numericId = this.validateId(kbId);
        return await this.db.select()
          .from(documents)
          .where(eq(documents.knowledgeBaseId, numericId))
          .orderBy(desc(documents.createdAt))
          .limit(limit);
      },
      { kbId, limit }
    );
  }
}