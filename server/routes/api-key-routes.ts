import { Request, Response, Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';
// Removed insertApiKeySchema import to avoid validation conflicts
import { ApiKeyService } from '../services/api-key-service';
import { storage } from '../storage';
import { authenticateToken } from '../middleware/auth-middleware';

// API Key validation schema (accepts string dates from frontend)
const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  rateLimit: z.number().optional(),
  expiresAt: z.string().optional(),
  teamId: z.number().optional(),
});

const router = Router();
  // Initialize API key service with the current storage context
  const apiKeyService = new ApiKeyService(storage);
  /**
   * @swagger
   * /api/keys:
   *   get:
   *     summary: Get all API keys for the current user
   *     tags: [API Keys]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of API keys
   *       401:
   *         description: Unauthorized
   */
  router.get('/keys', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Convert the user ID to a number if it's a string
      const userId = typeof req.user.id === 'string' ? parseInt(req.user.id, 10) : req.user.id;
      const apiKeys = await apiKeyService.getUserApiKeys(userId);
      res.json(apiKeys);
    } catch (error: any) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: 'Failed to fetch API keys' });
    }
  });

  /**
   * @swagger
   * /api/keys:
   *   post:
   *     summary: Create a new API key
   *     tags: [API Keys]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - scopes
   *             properties:
   *               name:
   *                 type: string
   *                 description: Name of the API key
   *               scopes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: List of permission scopes
   *               rateLimit:
   *                 type: number
   *                 description: Rate limit for the API key (requests per minute)
   *               expiresAt:
   *                 type: string
   *                 format: date-time
   *                 description: Expiration date for the API key
   *               teamId:
   *                 type: number
   *                 description: Team ID if the key is for a team
   *     responses:
   *       201:
   *         description: API key created successfully
   *       400:
   *         description: Invalid request data
   *       401:
   *         description: Unauthorized
   */
  router.post('/keys', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validationResult = createApiKeySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        });
      }

      // Process dates if present
      let expiresAt = null;
      if (req.body.expiresAt) {
        try {
          expiresAt = new Date(req.body.expiresAt);
          if (isNaN(expiresAt.getTime())) {
            return res.status(400).json({ error: 'Invalid expiration date format' });
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid expiration date' });
        }
      }

      // Convert the user ID to a number if it's a string
      const userId = typeof req.user.id === 'string' ? parseInt(req.user.id, 10) : req.user.id;
      
      // Create the API key
      const result = await apiKeyService.createApiKey({
        userId: userId,
        name: req.body.name,
        teamId: req.body.teamId || null,
        scopes: req.body.scopes,
        rateLimit: req.body.rateLimit || 100,
        expiresAt: expiresAt
      });

      res.status(201).json({
        id: result.apiKey.id,
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt,
        fullKey: result.keyValue // Only returned once upon creation
      });
    } catch (error: any) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  /**
   * @swagger
   * /api/keys/{id}:
   *   delete:
   *     summary: Revoke an API key
   *     tags: [API Keys]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: number
   *         description: ID of the API key to revoke
   *     responses:
   *       200:
   *         description: API key revoked successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: API key not found
   */
  router.delete('/keys/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const keyId = parseInt(req.params.id);
      if (isNaN(keyId)) {
        return res.status(400).json({ error: 'Invalid API key ID' });
      }

      // Get the key first to verify ownership
      const apiKey = await storage.getApiKey(keyId);
      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      // Convert the user ID to a number if it's a string for comparison
      const userId = typeof req.user.id === 'string' ? parseInt(req.user.id, 10) : req.user.id;
      
      // Verify ownership
      if (apiKey.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden - you do not own this API key' });
      }

      const success = await apiKeyService.revokeApiKey(keyId, userId);
      if (!success) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });
export default router;

// Named export for compatibility with legacy routes
export function registerApiKeyRoutes(app: any) {
  app.use('/api', router);
}