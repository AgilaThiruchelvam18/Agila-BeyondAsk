/**
 * Document Processing Service
 * Handles asynchronous document content extraction and processing
 */

import { storage } from '../storage';
import { Document, DocumentStatus } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

export interface ProcessingResult {
  success: boolean;
  content?: string;
  error?: string;
  extractedLength?: number;
}

export class DocumentProcessor {
  /**
   * Process a document by extracting its content based on file type
   */
  static async processDocument(documentId: number): Promise<ProcessingResult> {
    try {
      console.log(`DocumentProcessor: Starting processing for document ${documentId}`);
      
      // Get the document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      let extractedContent = '';

      // Handle different document types
      if (document.sourceType === 'text' && document.content) {
        // Text documents already have content - use directly
        extractedContent = document.content;
        console.log(`DocumentProcessor: Using existing content for text document (${extractedContent.length} characters)`);
      } else if (document.sourceType === 'url' && document.sourceUrl) {
        // URL documents - use title and URL for now
        extractedContent = `Web Content: ${document.title}\n\nSource URL: ${document.sourceUrl}\n\nThis web content document has been created and is ready for processing.`;
        console.log(`DocumentProcessor: Generated content for URL document`);
      } else if (document.filePath) {
        // File-based documents
        if (!fs.existsSync(document.filePath)) {
          return { success: false, error: 'File not found on disk' };
        }

        // Extract content based on file type
        const fileExtension = path.extname(document.filePath).toLowerCase();
        const metadata = document.metadata as any;
        const mimeType = metadata?.mimeType || '';

        if (fileExtension === '.txt' || mimeType === 'text/plain') {
          // Text files - direct read
          extractedContent = fs.readFileSync(document.filePath, 'utf8');
          console.log(`DocumentProcessor: Extracted ${extractedContent.length} characters from text file`);
        } else if (fileExtension === '.pdf' || mimeType === 'application/pdf') {
          // PDF files - placeholder for now
          extractedContent = `PDF Document: ${document.title}\n\nThis PDF document has been uploaded and is ready for processing. Advanced PDF text extraction can be implemented with pdf-parse or similar libraries.`;
          console.log(`DocumentProcessor: Generated placeholder content for PDF file`);
        } else if (['.doc', '.docx'].includes(fileExtension) || mimeType.includes('word')) {
          // Word documents - placeholder for now
          extractedContent = `Word Document: ${document.title}\n\nThis Word document has been uploaded and is ready for processing. Advanced Word document extraction can be implemented with mammoth or similar libraries.`;
          console.log(`DocumentProcessor: Generated placeholder content for Word document`);
        } else {
          // Other file types
          extractedContent = `Document: ${document.title}\n\nFile Type: ${fileExtension || 'Unknown'}\nMIME Type: ${mimeType || 'Unknown'}\nSize: ${document.fileSize} bytes\n\nThis document has been uploaded and is available for processing.`;
          console.log(`DocumentProcessor: Generated generic content for file type ${fileExtension}`);
        }
      } else {
        return { success: false, error: 'No content or file path available for processing' };
      }

      // Update document with extracted content
      const existingMetadata = (document.metadata as Record<string, any>) || {};
      await storage.updateDocument(documentId, {
        status: 'completed',
        content: extractedContent,
        metadata: {
          ...existingMetadata,
          processedAt: new Date().toISOString(),
          contentLength: extractedContent.length,
          processed: true,
          processingMethod: 'document-processor-service'
        }
      });

      console.log(`DocumentProcessor: Document ${documentId} processing completed successfully`);
      
      return {
        success: true,
        content: extractedContent,
        extractedLength: extractedContent.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      console.error(`DocumentProcessor: Error processing document ${documentId}:`, errorMessage);
      
      // Update document status to failed
      try {
        await storage.updateDocument(documentId, {
          status: 'failed',
          metadata: {
            error: errorMessage,
            failedAt: new Date().toISOString(),
            processingMethod: 'document-processor-service'
          }
        });
      } catch (updateError) {
        console.error(`DocumentProcessor: Failed to update document status for ${documentId}:`, updateError);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Process all pending documents (useful for startup recovery)
   */
  static async processPendingDocuments(): Promise<void> {
    try {
      console.log('DocumentProcessor: Checking for pending documents...');
      
      // Get all documents with 'processing' status
      const pendingDocs = await storage.getDocumentsByStatus('processing');
      
      if (pendingDocs.length === 0) {
        console.log('DocumentProcessor: No pending documents found');
        return;
      }

      console.log(`DocumentProcessor: Found ${pendingDocs.length} pending documents`);
      
      // Process each document
      for (const doc of pendingDocs) {
        console.log(`DocumentProcessor: Processing pending document ${doc.id}`);
        await this.processDocument(doc.id);
        // Add small delay between processing to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('DocumentProcessor: Finished processing pending documents');
    } catch (error) {
      console.error('DocumentProcessor: Error processing pending documents:', error);
    }
  }

  /**
   * Reprocess a specific document (useful for manual reprocessing)
   */
  static async reprocessDocument(documentId: number): Promise<ProcessingResult> {
    try {
      // Set status back to processing
      await storage.updateDocument(documentId, {
        status: 'processing',
        metadata: {
          reprocessingStarted: new Date().toISOString()
        }
      });

      // Process the document
      return await this.processDocument(documentId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown reprocessing error';
      console.error(`DocumentProcessor: Error reprocessing document ${documentId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}