/**
 * Document Recovery Routes
 * Handles processing of stuck documents and recovery operations
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth-middleware';
import { DocumentProcessor } from '../services/document-processor';
import { storage } from '../storage';

const router = Router();

function sendError(res: Response, message: string, statusCode: number = 500): Response {
  return res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}

// Process all stuck documents
router.post('/documents/process-stuck', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    console.log('POST /api/documents/process-stuck: Processing stuck documents');

    // Get all documents with "processing" status
    const stuckDocuments = await storage.getDocumentsByStatus('processing');
    
    if (stuckDocuments.length === 0) {
      return res.json({
        success: true,
        message: 'No stuck documents found',
        processedCount: 0
      });
    }

    console.log(`Found ${stuckDocuments.length} stuck documents to process`);

    const results = [];
    
    // Process each stuck document
    for (const doc of stuckDocuments) {
      try {
        console.log(`Processing stuck document ${doc.id}: ${doc.title}`);
        const result = await DocumentProcessor.processDocument(doc.id);
        
        results.push({
          id: doc.id,
          title: doc.title,
          success: result.success,
          message: result.success ? 'Processed successfully' : result.error
        });
        
        // Add small delay between processing
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        results.push({
          id: doc.id,
          title: doc.title,
          success: false,
          message: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return res.json({
      success: true,
      message: `Processed ${successCount} of ${stuckDocuments.length} stuck documents`,
      processedCount: successCount,
      totalFound: stuckDocuments.length,
      results
    });

  } catch (error) {
    console.error('Error processing stuck documents:', error);
    return sendError(res, 'Failed to process stuck documents', 500);
  }
});

// Reprocess a specific document
router.post('/documents/:id/reprocess', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`POST /api/documents/${documentId}/reprocess: Reprocessing document`);

    // Check if document exists and user has access
    const document = await storage.getDocument(documentId);
    if (!document) {
      return sendError(res, 'Document not found', 404);
    }

    // Verify access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(document.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    // Reprocess the document
    const result = await DocumentProcessor.reprocessDocument(documentId);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Document reprocessed successfully',
        documentId,
        extractedLength: result.extractedLength
      });
    } else {
      return sendError(res, result.error || 'Reprocessing failed', 500);
    }

  } catch (error) {
    console.error('Error reprocessing document:', error);
    return sendError(res, 'Failed to reprocess document', 500);
  }
});

export default router;