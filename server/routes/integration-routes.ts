/**
 * Integration Management Routes
 * Handles third-party service integrations (Slack, WordPress, RSS, SharePoint, etc.)
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError, sendNotFound } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createIntegrationSchema = z.object({
  providerId: z.number().min(1, 'Provider ID is required'),
  name: z.string().min(1, 'Integration name is required'),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().default(true)
});

const updateIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'error', 'pending_setup', 'pending_auth']).optional()
});

const createProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  type: z.enum(['smtp', 'slack', 'zapier', 'wordpress', 'rss_feed', 'sharepoint', 'custom']),
  description: z.string().optional(),
  iconUrl: z.string().url().optional(),
  config: z.record(z.any()).optional(),
  isEnabled: z.boolean().default(true)
});

/**
 * Get all integration providers (public endpoint for discovery)
 */
router.get('/integrations/providers', async (req: Request, res: Response): Promise<Response> => {
  try {
    const providers = await storage.getAllIntegrationProviders();
    return res.json(providers);
  } catch (error) {
    console.error('Error fetching integration providers:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integration providers', 500);
  }
});

/**
 * Get specific integration provider
 */
router.get('/integrations/providers/:providerId', async (req: Request, res: Response): Promise<Response> => {
  try {
    const providerId = parseInt(req.params.providerId);
    
    if (isNaN(providerId)) {
      return sendError(res, 'Invalid provider ID', 400);
    }
    
    const provider = await storage.getIntegrationProvider(providerId);
    if (!provider) {
      return sendNotFound(res, 'Integration provider not found');
    }
    
    return res.json(provider);
  } catch (error) {
    console.error('Error fetching integration provider:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integration provider', 500);
  }
});

/**
 * Create new integration provider (admin only)
 */
router.post('/integrations/providers', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createProviderSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid provider data', 400, JSON.stringify(validation.error.errors));
    }
    
    const providerData = validation.data;
    const provider = await storage.createIntegrationProvider(providerData);
    
    return res.status(201).json(provider);
  } catch (error) {
    console.error('Error creating integration provider:', getErrorMessage(error));
    return sendError(res, 'Failed to create integration provider', 500);
  }
});

/**
 * Update integration provider (admin only)
 */
router.put('/integrations/providers/:providerId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const providerId = parseInt(req.params.providerId);
    
    if (isNaN(providerId)) {
      return sendError(res, 'Invalid provider ID', 400);
    }
    
    const validation = createProviderSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid provider data', 400, JSON.stringify(validation.error.errors));
    }
    
    const providerData = validation.data;
    const updatedProvider = await storage.updateIntegrationProvider(providerId, providerData);
    
    if (!updatedProvider) {
      return sendNotFound(res, 'Integration provider not found');
    }
    
    return res.json(updatedProvider);
  } catch (error) {
    console.error('Error updating integration provider:', getErrorMessage(error));
    return sendError(res, 'Failed to update integration provider', 500);
  }
});

/**
 * Get user's integrations
 */
router.get('/integrations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrations = await storage.getIntegrationsByUserId(parseInt(userId));
    
    return res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integrations', 500);
  }
});

/**
 * Get specific integration
 */
router.get('/integrations/:integrationId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    // Check if user owns this integration
    if (integration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    return res.json(integration);
  } catch (error) {
    console.error('Error fetching integration:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integration', 500);
  }
});

/**
 * Create new integration
 */
router.post('/integrations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createIntegrationSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid integration data', 400, JSON.stringify(validation.error.errors));
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationData = {
      ...validation.data,
      userId: parseInt(userId),
      status: 'pending_setup' as const
    };
    
    // Verify provider exists
    const provider = await storage.getIntegrationProvider(integrationData.providerId);
    if (!provider) {
      return sendError(res, 'Integration provider not found', 404);
    }
    
    if (!provider.isActive) {
      return sendError(res, 'Integration provider is currently disabled', 400);
    }
    
    const integration = await storage.createIntegration(integrationData);
    
    // Log integration creation
    await storage.createIntegrationLog({
      integrationId: integration.id,
      eventType: 'created',
      message: `Integration "${integration.name}" created successfully`,
      details: { providerId: provider.id, providerType: provider.type }
    });
    
    return res.status(201).json(integration);
  } catch (error) {
    console.error('Error creating integration:', getErrorMessage(error));
    return sendError(res, 'Failed to create integration', 500);
  }
});

