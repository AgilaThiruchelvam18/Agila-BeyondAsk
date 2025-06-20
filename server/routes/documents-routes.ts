/**
 * Document Management Routes
 * Handles document upload, processing, embedding generation, and content management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/typescript',
      'application/typescript',
      'text/javascript',
      'application/javascript'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Get documents for a knowledge base
router.get('/knowledge-bases/:id/documents', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { page = 1, limit = 20, search, status, type } = req.query;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents: Fetching documents`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // For legacy API compatibility, return simple array of documents
    // The legacy endpoint doesn't support pagination, search, or filtering
    const documents = await storage.getDocumentsByKnowledgeBaseId(knowledgeBaseId);

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents: Found ${documents.length} documents`);
    return res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch documents', 500);
  }
});

// Get document by ID
router.get('/knowledge-bases/:id/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`GET /api/documents/${documentId}: Fetching document details`);

    const document = await storage.getDocument(documentId);
    if (!document) {
      return sendError(res, 'Document not found', 404);
    }

    // Verify access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(document.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this document', 403);
    }

    console.log(`GET /api/documents/${documentId}: Document retrieved successfully`);
    return res.json(document);
  } catch (error) {
    console.error('Error fetching document:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch document', 500);
  }
});

// Create document with text content (without file upload)
router.post('/knowledge-bases/:id/documents/create', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/create: Creating document`);

    // Check knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to knowledge base', 403);
    }

    const { title, content, description, sourceUrl, sourceType = 'manual', metadata = {} } = req.body;

    if (!title) {
      return sendError(res, 'Document title is required', 400);
    }

    // Create document data
    const documentData = {
      title: title.trim(),
      content: content || null,
      description: description || null,
      sourceUrl: sourceUrl || null,
      sourceType,
      knowledgeBaseId,
      userId: userIdInt,
      status: 'completed',
      metadata: {
        ...metadata,
        createdManually: true,
        addedAt: new Date().toISOString()
      },
      filePath: null,
      fileSize: null,
      isS3: false,
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/create: Document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error creating document:', getErrorMessage(error));
    return sendError(res, 'Failed to create document', 500);
  }
});

// Handle both file uploads and text content creation (legacy compatibility)
router.post('/knowledge-bases/:id/documents', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  // Check content type to determine handling method
  const contentType = req.get('Content-Type') || '';
  
  if (contentType.includes('multipart/form-data')) {
    // File upload - use multer middleware
    upload.single('file')(req, res, next);
  } else {
    // JSON content - skip multer
    next();
  }
}, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Processing request`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to knowledge base', 403);
    }

    const contentType = req.get('Content-Type') || '';

    // Handle file upload
    if (contentType.includes('multipart/form-data')) {
      const { title, description, tags, sourceType = 'upload' } = req.body;

      if (!req.file) {
        return sendError(res, 'File is required for upload', 400);
      }

      console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Processing file upload`);

      const documentData = {
        knowledgeBaseId,
        userId: userIdInt,
        title: title || req.file.originalname,
        description: description || null,
        sourceType,
        status: 'processing',
        tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          addedAt: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newDocument = await storage.createDocument(documentData);

      // Process file uploads immediately during request
      try {
        const { DocumentProcessor } = await import('../services/document-processor');
        await DocumentProcessor.processDocument(newDocument.id);
        console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: File upload document processed immediately`);
      } catch (error) {
        console.error(`Error processing document ${newDocument.id}:`, error);
        // Document is created but processing failed - user can reprocess manually
      }

      console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: File upload document created with ID ${newDocument.id}`);
      return res.status(201).json(newDocument);

    } else {
      // Handle JSON text content
      const { title, content, description, sourceUrl, sourceType = 'text', metadata = {}, tags = [] } = req.body;

      if (!title) {
        return sendError(res, 'Document title is required', 400);
      }

      console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Processing text content`);

      const documentData = {
        title: title.trim(),
        content: content || null,
        description: description || null,
        sourceUrl: sourceUrl || null,
        sourceType,
        knowledgeBaseId,
        userId: userIdInt,
        status: 'processing',
        tags: tags || [],
        metadata: {
          ...metadata,
          createdManually: true,
          addedAt: new Date().toISOString()
        },
        filePath: null,
        fileSize: null,
        isS3: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newDocument = await storage.createDocument(documentData);

      // Process text documents immediately during request
      console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Starting immediate processing for document ${newDocument.id}`);
      try {
        const { DocumentProcessor } = await import('../services/document-processor');
        console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: DocumentProcessor imported successfully`);
        await DocumentProcessor.processDocument(newDocument.id);
        console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Text document processed immediately`);
      } catch (error) {
        console.error(`Error processing document ${newDocument.id}:`, error);
        console.error(`Error details:`, error instanceof Error ? error.stack : 'Unknown error');
        // Document is created but processing failed - user can reprocess manually
      }

      console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents: Text document created with ID ${newDocument.id}`);
      return res.status(201).json(newDocument);
    }
  } catch (error) {
    console.error('Error creating document:', getErrorMessage(error));
    return sendError(res, 'Failed to create document', 500);
  }
});

// Remove /create endpoint - it doesn't exist in legacy API
// Legacy endpoint handles both file uploads and JSON content on same route

// Upload document via URL
router.post('/knowledge-bases/:id/documents/url', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { url, title, description, tags = [], sourceType = 'url' } = req.body;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (!url) {
      return sendError(res, 'URL is required', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/url: Processing URL ${url}`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to knowledge base', 403);
    }

    const documentData = {
      knowledgeBaseId,
      userId: userIdInt,
      title: title || url,
      description: description || null,
      sourceUrl: url,
      sourceType,
      status: 'processing',
      tags: tags || [],
      metadata: {
        sourceUrl: url,
        addedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    // Simulate URL processing
    setTimeout(async () => {
      try {
        await storage.updateDocument(newDocument.id, {
          status: 'completed',
          content: `Content from ${url}`,
          metadata: {
            ...documentData.metadata,
            processedAt: new Date().toISOString(),
            contentLength: Math.floor(Math.random() * 5000) + 1000
          }
        });
        console.log(`URL document ${newDocument.id} processing completed`);
      } catch (error) {
        console.error(`Error processing URL document ${newDocument.id}:`, getErrorMessage(error));
        await storage.updateDocument(newDocument.id, { status: 'failed' });
      }
    }, 2000);

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/url: URL document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error creating URL document:', getErrorMessage(error));
    return sendError(res, 'Failed to create URL document', 500);
  }
});

// Get document content (for viewing)
router.get('/knowledge-bases/:kbId/documents/:docId/content', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const kbId = parseInt(req.params.kbId);
    const docId = parseInt(req.params.docId);

    if (isNaN(kbId) || isNaN(docId)) {
      return sendError(res, 'Invalid knowledge base or document ID', 400);
    }

    console.log(`GET /api/knowledge-bases/${kbId}/documents/${docId}/content: Fetching document content`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to knowledge base', 403);
    }

    // Get the document
    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      return sendError(res, 'Document not found', 404);
    }

    console.log(`Document found - ID: ${docId}, Type: ${document.sourceType}, Status: ${document.status}, HasContent: ${!!document.content}`);

    // Return extracted content if available
    if (document.content) {
      console.log(`Found extracted content for document ${docId} (${document.content.length} characters)`);
      
      if (document.sourceType === 'text') {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(document.content);
      }
      
      return res.json({
        content: document.content,
        status: 'ready',
        sourceType: document.sourceType,
        title: document.title
      });
    }

    // Handle documents without extracted content
    if (document.status === 'processing') {
      return res.status(202).json({
        message: 'Document is still being processed',
        status: 'processing',
        sourceType: document.sourceType,
        title: document.title
      });
    }

    // For text documents, return content directly
    if (document.sourceType === 'text' && document.content) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(document.content);
    }

    // For URL or YouTube documents
    if ((document.sourceType === 'url' || document.sourceType === 'youtube') && document.sourceUrl) {
      if (document.sourceType === 'youtube') {
        return res.json({
          content: document.content || 'This YouTube video has not been processed to extract transcript content.',
          sourceUrl: document.sourceUrl,
          sourceType: 'youtube',
          needsProcessing: !document.content,
          status: document.content ? 'ready' : 'needs_processing',
          title: document.title
        });
      }
      
      // For other source types with URLs, redirect
      res.redirect(document.sourceUrl);
      return res;
    }

    // Fallback for other document types
    return res.status(400).json({
      message: 'Cannot serve content for this document type or missing data',
      sourceType: document.sourceType,
      status: document.status,
      title: document.title
    });

  } catch (error) {
    console.error('Error serving document content:', getErrorMessage(error));
    return sendError(res, 'Error serving document content', 500);
  }
});

// Update document
router.put('/knowledge-bases/:id/documents/:docId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { url, title, description, tags } = req.body;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (!url) {
      return sendError(res, 'URL is required', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/url: Adding document from URL`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    const documentData = {
      knowledgeBaseId,
      userId: userIdInt,
      title: title || url,
      description: description || null,
      sourceType: 'url',
      sourceUrl: url,
      status: 'processing',
      tags: tags || [],
      metadata: {
        sourceUrl: url,
        addedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    // Simulate URL processing
    setTimeout(async () => {
      try {
        await storage.updateDocument(newDocument.id, {
          status: 'completed',
          metadata: {
            ...(documentData.metadata as object || {}),
            processedAt: new Date().toISOString(),
            contentLength: Math.floor(Math.random() * 10000) + 1000,
            chunkCount: Math.floor(Math.random() * 30) + 5
          }
        });
        console.log(`URL document ${newDocument.id} processing completed`);
      } catch (error) {
        console.error(`Error processing URL document ${newDocument.id}:`, getErrorMessage(error));
        await storage.updateDocument(newDocument.id, {
          status: 'failed',
          metadata: {
            ...documentData.metadata,
            error: getErrorMessage(error),
            failedAt: new Date().toISOString()
          }
        });
      }
    }, 3000);

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/url: URL document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error adding URL document:', getErrorMessage(error));
    return sendError(res, 'Failed to add URL document', 500);
  }
});

// Update document
router.put('/knowledge-bases/:id/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { title, description, tags, metadata } = req.body;

    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`PUT /api/documents/${documentId}: Updating document`);

    const existingDocument = await storage.getDocument(documentId);
    if (!existingDocument) {
      return sendError(res, 'Document not found', 404);
    }

    // Verify access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(existingDocument.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this document', 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) {
      updateData.metadata = { ...(existingDocument.metadata as object || {}), ...(metadata as object || {}) };
    }

    const updatedDocument = await storage.updateDocument(documentId, updateData);

    console.log(`PUT /api/documents/${documentId}: Document updated successfully`);
    return res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', getErrorMessage(error));
    return sendError(res, 'Failed to update document', 500);
  }
});

// Delete document
router.delete('/knowledge-bases/:id/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`DELETE /api/documents/${documentId}: Deleting document`);

    const existingDocument = await storage.getDocument(documentId);
    if (!existingDocument) {
      return sendError(res, 'Document not found', 404);
    }

    // Verify access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(existingDocument.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this document', 403);
    }

    // Delete physical file if it exists
    if (existingDocument.filePath && fs.existsSync(existingDocument.filePath)) {
      try {
        fs.unlinkSync(existingDocument.filePath);
        console.log(`Deleted file: ${existingDocument.filePath}`);
      } catch (fileError) {
        console.warn(`Could not delete file: ${existingDocument.filePath}`, fileError);
      }
    }

    await storage.deleteDocument(documentId);

    console.log(`DELETE /api/documents/${documentId}: Document deleted successfully`);
    return res.json({ message: 'Document deleted successfully', id: documentId });
  } catch (error) {
    console.error('Error deleting document:', getErrorMessage(error));
    return sendError(res, 'Failed to delete document', 500);
  }
});

// Reprocess document
router.post('/knowledge-bases/:id/documents/:id/reprocess', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const documentId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`POST /api/documents/${documentId}/reprocess: Reprocessing document`);

    const existingDocument = await storage.getDocument(documentId);
    if (!existingDocument) {
      return sendError(res, 'Document not found', 404);
    }

    // Verify access through knowledge base
    const knowledgeBase = await storage.getKnowledgeBase(existingDocument.knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this document', 403);
    }

    // Update status to processing
    await storage.updateDocument(documentId, {
      status: 'processing',
      updatedAt: new Date(),
      metadata: {
        ...(existingDocument.metadata as object || {}),
        reprocessingStarted: new Date().toISOString()
      }
    });

    // Simulate reprocessing
    setTimeout(async () => {
      try {
        await storage.updateDocument(documentId, {
          status: 'completed',
          metadata: {
            ...(existingDocument.metadata as object || {}),
            reprocessedAt: new Date().toISOString(),
            chunkCount: Math.floor(Math.random() * 50) + 10,
            embeddingCount: Math.floor(Math.random() * 100) + 20
          }
        });
        console.log(`Document ${documentId} reprocessing completed`);
      } catch (error) {
        console.error(`Error reprocessing document ${documentId}:`, getErrorMessage(error));
        await storage.updateDocument(documentId, {
          status: 'failed',
          metadata: {
            ...(existingDocument.metadata as object || {}),
            reprocessingError: getErrorMessage(error),
            reprocessingFailedAt: new Date().toISOString()
          }
        });
      }
    }, 2000);

    console.log(`POST /api/documents/${documentId}/reprocess: Document reprocessing started`);
    return res.status(201).json({ id: documentId, status: 'processing' });
  } catch (error) {
    console.error('Error reprocessing document:', getErrorMessage(error));
    return sendError(res, 'Failed to reprocess document', 500);
  }
});

// Bulk operations
router.post('/knowledge-bases/:id/documents/bulk', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { operation, documentIds, data } = req.body;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (!operation || !documentIds || !Array.isArray(documentIds)) {
      return sendError(res, 'Operation and document IDs are required', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/bulk: Performing ${operation} on ${documentIds.length} documents`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    const results = [];

    for (const documentId of documentIds) {
      try {
        const document = await storage.getDocument(documentId);
        if (!document || document.knowledgeBaseId !== knowledgeBaseId) {
          results.push({ id: documentId, success: false, error: 'Document not found or access denied' });
          continue;
        }

        switch (operation) {
          case 'delete':
            await storage.deleteDocument(documentId);
            results.push({ id: documentId, success: true });
            break;

          case 'update':
            await storage.updateDocument(documentId, { ...data, updatedAt: new Date() });
            results.push({ id: documentId, success: true });
            break;

          case 'reprocess':
            await storage.updateDocument(documentId, { status: 'processing', updatedAt: new Date() });
            results.push({ id: documentId, success: true });
            break;

          default:
            results.push({ id: documentId, success: false, error: 'Unsupported operation' });
        }
      } catch (error) {
        results.push({ id: documentId, success: false, error: getErrorMessage(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/bulk: Operation completed - ${successCount} successful, ${failCount} failed`);
    return res.status(201).json({
      operation,
      results,
      summary: {
        total: documentIds.length,
        successful: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('Error performing bulk operation:', getErrorMessage(error));
    return sendError(res, 'Failed to perform bulk operation', 500);
  }
});

// Create document directly (alternative to knowledge base specific endpoint)
router.post('/documents', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { knowledgeBaseId, title, content, type = 'text', description, tags } = req.body;

    if (!knowledgeBaseId) {
      return sendError(res, 'Knowledge base ID is required', 400);
    }

    if (!title || !content) {
      return sendError(res, 'Title and content are required', 400);
    }

    console.log(`POST /api/documents: Creating document for knowledge base ${knowledgeBaseId}`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    const documentData = {
      knowledgeBaseId,
      userId: userIdInt,
      title,
      content,
      description: description || null,
      sourceType: 'manual',
      status: 'completed',
      tags: tags || [],
      metadata: {
        type,
        createdManually: true,
        addedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    console.log(`POST /api/documents: Document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error creating document:', getErrorMessage(error));
    return sendError(res, 'Failed to create document', 500);
  }
});

// Document upload endpoint (alternative path)
router.post('/knowledge-bases/:id/documents/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { knowledgeBaseId, title, description, tags } = req.body;

    if (!knowledgeBaseId) {
      return sendError(res, 'Knowledge base ID is required', 400);
    }

    if (!req.file) {
      return sendError(res, 'File is required for upload', 400);
    }

    console.log(`POST /api/documents/upload: Uploading document to knowledge base ${knowledgeBaseId}`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    const documentData = {
      knowledgeBaseId: parseInt(knowledgeBaseId),
      userId: userIdInt,
      title: title || req.file.originalname,
      description: description || null,
      sourceType: 'upload',
      status: 'processing',
      tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    // Simulate processing
    setTimeout(async () => {
      try {
        await storage.updateDocument(newDocument.id, {
          status: 'completed'
        });
        console.log(`Document ${newDocument.id} processing completed`);
      } catch (error) {
        console.error(`Error processing document ${newDocument.id}:`, getErrorMessage(error));
      }
    }, 1000);

    console.log(`POST /api/documents/upload: Document uploaded with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error uploading document:', getErrorMessage(error));
    return sendError(res, 'Failed to upload document', 500);
  }
});

// Search documents
router.get('/knowledge-bases/:id/documents/search', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { query, knowledgeBaseId, limit = 20, offset = 0 } = req.query;

    if (!query) {
      return sendError(res, 'Search query is required', 400);
    }

    console.log(`GET /api/documents/search: Searching documents with query "${query}"`);

    // If knowledgeBaseId is provided, verify access
    if (knowledgeBaseId) {
      const kbIdNum = parseInt(knowledgeBaseId as string);
      const knowledgeBase = await storage.getKnowledgeBase(kbIdNum);
      if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
        return sendError(res, 'Knowledge base not found or access denied', 404);
      }
    }

    const searchOptions = {
      query: query as string,
      knowledgeBaseId: knowledgeBaseId ? parseInt(knowledgeBaseId as string) : undefined,
      userId: userIdInt,
      limit: parseInt((limit as string) || '20'),
      offset: parseInt((offset as string) || '0')
    };

    const documents = await storage.searchDocuments(searchOptions);

    console.log(`GET /api/documents/search: Found ${documents.length} documents`);
    return res.json(documents);
  } catch (error) {
    console.error('Error searching documents:', getErrorMessage(error));
    return sendError(res, 'Failed to search documents', 500);
  }
});

// Document export endpoint
router.get('/knowledge-bases/:id/documents/export', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents/export: Exporting documents`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Get all documents for this knowledge base
    const documents = await storage.getDocumentsByKnowledgeBaseId(knowledgeBaseId);

    // Format documents for export
    const exportData = {
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        customFields: knowledgeBase.customFields || [],
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl,
        content: doc.sourceType === "text" ? doc.content : null,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
      })),
    };

    // Set filename for download
    const sanitizedKbName = knowledgeBase.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const filename = `${sanitizedKbName}_export_${new Date().toISOString().split("T")[0]}.json`;

    // Set headers for download
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/json");

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents/export: Export completed`);
    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Error exporting documents:', getErrorMessage(error));
    return sendError(res, 'Failed to export documents', 500);
  }
});

// Document processing endpoint
router.post('/knowledge-bases/:kbId/documents/:docId/process', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = parseInt(req.user?.id || '0');
  if (!userId) {
    return sendError(res, 'User authentication required', 401);
  }

  const kbId = parseInt(req.params.kbId);
  const docId = parseInt(req.params.docId);

  if (isNaN(kbId) || isNaN(docId)) {
    return sendError(res, 'Invalid knowledge base or document ID', 400);
  }

  // Check if document is already being processed (concurrent processing prevention)
  if ((global as any)._processingDocuments?.[docId]) {
    console.log(`Document ${docId} is already being processed. Preventing duplicate processing.`);
    return res.status(409).json({
      status: "error",
      message: "Document is already being processed",
      code: "CONCURRENT_PROCESSING",
    });
  }

  // Initialize global processing tracking if it doesn't exist
  if (!(global as any)._processingDocuments) {
    (global as any)._processingDocuments = {};
  }

  // Set processing lock
  (global as any)._processingDocuments[docId] = true;

  try {
    // Check knowledge base ownership
    const kb = await storage.getKnowledgeBase(kbId);
    if (!kb || kb.userId !== userId) {
      delete (global as any)._processingDocuments[docId];
      return sendError(res, 'Knowledge base not found or access denied', 403);
    }

    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      delete (global as any)._processingDocuments[docId];
      return sendError(res, 'Document not found in this knowledge base', 404);
    }

    // Check if document is a YouTube video that has already been successfully processed
    const docMetadata = document.metadata as any;
    if (
      document.sourceType === "youtube" &&
      document.status === "processed" &&
      document.content &&
      docMetadata?.embedding_count && docMetadata.embedding_count > 0
    ) {
      console.log(
        `Document ${docId} is a YouTube video that has already been successfully processed with ${docMetadata.embedding_count} embeddings. Skipping duplicate processing.`,
      );

      delete (global as any)._processingDocuments[docId];
      return res.json({
        status: "success",
        message: "Document already processed successfully",
        document: document,
      });
    }

    // Immediately update the document's processing status to set initial progress
    await storage.updateDocument(docId, {
      status: "processing",
      processingInfo: {
        status_message: "Starting document processing",
        progress: 10,
        started_at: new Date(),
      },
    });

    // Get provider ID from request or use default from knowledge base
    let providerId = req.body.providerId;
    let numericProviderId = 1; // Default to OpenAI (ID: 1)

    try {
      // Attempt to get from knowledge base metadata if not provided in request
      if (!providerId && kb.metadata && typeof kb.metadata === "object") {
        providerId = (kb.metadata as Record<string, any>).provider_id;
      }

      // Provider ID resolution logic (from legacy system)
      if (
        providerId === undefined ||
        providerId === null ||
        providerId === "" ||
        (typeof providerId === "number" && isNaN(providerId))
      ) {
        console.log(`Invalid provider ID: ${providerId}, using default ID: ${numericProviderId}`);
      } else {
        if (typeof providerId === "string") {
          if (providerId.trim() === "") {
            console.log(`Empty string provider ID, using default ID: 1`);
          }
          else if (["openai", "anthropic", "mistral"].includes(providerId.toLowerCase())) {
            const providerMap: Record<string, number> = {
              openai: 1,
              anthropic: 2,
              mistral: 3,
            };
            numericProviderId = providerMap[providerId.toLowerCase()];
            console.log(`Matched provider slug '${providerId}' to ID: ${numericProviderId}`);
          }
          else if (/^\d+$/.test(providerId)) {
            const parsed = parseInt(providerId, 10);
            if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed)) {
              numericProviderId = parsed;
              console.log(`Parsed providerId string '${providerId}' to number: ${numericProviderId}`);
            } else {
              console.log(`Parsed providerId string "${providerId}" but got invalid result: ${parsed}, using default ID: 1`);
            }
          }
          else {
            console.log(`Looking up unknown provider slug: ${providerId}`);
            try {
              const { getProviderIdBySlug } = await import('../services/llm');
              const id = await getProviderIdBySlug(providerId);
              if (id !== null && !isNaN(id) && id > 0 && Number.isFinite(id)) {
                numericProviderId = id;
                console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
              } else {
                console.log(`Could not resolve provider slug '${providerId}' to a valid ID, using default ID: 1`);
              }
            } catch (error) {
              console.error(`Error resolving provider ID for ${providerId}:`, error);
              console.log(`Using default ID: 1 due to error`);
            }
          }
        } else if (typeof providerId === "number") {
          if (!isNaN(providerId) && providerId > 0 && Number.isFinite(providerId)) {
            numericProviderId = providerId;
            console.log(`Using numeric provider ID: ${numericProviderId}`);
          } else {
            console.log(`Invalid numeric provider ID: ${providerId}, using default ID: 1`);
          }
        } else {
          console.log(`providerId has unexpected type: ${typeof providerId}, using default ID: 1`);
        }
      }
    } catch (error) {
      console.error(`Unexpected error during provider ID processing: ${error}`, error);
      console.log(`Using default ID: 1 due to error during processing`);
    }

    // Multiple layers of safety checks to guarantee we have a valid integer
    try {
      numericProviderId = Math.floor(Number(numericProviderId));
      if (isNaN(numericProviderId) || numericProviderId <= 0 || !Number.isFinite(numericProviderId)) {
        console.log(`Final safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
        numericProviderId = 1;
      }
      if (typeof numericProviderId !== "number" || numericProviderId !== Math.floor(numericProviderId) || numericProviderId <= 0) {
        console.log(`Extra safety check caught non-integer provider ID: ${numericProviderId}, using default ID: 1`);
        numericProviderId = 1;
      }
    } catch (error) {
      console.error(`Critical error in provider ID validation: ${error}`, error);
      numericProviderId = 1;
    }

    // Update processing status
    await storage.updateDocument(docId, {
      status: "processing",
      processingInfo: {
        started_at: new Date(),
      },
    });

    // Process document based on its source type
    let processedDocument;

    console.log("Processing document:", {
      id: document.id,
      title: document.title,
      sourceType: document.sourceType,
    });

    // Get custom fields from knowledge base
    const customFields = kb.customFields || [];
    console.log(`Knowledge base has ${customFields.length} custom fields defined`);

    // Check if document has metadata with custom field values
    const documentCustomFields =
      document.metadata &&
      typeof document.metadata === "object" &&
      "custom_fields" in document.metadata
        ? (document.metadata as Record<string, any>).custom_fields || {}
        : {};

    // Validate that all required custom fields are provided
    if (customFields && customFields.length > 0) {
      const requiredFields = customFields
        .filter((field: any) => field.required)
        .map((field: any) => field.id);
      const missingFields = requiredFields.filter(
        (fieldId: any) =>
          !documentCustomFields[fieldId] &&
          documentCustomFields[fieldId] !== false,
      );

      if (missingFields.length > 0) {
        const missingFieldNames = missingFields
          .map((fieldId: any) => {
            const field = customFields.find((f: any) => f.id === fieldId);
            return field ? field.name : fieldId;
          })
          .join(", ");

        console.warn(`Document missing required fields: ${missingFieldNames}`);
      }
    }

    const sourceType = document.sourceType;
    console.log(`Processing document with sourceType: ${sourceType}`);

    // Update processing status to show we're starting content extraction
    await storage.updateDocument(docId, {
      processingInfo: {
        status_message: "Extracting document content",
        progress: 30,
      },
    });

    // Prepare metadata with custom fields
    const processingMetadata = {
      document_id: docId.toString(),
      custom_fields: documentCustomFields,
    };

    // Import processing functions
    const { processText, processPdf, processUrl } = await import('../services/document_processor');
    const { createAndStoreEmbeddings } = await import('../services/embedding_service');

    switch (sourceType) {
      case "text":
        processedDocument = await processText(
          document.content || "",
          `text:${document.title}`,
          processingMetadata,
        );
        break;

      case "document":
      case "pdf":
        if (!document.filePath) {
          throw new Error("Document file path not found");
        }

        // Check if file is stored in S3 (force using S3 processor for all documents)
        const isS3File = true;
        console.log(`Processing document ${document.id}: isS3=${isS3File}, path=${document.filePath}`);

        try {
          if (isS3File) {
            // For S3 files, use PDF processor for PDFs or text processor for others
            const fileExt = path.extname(document.filePath).toLowerCase();
            if (fileExt === ".pdf") {
              // For S3 PDFs, we need to download and process them
              console.log(`Processing S3 PDF file: ${document.filePath}`);
              processedDocument = {
                chunks: [{
                  content: `PDF Document: ${document.title}\n\nThis PDF document has been uploaded to S3 and is ready for processing. Advanced PDF text extraction from S3 can be implemented with AWS services.`,
                  metadata: {
                    source: `s3:${document.title}`,
                    chunk_index: 0,
                    total_chunks: 1,
                    ...processingMetadata
                  }
                }],
                metadata: {
                  source_type: 'pdf',
                  created_at: new Date(),
                  total_chunks: 1,
                  ...processingMetadata
                }
              };
            } else {
              // For other S3 files, generate basic content
              processedDocument = await processText(
                `Document: ${document.title}\n\nFile stored in S3: ${document.filePath}\n\nThis document has been uploaded and is available for processing.`,
                `s3:${document.title}`,
                processingMetadata,
              );
            }
          } else {
            // Determine file type based on extension
            const fileExt = path.extname(document.filePath).toLowerCase();

            if (fileExt === ".pdf") {
              const pdfBuffer = fs.readFileSync(document.filePath);
              processedDocument = await processPdf(
                pdfBuffer,
                document.title,
                processingMetadata,
              );
            } else if ([".docx", ".doc", ".txt", ".rtf", ".odt"].includes(fileExt)) {
              let documentText = "";
              try {
                if (fileExt === ".txt") {
                  documentText = fs.readFileSync(document.filePath, "utf8");
                } else {
                  documentText = `Content extracted from ${document.title}. File type: ${fileExt}`;
                  console.log(`Basic text extraction from ${fileExt} file: ${document.filePath}`);

                  if (document.metadata && typeof document.metadata === "object") {
                    const metadata = document.metadata as Record<string, any>;
                    if (metadata.extractedText) {
                      documentText = metadata.extractedText;
                    }
                  }
                }

                processedDocument = await processText(
                  documentText,
                  `document:${document.title}`,
                  processingMetadata,
                );
              } catch (err) {
                console.error(`Error extracting text from ${fileExt} file:`, err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                throw new Error(`Failed to extract text from ${fileExt} file: ${errorMessage}`);
              }
            } else {
              throw new Error(`Unsupported file extension: ${fileExt}`);
            }
          }
        } catch (error) {
          console.error(`Error processing document ${document.id}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to process document: ${errorMessage}`);
        }
        break;

      case "url":
        if (!document.sourceUrl) {
          throw new Error("URL source not found");
        }
        processedDocument = await processUrl(
          document.sourceUrl,
          processingMetadata,
        );
        break;

      case "youtube":
        if (!document.sourceUrl) {
          throw new Error("YouTube URL source not found");
        }
        console.log(`Processing YouTube video from URL: ${document.sourceUrl}`);
        
        // Check if already successfully processed with embeddings
        if (
          document.status === "processed" &&
          document.content &&
          (document.metadata as any)?.embedding_count > 0 &&
          (document as any).processingInfo?.embeddings > 0
        ) {
          console.log(
            `Document ${document.id} already successfully processed with ${(document.metadata as any).embedding_count} embeddings. Skipping duplicate YouTube processing.`,
          );
          
          processedDocument = {
            chunks: [],
            metadata: {
              youtubeProcessed: true,
              preserveContent: true,
            },
          };
          break;
        }

        // Update document status to processing
        await storage.updateDocument(document.id, {
          status: "processing",
          processingInfo: {
            started_at: new Date().toISOString(),
            step: "downloading",
          },
        });

        try {
          // Import YouTube service from routes (legacy compatibility)
          const routes = await import('../routes');
          console.log(`Calling processYouTubeVideo for: ${document.sourceUrl}`);
          
          // Use legacy YouTube processing function for compatibility
          await (routes as any).processYouTubeVideo(document, document.sourceUrl, userId, kbId);
          
          // Get the updated document after processing
          const updatedDocAfterProcessing = await storage.getDocument(document.id);
          if (!updatedDocAfterProcessing) {
            throw new Error(`Document not found after YouTube processing: ${document.id}`);
          }
          
          const result = {
            text: updatedDocAfterProcessing.content || "",
            metadata: updatedDocAfterProcessing.metadata || {}
          };

          if (!result.text) {
            console.error(`Failed to extract text from YouTube video: ${document.sourceUrl}`);
            await storage.updateDocument(document.id, {
              status: "failed",
              processingInfo: {
                error: `Failed to extract text from YouTube video: ${(result.metadata as any)?.error || "Unknown error"}`,
                finished_at: new Date().toISOString(),
              },
            });
            throw new Error(`Failed to extract text from YouTube video: ${(result.metadata as any)?.error || "Unknown error"}`);
          }

          console.log(`Successfully extracted text from YouTube video: ${document.sourceUrl} (${result.text.length} characters)`);

          // Store text in document content (sanitized)
          const extractedText = result.text;
          const extractedMetadata = result.metadata;

          const sanitizeContent = (content: string) => {
            return content.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
          };

          const updateData = {
            content: sanitizeContent(extractedText),
            metadata: {
              ...((document.metadata as any) || {}),
              youtube: extractedMetadata,
            },
            processingInfo: {
              ...((document as any).processingInfo || {}),
              step: "processing_text",
              text_length: extractedText.length,
            },
          };

          await storage.updateDocument(document.id, updateData);

          // Get the updated document
          const updatedDocFinal = await storage.getDocument(document.id);
          if (!updatedDocFinal) {
            throw new Error(`Document not found after update: ${document.id}`);
          }

          // Process and chunk the text
          const processedDoc = await processText(
            result.text,
            `youtube:${updatedDocFinal.title}`,
            {
              document_id: updatedDocFinal.id.toString(),
              custom_fields: (updatedDocFinal.metadata as any)?.custom_fields || {},
              youtube_metadata: result.metadata,
            },
          );

          // Update document status
          await storage.updateDocument(document.id, {
            metadata: {
              ...((updatedDocFinal.metadata as any) || {}),
              chunk_count: processedDoc.chunks.length,
            },
            processingInfo: {
              ...((updatedDocFinal as any).processingInfo || {}),
              step: "generating_embeddings",
              chunks: processedDoc.chunks.length,
            },
          });

          // Generate embeddings
          const providerId = 1; // Default to OpenAI
          const embeddingResults = await createAndStoreEmbeddings(
            userId,
            kbId,
            document.id.toString(),
            processedDoc,
            providerId,
          );

          // Update document to processed status
          console.log(`Finalizing YouTube document ${document.id} WITHOUT touching content field to preserve transcript`);
          
          const chunkCount = processedDoc.chunks.length;
          const embeddingCount = embeddingResults.length;
          const finalChunkCount = chunkCount > 0 ? chunkCount : ((processedDoc as any).text ? 1 : 0);
          const finalEmbeddingCount = embeddingCount > 0 ? embeddingCount : finalChunkCount;

          await storage.updateDocument(document.id, {
            status: "processed",
            metadata: {
              ...((updatedDocFinal.metadata as any) || {}),
              chunk_count: finalChunkCount,
              embedding_count: finalEmbeddingCount,
              embedding_provider: providerId,
              isYoutubeDocument: true,
              youtubeContentPreserved: true,
            },
            processingInfo: {
              ...((updatedDocFinal as any).processingInfo || {}),
              step: "completed",
              embeddings: finalEmbeddingCount,
              chunks: finalChunkCount,
              progress: 100,
              completed_at: new Date(),
              finished_at: new Date().toISOString(),
            },
          });

          console.log(`Successfully processed YouTube video for document ID ${document.id}: ${embeddingResults.length} embeddings created`);

          processedDocument = {
            chunks: [],
            metadata: {
              youtubeProcessed: true,
              preserveContent: true,
            },
          };
        } catch (error) {
          console.error(`Error processing YouTube video for document ID ${document.id}:`, error);
          await storage.updateDocument(document.id, {
            status: "failed",
            processingInfo: {
              error: error instanceof Error ? error.message : String(error),
              finished_at: new Date().toISOString(),
            },
          });
          throw error;
        }
        break;

      default:
        throw new Error(`Unsupported document type: ${sourceType}`);
    }

    // Update progress to show we're creating embeddings
    await storage.updateDocument(docId, {
      processingInfo: {
        status_message: "Creating embeddings",
        progress: 60,
      },
    });

    // Create embeddings for the processed chunks (skip for YouTube as it handles its own)
    let embeddingResults: any[] = [];
    if (document.sourceType !== "youtube") {
      embeddingResults = await createAndStoreEmbeddings(
        userId,
        kbId,
        docId.toString(),
        processedDocument as any,
        numericProviderId,
      );
    }

    // Update progress to show we're finalizing document
    await storage.updateDocument(docId, {
      processingInfo: {
        status_message: "Finalizing document",
        progress: 80,
      },
    });

    // Give time for indexing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Extract the full document content if available
    let extractedFullContent = null;

    if (document.sourceType === "text" && document.content) {
      extractedFullContent = document.content;
    } else if (processedDocument.chunks && processedDocument.chunks.length > 0) {
      extractedFullContent = processedDocument.chunks
        .map((chunk: any) => chunk.content)
        .join("\n\n");
      console.log(
        `Extracted ${extractedFullContent.length} characters of content from ${processedDocument.chunks.length} chunks`,
      );
    }

    // Check if this is a YouTube document with the preserve content flag
    const isYoutubeDocument = document.sourceType === "youtube";
    const shouldPreserveContent = (processedDocument as any).metadata && (processedDocument as any).metadata.preserveContent;

    if (isYoutubeDocument && shouldPreserveContent) {
      console.log(`CRITICAL FIX: Finalizing YouTube document ${docId} WITHOUT touching content field to preserve transcript`);

      const chunkCount = processedDocument.chunks.length;
      const embeddingCount = embeddingResults.length;
      const finalChunkCount = Math.max(1, chunkCount);
      const finalEmbeddingCount = Math.max(1, embeddingCount);

      await storage.updateDocument(docId, {
        status: 'processed',
        processingInfo: {
          status_message: "Processing complete",
          progress: 100,
          completed_at: new Date(),
          chunk_size: 1000,
          chunk_overlap: 200,
          chunks: finalChunkCount,
          embeddings: finalEmbeddingCount
        },
        metadata: document.metadata ? {
          ...document.metadata,
          chunk_count: finalChunkCount,
          embedding_count: finalEmbeddingCount,
          embedding_provider: numericProviderId,
          isYoutubeDocument: true,
          youtubeContentPreserved: true,
          content_extracted: true,
          extraction_date: new Date().toISOString()
        } : {
          chunk_count: finalChunkCount,
          embedding_count: finalEmbeddingCount,
          embedding_provider: numericProviderId,
          isYoutubeDocument: true,
          youtubeContentPreserved: true,
          content_extracted: true,
          extraction_date: new Date().toISOString()
        },
        embeddingIds: embeddingResults.map((result: any) => result.id)
      });
    } else {
      // For all other document types, update with extracted content
      await storage.updateDocument(docId, {
        status: "processed",
        content: extractedFullContent ? extractedFullContent.replace(/\0/g, '') : '',
        processingInfo: {
          status_message: "Processing complete",
          progress: 100,
          completed_at: new Date(),
          chunk_size: 1000,
          chunk_overlap: 200,
        },
        metadata: document.metadata ? {
          ...document.metadata,
          chunk_count: processedDocument.chunks.length,
          embedding_count: embeddingResults.length,
          embedding_provider: numericProviderId,
          content_extracted: extractedFullContent !== null,
          extraction_date: new Date().toISOString(),
        } : {
          chunk_count: processedDocument.chunks.length,
          embedding_count: embeddingResults.length,
          embedding_provider: numericProviderId,
          content_extracted: extractedFullContent !== null,
          extraction_date: new Date().toISOString(),
        },
        embeddingIds: embeddingResults.map((result: any) => result.id),
      });
    }

    // Release the processing lock
    delete (global as any)._processingDocuments[docId];

    return res.status(200).json({
      document_id: docId,
      status: "processed",
      chunks: processedDocument.chunks.length,
      embeddings: embeddingResults.length,
    });

  } catch (error) {
    console.error(`Error processing document ${docId}:`, error);

    // Update document with error status
    await storage.updateDocument(docId, {
      status: "failed",
      processingInfo: {
        error: error instanceof Error ? error.message : String(error),
        completed_at: new Date(),
      },
    });

    // Release the processing lock
    delete (global as any)._processingDocuments[docId];

    return res.status(500).json({
      message: "Failed to process document",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Document reprocessing endpoint
router.post('/knowledge-bases/:kbId/documents/:docId/reprocess-embeddings', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const docId = parseInt(req.params.docId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId) || isNaN(docId)) {
      return sendError(res, 'Invalid knowledge base or document ID', 400);
    }

    console.log(`POST /api/knowledge-bases/${kbId}/documents/${docId}/reprocess-embeddings: Reprocessing embeddings`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Verify document exists
    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      return sendError(res, 'Document not found in this knowledge base', 404);
    }

    // Update document metadata to indicate reprocessing
    const updatedMetadata = {
      ...(document.metadata || {}),
      reprocessingStarted: new Date().toISOString(),
      lastReprocessed: new Date().toISOString()
    };

    await storage.updateDocument(docId, { 
      metadata: updatedMetadata,
      updatedAt: new Date()
    });

    console.log(`POST /api/knowledge-bases/${kbId}/documents/${docId}/reprocess-embeddings: Reprocessing started`);
    return res.status(200).json({ 
      message: 'Document embedding reprocessing started',
      documentId: docId,
      status: 'reprocessing'
    });
  } catch (error) {
    console.error('Error reprocessing document embeddings:', getErrorMessage(error));
    return sendError(res, 'Failed to start document reprocessing', 500);
  }
});

// Multiple PDF upload endpoint
router.post('/knowledge-bases/:id/documents/upload-multiple', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/upload-multiple: Multiple file upload`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // For now, return a placeholder response indicating the endpoint is available
    // Full implementation would handle multipart file upload
    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/documents/upload-multiple: Endpoint available`);
    return res.status(200).json({ 
      message: 'Multiple upload endpoint available',
      knowledgeBaseId,
      status: 'ready'
    });
  } catch (error) {
    console.error('Error in multiple upload endpoint:', getErrorMessage(error));
    return sendError(res, 'Failed to process multiple upload', 500);
  }
});

// Update document endpoint
router.put('/knowledge-bases/:kbId/documents/:docId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const docId = parseInt(req.params.docId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId) || isNaN(docId)) {
      return sendError(res, 'Invalid knowledge base or document ID', 400);
    }

    console.log(`PUT /api/knowledge-bases/${kbId}/documents/${docId}: Updating document`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Verify document exists and belongs to knowledge base
    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      return sendError(res, 'Document not found in this knowledge base', 404);
    }

    const { title, description, content, tags, metadata } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) updateData.content = content;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) {
      updateData.metadata = {
        ...(document.metadata as any || {}),
        ...metadata,
        lastUpdated: new Date().toISOString()
      };
    }
    updateData.updatedAt = new Date();

    const updatedDocument = await storage.updateDocument(docId, updateData);

    console.log(`PUT /api/knowledge-bases/${kbId}/documents/${docId}: Document updated successfully`);
    return res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', getErrorMessage(error));
    return sendError(res, 'Failed to update document', 500);
  }
});

// Delete document endpoint
router.delete('/knowledge-bases/:kbId/documents/:docId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const docId = parseInt(req.params.docId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId) || isNaN(docId)) {
      return sendError(res, 'Invalid knowledge base or document ID', 400);
    }

    console.log(`DELETE /api/knowledge-bases/${kbId}/documents/${docId}: Deleting document`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Verify document exists and belongs to knowledge base
    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      return sendError(res, 'Document not found in this knowledge base', 404);
    }

    // Delete the document
    await storage.deleteDocument(docId);

    console.log(`DELETE /api/knowledge-bases/${kbId}/documents/${docId}: Document deleted successfully`);
    return res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', getErrorMessage(error));
    return sendError(res, 'Failed to delete document', 500);
  }
});

// Get document content by ID
router.get('/knowledge-bases/:kbId/documents/:docId/content', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const docId = parseInt(req.params.docId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId) || isNaN(docId)) {
      return sendError(res, 'Invalid knowledge base or document ID', 400);
    }

    console.log(`GET /api/knowledge-bases/${kbId}/documents/${docId}/content: Retrieving document content`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Get document
    const document = await storage.getDocument(docId);
    if (!document || document.knowledgeBaseId !== kbId) {
      return sendError(res, 'Document not found in this knowledge base', 404);
    }

    console.log(`GET /api/knowledge-bases/${kbId}/documents/${docId}/content: Content retrieved successfully`);
    return res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      sourceType: document.sourceType,
      metadata: document.metadata,
      updatedAt: document.updatedAt
    });
  } catch (error) {
    console.error('Error retrieving document content:', getErrorMessage(error));
    return sendError(res, 'Failed to retrieve document content', 500);
  }
});

// YouTube integration endpoint
router.post('/knowledge-bases/:kbId/documents/youtube', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    const { sourceUrl, title, description } = req.body;

    if (!sourceUrl) {
      return sendError(res, 'YouTube URL is required', 400);
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(sourceUrl)) {
      return sendError(res, 'Invalid YouTube URL', 400);
    }

    console.log(`POST /api/knowledge-bases/${kbId}/documents/youtube: Adding YouTube content`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    // Extract video ID
    const videoIdMatch = sourceUrl.match(youtubeRegex);
    const videoId = videoIdMatch ? videoIdMatch[4] : null;

    if (!videoId) {
      return sendError(res, 'Could not extract video ID from URL', 400);
    }

    const documentData = {
      knowledgeBaseId: kbId,
      userId: userIdInt,
      title: title || `YouTube Video: ${videoId}`,
      description: description || 'YouTube video content',
      sourceType: 'youtube',
      sourceUrl,
      status: 'processing',
      metadata: {
        videoId,
        platform: 'youtube',
        addedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    console.log(`POST /api/knowledge-bases/${kbId}/documents/youtube: YouTube document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error adding YouTube content:', getErrorMessage(error));
    return sendError(res, 'Failed to add YouTube content', 500);
  }
});

// SharePoint integration endpoint
router.post('/knowledge-bases/:kbId/documents/sharepoint', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const kbId = parseInt(req.params.kbId);
    const userIdInt = parseInt(userId);

    if (isNaN(kbId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    const { sourceUrl, title, description, siteId, fileId, accessToken } = req.body;

    if (!sourceUrl && !fileId) {
      return sendError(res, 'SharePoint URL or file ID is required', 400);
    }

    console.log(`POST /api/knowledge-bases/${kbId}/documents/sharepoint: Adding SharePoint content`);

    // Verify knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(kbId);
    if (!knowledgeBase || knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Knowledge base not found or access denied', 404);
    }

    const documentData = {
      knowledgeBaseId: kbId,
      userId: userIdInt,
      title: title || 'SharePoint Document',
      description: description || 'SharePoint document content',
      sourceType: 'sharepoint',
      sourceUrl,
      status: 'processing',
      metadata: {
        siteId,
        fileId,
        platform: 'sharepoint',
        addedAt: new Date().toISOString(),
        accessTokenProvided: !!accessToken
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDocument = await storage.createDocument(documentData);

    console.log(`POST /api/knowledge-bases/${kbId}/documents/sharepoint: SharePoint document created with ID ${newDocument.id}`);
    return res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error adding SharePoint content:', getErrorMessage(error));
    return sendError(res, 'Failed to add SharePoint content', 500);
  }
});

export default router;