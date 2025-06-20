/**
 * Document Management Routes
 * Handles document CRUD operations and file processing
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError, sendNotFound } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

/**
 * Get documents for a knowledge base
 */
router.get('/knowledge-base/:kbId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId, 10);
    if (isNaN(kbId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    // Verify knowledge base exists and user has access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase) {
      return sendNotFound(res, 'Knowledge base');
    }

    if (knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    const documents = await storage.getDocumentsByKnowledgeBaseId(kbId);
    console.log(`GET /api/documents/knowledge-base/${kbId}: Returning ${documents.length} documents`);
    
    return res.json(documents);

  } catch (error) {
    console.error('Error fetching documents:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch documents', 500);
  }
});

/**
 * Get single document by ID
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return sendNotFound(res, 'Document');
    }

    // Verify user has access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(document.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    return res.json(document);

  } catch (error) {
    console.error('Error fetching document:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch document', 500);
  }
});

/**
 * Create new document
 */
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { title, description, sourceType, content, knowledgeBaseId, tags, metadata } = req.body;

    if (!title || !sourceType || !knowledgeBaseId) {
      return sendError(res, 'Title, source type, and knowledge base ID are required', 400);
    }

    // Verify knowledge base exists and user has access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    const newDocument = await storage.createDocument({
      userId: parseInt(userId),
      title,
      description: description || null,
      sourceType,
      content: content || '',
      knowledgeBaseId,
      tags: tags || null,
      metadata: metadata || null,
      size: content ? content.length : 0,
      chunkCount: 0,
      embeddingIds: null,
    });

    console.log(`Created new document: ${newDocument.title} (ID: ${newDocument.id}) in KB ${knowledgeBaseId}`);
    return res.status(201).json(newDocument);

  } catch (error) {
    console.error('Error creating document:', getErrorMessage(error));
    return sendError(res, 'Failed to create document', 500);
  }
});

/**
 * Update existing document
 */
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    // Check if document exists and user has access
    const existingDocument = await storage.getDocument(documentId);
    if (!existingDocument) {
      return sendNotFound(res, 'Document');
    }

    const knowledgeBase = await storage.getKnowledgeBase(existingDocument.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    const { title, description, content, tags, metadata } = req.body;

    const updatedDocument = await storage.updateDocument(documentId, {
      title: title || existingDocument.title,
      description: description !== undefined ? description : existingDocument.description,
      content: content !== undefined ? content : existingDocument.content,
      tags: tags !== undefined ? tags : existingDocument.tags,
      metadata: metadata !== undefined ? metadata : existingDocument.metadata,
      size: content ? content.length : existingDocument.size,
    });

    if (!updatedDocument) {
      return sendError(res, 'Failed to update document', 500);
    }

    console.log(`Updated document: ${updatedDocument.title} (ID: ${updatedDocument.id})`);
    return res.json(updatedDocument);

  } catch (error) {
    console.error('Error updating document:', getErrorMessage(error));
    return sendError(res, 'Failed to update document', 500);
  }
});

/**
 * Delete document
 */
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    // Check if document exists and user has access
    const existingDocument = await storage.getDocument(documentId);
    if (!existingDocument) {
      return sendNotFound(res, 'Document');
    }

    const knowledgeBase = await storage.getKnowledgeBase(existingDocument.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    const deleted = await storage.deleteDocument(documentId);
    if (!deleted) {
      return sendError(res, 'Failed to delete document', 500);
    }

    console.log(`Deleted document: ${existingDocument.title} (ID: ${documentId})`);
    return res.json({ message: 'Document deleted successfully', id: documentId });

  } catch (error) {
    console.error('Error deleting document:', getErrorMessage(error));
    return sendError(res, 'Failed to delete document', 500);
  }
});

export default router;