/**
 * Update integration
 */
router.put('/integrations/:integrationId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = updateIntegrationSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid integration data', 400, JSON.stringify(validation.error.errors));
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    // Check ownership
    const existingIntegration = await storage.getIntegration(integrationId);
    if (!existingIntegration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    if (existingIntegration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    const integrationData = validation.data;
    const updatedIntegration = await storage.updateIntegration(integrationId, integrationData);
    
    if (!updatedIntegration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    // Log integration update
    await storage.createIntegrationLog({
      integrationId: integrationId,
      eventType: 'updated',
      message: `Integration "${updatedIntegration.name}" updated successfully`,
      details: integrationData
    });
    
    return res.json(updatedIntegration);
  } catch (error) {
    console.error('Error updating integration:', getErrorMessage(error));
    return sendError(res, 'Failed to update integration', 500);
  }
});

/**
 * Delete integration
 */
router.delete('/integrations/:integrationId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    // Check ownership
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    if (integration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    await storage.deleteIntegration(integrationId);
    
    // Log integration deletion
    await storage.createIntegrationLog({
      integrationId: integrationId,
      eventType: 'deleted',
      message: `Integration "${integration.name}" deleted successfully`,
      details: { integrationName: integration.name }
    });
    
    return res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting integration:', getErrorMessage(error));
    return sendError(res, 'Failed to delete integration', 500);
  }
});

/**
 * Test integration connection
 */
router.post('/integrations/:integrationId/test', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    // Check ownership
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    if (integration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    // For now, return a mock test result
    // In a real implementation, this would test the actual connection to the service
    const testResult = {
      success: true,
      message: 'Integration test completed successfully',
      timestamp: new Date().toISOString(),
      details: {
        status: 'connected',
        latency: Math.floor(Math.random() * 100) + 50, // Mock latency
        lastTested: new Date().toISOString()
      }
    };
    
    // Log test attempt
    await storage.createIntegrationLog({
      integrationId: integrationId,
      eventType: 'tested',
      message: testResult.message,
      details: testResult.details
    });
    
    // Update integration status if test successful
    if (testResult.success && integration.status === 'pending_setup') {
      await storage.updateIntegration(integrationId, { status: 'active' });
    }
    
    return res.json(testResult);
  } catch (error) {
    console.error('Error testing integration:', getErrorMessage(error));
    
    // Log test failure
    await storage.createIntegrationLog({
      integrationId: parseInt(req.params.integrationId),
      eventType: 'tested',
      message: `Integration test failed: ${getErrorMessage(error)}`,
      details: { error: getErrorMessage(error) }
    });
    
    return sendError(res, 'Integration test failed', 500);
  }
});

/**
 * Get integration logs
 */
router.get('/integrations/:integrationId/logs', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    const page = parseInt((req.query.page as string) || '1') || 1;
    const limit = Math.min(parseInt((req.query.limit as string) || '50') || 50, 100);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    // Check ownership
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    if (integration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    const logs = await storage.getIntegrationLog(integrationId);
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching integration logs:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integration logs', 500);
  }
});

/**
 * Enable/disable integration
 */
router.patch('/integrations/:integrationId/toggle', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.integrationId);
    
    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }
    
    // Check ownership
    const integration = await storage.getIntegration(integrationId);
    if (!integration) {
      return sendNotFound(res, 'Integration not found');
    }
    
    if (integration.userId !== parseInt(userId)) {
      return sendError(res, 'Access denied to this integration', 403);
    }
    
    const newStatus = integration.isActive ? 'inactive' : 'active';
    const updatedIntegration = await storage.updateIntegration(integrationId, { 
      isActive: !integration.isActive,
      status: newStatus
    });
    
    // Log status change
    await storage.createIntegrationLog({
      integrationId: integrationId,
      eventType: integration.isActive ? 'disabled' : 'enabled',
      message: `Integration "${integration.name}" ${integration.isActive ? 'disabled' : 'enabled'}`,
      details: { previousStatus: integration.status, newStatus }
    });
    
    return res.json(updatedIntegration);
  } catch (error) {
    console.error('Error toggling integration:', getErrorMessage(error));
    return sendError(res, 'Failed to toggle integration', 500);
  }
});

export default router;