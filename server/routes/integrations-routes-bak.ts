/**
 * Integrations Management Routes
 * Handles third-party service connections, OAuth flows, and API integrations
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get all available integration providers
router.get('/integrations/providers', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    console.log('GET /api/integrations/providers: Fetching available integration providers');

    const providers = [
      {
        id: 'google-drive',
        name: 'Google Drive',
        type: 'cloud-storage',
        description: 'Access and sync files from Google Drive',
        authType: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        icon: 'google-drive'
      },
      {
        id: 'dropbox',
        name: 'Dropbox', 
        type: 'cloud-storage',
        description: 'Connect to your Dropbox account',
        authType: 'oauth2',
        scopes: ['files.content.read'],
        icon: 'dropbox'
      },
      {
        id: 'slack',
        name: 'Slack',
        type: 'communication',
        description: 'Send notifications and interact with Slack channels',
        authType: 'oauth2',
        scopes: ['chat:write', 'channels:read'],
        icon: 'slack'
      },
      {
        id: 'notion',
        name: 'Notion',
        type: 'productivity',
        description: 'Access Notion databases and pages',
        authType: 'oauth2',
        scopes: ['read_content'],
        icon: 'notion'
      },
      {
        id: 'github',
        name: 'GitHub',
        type: 'development',
        description: 'Access repositories and code documentation',
        authType: 'oauth2',
        scopes: ['repo', 'read:user'],
        icon: 'github'
      }
    ];

    console.log(`GET /api/integrations/providers: Found ${providers.length} providers`);
    return res.json(providers);
  } catch (error) {
    console.error('Error fetching integration providers:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch integration providers', 500);
  }
});

// Get user's connected integrations
router.get('/integrations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    console.log(`GET /api/integrations: Fetching integrations for user ${userId}`);

    const integrations = await storage.getUserIntegrations(userId);

    // Mask sensitive data
    const maskedIntegrations = integrations.map(integration => ({
      id: integration.id,
      providerId: integration.providerId,
      providerName: integration.providerName,
      accountName: integration.accountName,
      isActive: integration.isActive,
      permissions: integration.permissions,
      connectedAt: integration.connectedAt,
      lastSyncAt: integration.lastSyncAt,
      status: integration.status
    }));

    console.log(`GET /api/integrations: Found ${maskedIntegrations.length} integrations`);
    return res.json(maskedIntegrations);
  } catch (error) {
    console.error('Error fetching user integrations:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch user integrations', 500);
  }
});

// Initiate OAuth flow for integration
router.post('/integrations/connect/:providerId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { providerId } = req.params;
    const { redirectUrl } = req.body;

    if (!providerId) {
      return sendError(res, 'Provider ID is required', 400);
    }

    console.log(`POST /api/integrations/connect/${providerId}: Initiating OAuth flow for user ${userId}`);

    // Validate provider
    const supportedProviders = ['google-drive', 'dropbox', 'slack', 'notion', 'github'];
    if (!supportedProviders.includes(providerId)) {
      return sendError(res, 'Unsupported integration provider', 400);
    }

    // Generate state parameter for security
    const state = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Mock OAuth URLs for demonstration
    const oauthUrls = {
      'google-drive': `https://accounts.google.com/oauth/authorize?client_id=mock&redirect_uri=${encodeURIComponent(redirectUrl || 'http://localhost:3000/auth/callback')}&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code&state=${state}`,
      'dropbox': `https://www.dropbox.com/oauth2/authorize?client_id=mock&redirect_uri=${encodeURIComponent(redirectUrl || 'http://localhost:3000/auth/callback')}&response_type=code&state=${state}`,
      'slack': `https://slack.com/oauth/v2/authorize?client_id=mock&scope=chat:write,channels:read&redirect_uri=${encodeURIComponent(redirectUrl || 'http://localhost:3000/auth/callback')}&state=${state}`,
      'notion': `https://api.notion.com/v1/oauth/authorize?client_id=mock&redirect_uri=${encodeURIComponent(redirectUrl || 'http://localhost:3000/auth/callback')}&response_type=code&state=${state}`,
      'github': `https://github.com/login/oauth/authorize?client_id=mock&redirect_uri=${encodeURIComponent(redirectUrl || 'http://localhost:3000/auth/callback')}&scope=repo,user:email&state=${state}`
    };

    const authUrl = oauthUrls[providerId as keyof typeof oauthUrls];

    // Store OAuth state for validation
    await storage.createOAuthState({
      state,
      userId,
      providerId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date()
    });

    console.log(`POST /api/integrations/connect/${providerId}: OAuth URL generated`);
    return res.status(201).json({ authUrl, state });
  } catch (error) {
    console.error('Error initiating OAuth flow:', getErrorMessage(error));
    return sendError(res, 'Failed to initiate OAuth flow', 500);
  }
});

// Handle OAuth callback
router.post('/integrations/callback', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { code, state, error: oauthError } = req.body;

    console.log(`POST /api/integrations/callback: Processing OAuth callback for user ${userId}`);

    if (oauthError) {
      return sendError(res, `OAuth error: ${oauthError}`, 400);
    }

    if (!code || !state) {
      return sendError(res, 'Missing authorization code or state', 400);
    }

    // Validate state parameter
    const oauthState = await storage.getOAuthState(state);
    if (!oauthState) {
      return sendError(res, 'Invalid or expired OAuth state', 400);
    }

    if (oauthState.userId !== userId) {
      return sendError(res, 'OAuth state user mismatch', 403);
    }

    if (new Date() > oauthState.expiresAt) {
      return sendError(res, 'OAuth state expired', 400);
    }

    // Mock token exchange (in real implementation, exchange code for tokens)
    const mockTokens = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expires_in: 3600,
      token_type: 'Bearer'
    };

    // Create integration record
    const integrationData = {
      userId,
      providerId: oauthState.providerId,
      providerName: oauthState.providerId.charAt(0).toUpperCase() + oauthState.providerId.slice(1),
      accountName: 'Connected Account',
      accessToken: mockTokens.access_token,
      refreshToken: mockTokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + mockTokens.expires_in * 1000),
      permissions: ['read'],
      isActive: true,
      connectedAt: new Date(),
      lastSyncAt: null,
      status: 'connected'
    };

    const integration = await storage.createIntegration(integrationData);

    // Clean up OAuth state
    await storage.deleteOAuthState(state);

    const responseData = {
      id: integration.id,
      providerId: integration.providerId,
      providerName: integration.providerName,
      accountName: integration.accountName,
      isActive: integration.isActive,
      connectedAt: integration.connectedAt,
      status: integration.status
    };

    console.log(`POST /api/integrations/callback: Integration created with ID ${integration.id}`);
    return res.status(201).json(responseData);
  } catch (error) {
    console.error('Error processing OAuth callback:', getErrorMessage(error));
    return sendError(res, 'Failed to process OAuth callback', 500);
  }
});

// Update integration settings
router.put('/integrations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.id);
    const { isActive, permissions, accountName } = req.body;

    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }

    console.log(`PUT /api/integrations/${integrationId}: Updating integration`);

    const existingIntegration = await storage.getIntegrationById(integrationId);
    if (!existingIntegration) {
      return sendError(res, 'Integration not found', 404);
    }

    if (existingIntegration.userId !== userId) {
      return sendError(res, 'Access denied to this integration', 403);
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (accountName !== undefined) updateData.accountName = accountName.trim();

    const updatedIntegration = await storage.updateIntegration(integrationId, updateData);

    const responseData = {
      id: updatedIntegration.id,
      providerId: updatedIntegration.providerId,
      providerName: updatedIntegration.providerName,
      accountName: updatedIntegration.accountName,
      isActive: updatedIntegration.isActive,
      permissions: updatedIntegration.permissions,
      connectedAt: updatedIntegration.connectedAt,
      status: updatedIntegration.status
    };

    console.log(`PUT /api/integrations/${integrationId}: Integration updated successfully`);
    return res.json(responseData);
  } catch (error) {
    console.error('Error updating integration:', getErrorMessage(error));
    return sendError(res, 'Failed to update integration', 500);
  }
});

// Disconnect integration
router.delete('/integrations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.id);

    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }

    console.log(`DELETE /api/integrations/${integrationId}: Disconnecting integration`);

    const existingIntegration = await storage.getIntegrationById(integrationId);
    if (!existingIntegration) {
      return sendError(res, 'Integration not found', 404);
    }

    if (existingIntegration.userId !== userId) {
      return sendError(res, 'Access denied to this integration', 403);
    }

    await storage.deleteIntegration(integrationId);

    console.log(`DELETE /api/integrations/${integrationId}: Integration disconnected successfully`);
    return res.json({ message: 'Integration disconnected successfully', id: integrationId });
  } catch (error) {
    console.error('Error disconnecting integration:', getErrorMessage(error));
    return sendError(res, 'Failed to disconnect integration', 500);
  }
});

// Sync data from integration
router.post('/integrations/:id/sync', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.id);
    const { syncType = 'full' } = req.body;

    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }

    console.log(`POST /api/integrations/${integrationId}/sync: Starting ${syncType} sync`);

    const integration = await storage.getIntegrationById(integrationId);
    if (!integration) {
      return sendError(res, 'Integration not found', 404);
    }

    if (integration.userId !== userId) {
      return sendError(res, 'Access denied to this integration', 403);
    }

    if (!integration.isActive) {
      return sendError(res, 'Integration is not active', 400);
    }

    // Mock sync process
    const syncResult = {
      syncId: `sync_${Date.now()}`,
      integrationId,
      syncType,
      startedAt: new Date(),
      status: 'in_progress',
      itemsProcessed: 0,
      itemsTotal: 100, // Mock total
      errors: []
    };

    // Update integration last sync time
    await storage.updateIntegration(integrationId, { lastSyncAt: new Date() });

    // In real implementation, this would trigger an async sync process
    setTimeout(async () => {
      // Mock completion after 5 seconds
      syncResult.status = 'completed';
      syncResult.itemsProcessed = 100;
    }, 5000);

    console.log(`POST /api/integrations/${integrationId}/sync: Sync initiated with ID ${syncResult.syncId}`);
    return res.status(201).json(syncResult);
  } catch (error) {
    console.error('Error initiating sync:', getErrorMessage(error));
    return sendError(res, 'Failed to initiate data sync', 500);
  }
});

// Get integration sync status
router.get('/integrations/:id/sync-status', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const integrationId = parseInt(req.params.id);

    if (isNaN(integrationId)) {
      return sendError(res, 'Invalid integration ID', 400);
    }

    console.log(`GET /api/integrations/${integrationId}/sync-status: Fetching sync status`);

    const integration = await storage.getIntegrationById(integrationId);
    if (!integration) {
      return sendError(res, 'Integration not found', 404);
    }

    if (integration.userId !== userId) {
      return sendError(res, 'Access denied to this integration', 403);
    }

    // Mock sync status
    const syncStatus = {
      integrationId,
      lastSyncAt: integration.lastSyncAt,
      isCurrentlySyncing: false,
      lastSyncResult: {
        status: 'completed',
        itemsProcessed: 100,
        itemsTotal: 100,
        completedAt: integration.lastSyncAt,
        errors: []
      },
      nextScheduledSync: null
    };

    console.log(`GET /api/integrations/${integrationId}/sync-status: Sync status retrieved`);
    return res.json(syncStatus);
  } catch (error) {
    console.error('Error fetching sync status:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch sync status', 500);
  }
});

export default router;