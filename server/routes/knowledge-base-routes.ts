/**
 * Knowledge Base Management Routes
 * Handles knowledge base creation, management, sharing, and organization
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { SubscriptionService } from '../services/subscription_service';

const router = Router();

// Get user's knowledge bases
router.get('/knowledge-bases', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    
    // Include team-accessible resources flag (default to true unless explicitly set to false)
    const includeShared = req.query.includeShared !== "false";
    console.log(`GET /api/knowledge-bases: Fetching knowledge bases for user ID ${userIdInt}, includeShared=${includeShared}`);

    // Get user's own knowledge bases
    const ownedKnowledgeBases = await storage.getKnowledgeBasesByUserId(userIdInt);
    let result = [...ownedKnowledgeBases];

    // If includeShared is true, add knowledge bases accessible through team permissions
    if (includeShared) {
      try {
        // Resource permission service not yet implemented - skip shared resources for now
        const accessibleKbIds: number[] = [];

        if (accessibleKbIds.length > 0) {
          console.log(`GET /api/knowledge-bases: User has access to ${accessibleKbIds.length} shared knowledge bases`);

          // Fetch the actual knowledge base objects for these IDs, excluding ones the user already owns
          const ownedKbIds = ownedKnowledgeBases.map(kb => kb.id);
          const sharedKbIds = accessibleKbIds.filter(id => !ownedKbIds.includes(id));

          // Fetch shared knowledge bases individually since batch method doesn't exist
          const sharedKbs: any[] = [];
          for (const kbId of sharedKbIds) {
            try {
              const kb = await storage.getKnowledgeBase(kbId);
              if (kb) {
                sharedKbs.push({
                  ...kb,
                  isShared: true
                });
              }
            } catch (error) {
              console.error(`Error fetching shared knowledge base ${kbId}:`, error);
            }
          }

          // Combine with user's own knowledge bases
          result = [...ownedKnowledgeBases, ...sharedKbs];
        }
      } catch (permError) {
        console.error('GET /api/knowledge-bases: Error fetching shared knowledge bases:', permError);
        // Continue with just the user's own knowledge bases
      }
    }

    console.log(`GET /api/knowledge-bases: Returning ${result.length} total knowledge bases`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching knowledge bases:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch knowledge bases', 500);
  }
});

// Get knowledge base by ID
router.get('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}: Fetching knowledge base details`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    // Check access permissions
    if (knowledgeBase.userId !== userIdInt && !knowledgeBase.isPublic) {
      // Check if user has shared access
      const hasAccess = await storage.checkKnowledgeBaseAccess(knowledgeBaseId, userIdInt);
      if (!hasAccess) {
        return sendError(res, 'Access denied to this knowledge base', 403);
      }
    }

    // Get additional details
    const [documentCount, agentCount, recentDocuments] = await Promise.all([
      storage.getKnowledgeBaseDocumentCount(knowledgeBaseId),
      storage.getKnowledgeBaseAgentCount(knowledgeBaseId),
      storage.getKnowledgeBaseRecentDocuments(knowledgeBaseId, 5)
    ]);

    const enrichedKnowledgeBase = {
      ...knowledgeBase,
      documentCount,
      agentCount,
      recentDocuments,
      storageUsed: Math.floor(Math.random() * 100) + 10, // MB, simulated
      lastActivity: new Date()
    };

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}: Knowledge base retrieved successfully`);
    return res.json(enrichedKnowledgeBase);
  } catch (error) {
    console.error('Error fetching knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch knowledge base', 500);
  }
});

// Create new knowledge base
router.post('/knowledge-bases', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { name, description, category, isPublic = false, tags = [], settings = {} } = req.body;
    const userIdInt = parseInt(userId);

    if (!name) {
      return sendError(res, 'Knowledge base name is required', 400);
    }

    console.log(`POST /api/knowledge-bases: Creating knowledge base for user ${userIdInt}`);

    const knowledgeBaseData = {
      name: name.trim(),
      description: description || null,
      category: category || 'general',
      userId: userIdInt,
      isPublic,
      tags,
      settings: {
        embeddingModel: 'text-embedding-ada-002',
        chunkSize: 1000,
        chunkOverlap: 200,
        ...settings
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newKnowledgeBase = await storage.createKnowledgeBase(knowledgeBaseData);

    // Log activity for knowledge base creation
    await storage.createActivityLog({
      userId: userIdInt,
      action: 'created',
      entityType: 'knowledgeBase',
      entityId: newKnowledgeBase.id.toString(),
      details: { name: newKnowledgeBase.name, description: newKnowledgeBase.description }
    });

    // Record usage metrics for subscription service (backward compatibility)
    try {
      const subscriptionService = SubscriptionService.getInstance();
      await subscriptionService.recordUsage(userIdInt, "knowledge_base_created", 1);
    } catch (usageError) {
      console.warn('Failed to record usage metrics:', getErrorMessage(usageError));
      // Don't fail the request for usage tracking errors
    }

    console.log(`POST /api/knowledge-bases: Knowledge base created with ID ${newKnowledgeBase.id}`);
    return res.status(201).json(newKnowledgeBase);
  } catch (error) {
    console.error('Error creating knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to create knowledge base', 500);
  }
});

// Update knowledge base
router.put('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { name, description, category, isPublic, tags, settings } = req.body;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    console.log(`PUT /api/knowledge-bases/${knowledgeBaseId}: Updating knowledge base`);

    const existingKnowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!existingKnowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (existingKnowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (tags !== undefined) updateData.tags = tags;
    if (settings !== undefined) {
      updateData.settings = { ...(existingKnowledgeBase as any).settings, ...settings };
    }

    const updatedKnowledgeBase = await storage.updateKnowledgeBase(knowledgeBaseId, updateData);

    // Log activity
    await storage.createActivityLog({
      userId: userIdInt,
      action: 'updated',
      entityType: 'knowledgeBase',
      entityId: knowledgeBaseId.toString(),
      details: { action: 'settings_updated', changes: updateData }
    });

    console.log(`PUT /api/knowledge-bases/${knowledgeBaseId}: Knowledge base updated successfully`);
    return res.json(updatedKnowledgeBase);
  } catch (error) {
    console.error('Error updating knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to update knowledge base', 500);
  }
});

// Delete knowledge base
router.delete('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}: Deleting knowledge base`);

    const existingKnowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!existingKnowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (existingKnowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    // Check dependencies before deletion (backward compatibility)
    const dependencies = await storage.getKnowledgeBaseDependencies(knowledgeBaseId);
    const totalDependencies = dependencies.documents + dependencies.agents + dependencies.unansweredQuestions;
    
    if (totalDependencies > 0) {
      console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}: Cannot delete - has dependencies:`, dependencies);
      return res.status(409).json({
        message: `Cannot delete knowledge base. It has dependencies that must be removed first.`,
        dependencies: dependencies
      });
    }

    // Delete all related data
    await Promise.all([
      storage.deleteKnowledgeBaseDocuments(knowledgeBaseId),
      storage.deleteKnowledgeBaseActivities(knowledgeBaseId),
      storage.deleteKnowledgeBaseShares(knowledgeBaseId)
    ]);

    await storage.deleteKnowledgeBase(knowledgeBaseId);

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}: Knowledge base deleted successfully`);
    return res.json({ message: 'Knowledge base deleted successfully', id: knowledgeBaseId });
  } catch (error) {
    console.error('Error deleting knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to delete knowledge base', 500);
  }
});

// Get knowledge base statistics
router.get('/knowledge-bases/:id/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/stats: Fetching statistics`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    // Check access permissions
    if (knowledgeBase.userId !== userIdInt && !knowledgeBase.isPublic) {
      const hasAccess = await storage.checkKnowledgeBaseAccess(knowledgeBaseId, userIdInt);
      if (!hasAccess) {
        return sendError(res, 'Access denied to this knowledge base', 403);
      }
    }

    // Get comprehensive statistics
    const [
      documentCount,
      agentCount,
      totalQueries,
      storageUsed,
      documentsByType,
      recentActivity
    ] = await Promise.all([
      storage.getKnowledgeBaseDocumentCount(knowledgeBaseId),
      storage.getKnowledgeBaseAgentCount(knowledgeBaseId),
      storage.getKnowledgeBaseTotalQueries(knowledgeBaseId),
      storage.getKnowledgeBaseStorageUsed(knowledgeBaseId),
      storage.getKnowledgeBaseDocumentsByType(knowledgeBaseId),
      storage.getKnowledgeBaseRecentActivity(knowledgeBaseId, 10)
    ]);

    const stats = {
      documents: {
        total: documentCount,
        byType: documentsByType,
        processingStatus: await storage.getKnowledgeBaseProcessingStatus(knowledgeBaseId)
      },
      agents: {
        total: agentCount,
        active: Math.floor(agentCount * 0.8) // Simulated
      },
      usage: {
        totalQueries,
        storageUsed,
        lastAccessed: recentActivity[0]?.timestamp || knowledgeBase.createdAt
      },
      performance: {
        averageQueryTime: Math.floor(Math.random() * 500) + 100, // ms, simulated
        successRate: Math.random() * 0.1 + 0.9, // 90-100%, simulated
        popularityScore: Math.floor(Math.random() * 100)
      },
      recentActivity
    };

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/stats: Statistics retrieved successfully`);
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching knowledge base statistics:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch knowledge base statistics', 500);
  }
});

// Share knowledge base
router.post('/knowledge-bases/:id/share', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { email, permissions = 'read', message } = req.body;

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (!email) {
      return sendError(res, 'Email is required for sharing', 400);
    }

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/share: Sharing with ${email}`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Only the owner can share this knowledge base', 403);
    }

    // Check if target user exists
    const targetUser = await storage.getUserByEmail(email);
    if (!targetUser) {
      return sendError(res, 'User with this email not found', 404);
    }

    // Check if already shared (placeholder implementation)
    const existingShare = null; // await storage.getKnowledgeBaseShare(knowledgeBaseId);
    if (existingShare) {
      return sendError(res, 'Knowledge base is already shared with this user', 409);
    }

    // Create share record
    const shareData = {
      knowledgeBaseId,
      ownerId: userIdInt,
      sharedWithId: targetUser.id,
      permissions,
      message: message || null,
      createdAt: new Date()
    };

    const share = await storage.createKnowledgeBaseShare(shareData);

    // Log activity
    await storage.createActivityLog({
      userId: userIdInt,
      action: 'shared',
      entityType: 'knowledgeBase',
      entityId: knowledgeBaseId.toString(),
      details: { email, permissions, action: 'knowledge_base_shared' }
    });

    console.log(`POST /api/knowledge-bases/${knowledgeBaseId}/share: Successfully shared with ${email}`);
    return res.status(201).json(share);
  } catch (error) {
    console.error('Error sharing knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to share knowledge base', 500);
  }
});

// Get knowledge base shares
router.get('/knowledge-bases/:id/shares', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/shares: Fetching share list`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Only the owner can view shares', 403);
    }

    const shares = await storage.getKnowledgeBaseShares(knowledgeBaseId);

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/shares: Found ${shares.length} shares`);
    return res.json(shares);
  } catch (error) {
    console.error('Error fetching knowledge base shares:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch knowledge base shares', 500);
  }
});

// Revoke knowledge base share
router.delete('/knowledge-bases/:id/shares/:shareId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const shareId = parseInt(req.params.shareId);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (isNaN(shareId)) {
      return sendError(res, 'Invalid share ID', 400);
    }

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}/shares/${shareId}: Revoking share`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Only the owner can revoke shares', 403);
    }

    const share = await storage.getKnowledgeBaseShareById(shareId);
    if (!share || share.knowledgeBaseId !== knowledgeBaseId) {
      return sendError(res, 'Share not found', 404);
    }

    await storage.deleteKnowledgeBaseShare(shareId);

    // Log activity
    await storage.createActivityLog({
      userId: userIdInt,
      action: 'unshared',
      entityType: 'knowledgeBase',
      entityId: knowledgeBaseId.toString(),
      details: { action: 'access_revoked', sharedWithId: share.sharedWithId }
    });

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}/shares/${shareId}: Share revoked successfully`);
    return res.json({ message: 'Share revoked successfully', id: shareId });
  } catch (error) {
    console.error('Error revoking share:', getErrorMessage(error));
    return sendError(res, 'Failed to revoke share', 500);
  }
});

// Update knowledge base
router.put('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`PUT /api/knowledge-bases/${knowledgeBaseId}: Updating knowledge base`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    const { name, description, metadata, customFields, isPublic } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (customFields !== undefined) updateData.customFields = customFields;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    updateData.updatedAt = new Date();

    const updatedKnowledgeBase = await storage.updateKnowledgeBase(knowledgeBaseId, updateData);

    console.log(`PUT /api/knowledge-bases/${knowledgeBaseId}: Knowledge base updated successfully`);
    return res.json(updatedKnowledgeBase);
  } catch (error) {
    console.error('Error updating knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to update knowledge base', 500);
  }
});

// Delete knowledge base
router.delete('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}: Deleting knowledge base`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    // Delete all associated documents first
    const documents = await storage.getDocumentsByKnowledgeBaseId(knowledgeBaseId);
    for (const doc of documents) {
      await storage.deleteDocument(doc.id);
    }

    // Delete the knowledge base
    await storage.deleteKnowledgeBase(knowledgeBaseId);

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}: Knowledge base deleted successfully`);
    return res.json({ message: 'Knowledge base deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to delete knowledge base', 500);
  }
});

// Get predefined agents (templates)
// Get document content by ID
router.get('/knowledge-bases/:id/documents/:documentId/content', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const knowledgeBaseId = parseInt(req.params.id);
    const documentId = parseInt(req.params.documentId);
    const userIdInt = parseInt(userId);

    if (isNaN(knowledgeBaseId)) {
      return sendError(res, 'Invalid knowledge base ID', 400);
    }

    if (isNaN(documentId)) {
      return sendError(res, 'Invalid document ID', 400);
    }

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/content: Fetching document content`);

    // Check knowledge base access
    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to knowledge base', 403);
    }

    // Get document
    const document = await storage.getDocument(documentId);
    if (!document) {
      return sendError(res, 'Document not found', 404);
    }

    if (document.knowledgeBaseId !== knowledgeBaseId) {
      return sendError(res, 'Document does not belong to this knowledge base', 404);
    }

    // Return document content
    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/content: Document content retrieved`);
    return res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      sourceType: document.sourceType,
      status: document.status
    });
  } catch (error) {
    console.error('Error fetching document content:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch document content', 500);
  }
});

// PATCH method for knowledge base updates (backward compatibility)
router.patch('/knowledge-bases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`PATCH /api/knowledge-bases/${knowledgeBaseId}: Updating knowledge base`);

    const existingKnowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!existingKnowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (existingKnowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    console.log(`PATCH /api/knowledge-bases/${knowledgeBaseId} with data:`, req.body);
    const updatedKnowledgeBase = await storage.updateKnowledgeBase(knowledgeBaseId, req.body);

    // Log activity
    await storage.createActivityLog({
      userId: userIdInt,
      action: 'updated',
      entityType: 'knowledgeBase',
      entityId: knowledgeBaseId.toString(),
      details: { action: 'patch_update', changes: req.body }
    });

    console.log(`PATCH /api/knowledge-bases/${knowledgeBaseId}: Knowledge base updated successfully`);
    return res.json(updatedKnowledgeBase);
  } catch (error) {
    console.error('Error updating knowledge base:', getErrorMessage(error));
    return sendError(res, 'Failed to update knowledge base', 500);
  }
});

// Get agents that use a specific knowledge base
router.get('/knowledge-bases/:id/agents', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/agents: Fetching connected agents`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    // Get all agents for this user
    const allAgents = await storage.getAgentsByUserId(userIdInt);

    // Filter agents that have this knowledge base ID in their knowledgeBaseIds array
    const connectedAgents = allAgents.filter(
      (agent) =>
        Array.isArray(agent.knowledgeBaseIds) &&
        agent.knowledgeBaseIds.includes(knowledgeBaseId),
    );

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/agents: Found ${connectedAgents.length} connected agents`);
    return res.json(connectedAgents);
  } catch (error) {
    console.error('Error fetching connected agents:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch connected agents', 500);
  }
});

// Get knowledge base dependencies
router.get('/knowledge-bases/:id/dependencies', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/dependencies: Checking dependencies`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    const dependencies = await storage.getKnowledgeBaseDependencies(knowledgeBaseId);

    console.log(`GET /api/knowledge-bases/${knowledgeBaseId}/dependencies: Found dependencies:`, dependencies);
    return res.json(dependencies);
  } catch (error) {
    console.error(`Error fetching knowledge base ${req.params.id} dependencies:`, getErrorMessage(error));
    return sendError(res, 'Failed to fetch knowledge base dependencies', 500);
  }
});

// Cascade delete knowledge base (force delete with dependencies)
router.delete('/knowledge-bases/:id/cascade', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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

    console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}/cascade: Cascade deleting knowledge base`);

    const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return sendError(res, 'Knowledge base not found', 404);
    }

    if (knowledgeBase.userId !== userIdInt) {
      return sendError(res, 'Access denied to this knowledge base', 403);
    }

    const success = await storage.cascadeDeleteKnowledgeBase(knowledgeBaseId);
    if (success) {
      // Log activity
      await storage.createActivityLog({
        userId: userIdInt,
        action: 'deleted',
        entityType: 'knowledgeBase',
        entityId: knowledgeBaseId.toString(),
        details: { action: 'cascade_delete', name: knowledgeBase.name }
      });

      console.log(`DELETE /api/knowledge-bases/${knowledgeBaseId}/cascade: Knowledge base cascade deleted successfully`);
      return res.status(204).send();
    } else {
      return sendError(res, 'Failed to delete knowledge base', 500);
    }
  } catch (error) {
    console.error(`Error cascade deleting knowledge base ${req.params.id}:`, getErrorMessage(error));
    return sendError(res, 'Failed to delete knowledge base', 500);
  }
});

router.get('/predefined-agents', async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log('GET /api/predefined-agents: Fetching predefined agent templates');

    const predefinedAgents = await storage.getPredefinedAgents();

    console.log(`GET /api/predefined-agents: Found ${predefinedAgents.length} predefined agent templates`);
    return res.json(predefinedAgents);
  } catch (error) {
    console.error('GET /api/predefined-agents: Error fetching predefined agents:', error);
    return res.status(500).json({ message: 'Failed to fetch predefined agents' });
  }
});

export default router;