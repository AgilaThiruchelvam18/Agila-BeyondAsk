/**
 * Team Resource Permission Routes
 * Handles team-based resource permissions for knowledge bases, agents, and other resources
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';
import { resourceTypeEnum } from '@shared/schema';

const router = Router();

// Validation schemas
const createResourcePermissionSchema = z.object({
  resourceType: resourceTypeEnum,
  resourceId: z.number(),
  permissions: z.array(z.string()).default(['read'])
});

const updateResourcePermissionSchema = z.object({
  permissions: z.array(z.string())
});

/**
 * Get team resource permissions
 */
router.get('/teams/:teamId/permissions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const resourceType = req.query.resourceType as string;
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Validate resource type if provided
    if (resourceType && !resourceTypeEnum.safeParse(resourceType).success) {
      return sendError(res, 'Invalid resource type', 400);
    }
    
    // Check if user is a team member
    const hasAccess = await storage.hasTeamAccess(teamId, userId);
    if (!hasAccess) {
      return sendError(res, 'You are not a member of this team', 403);
    }
    
    const permissions = await storage.getTeamResourcePermissionsByTeamId(
      teamId,
      resourceType as any
    );
    
    return res.json(permissions);
  } catch (error) {
    console.error('Error getting team resource permissions:', getErrorMessage(error));
    return sendError(res, 'Failed to get team resource permissions', 500);
  }
});

/**
 * Create team resource permission
 */
router.post('/teams/:teamId/permissions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createResourcePermissionSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid permission data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const { resourceType, resourceId, permissions } = validation.data;
    
    const permission = await storage.createTeamResourcePermission({
      teamId: teamId,
      resourceType: resourceType,
      resourceId: resourceId,
      createdBy: userId
    });
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'grant',
      entityType: 'resource_permission',
      entityId: permission.id.toString(),
      details: { resourceType, resourceId, permissions }
    });
    
    return res.status(201).json(permission);
  } catch (error) {
    console.error('Error creating team resource permission:', getErrorMessage(error));
    return sendError(res, 'Failed to create team resource permission', 500);
  }
});

/**
 * Update team resource permission
 */
router.put('/teams/:teamId/permissions/:permissionId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = updateResourcePermissionSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid permission data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const permissionId = parseInt(req.params.permissionId);
    
    if (isNaN(teamId) || isNaN(permissionId)) {
      return sendError(res, 'Invalid team or permission ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const { permissions } = validation.data;
    
    const updatedPermission = await storage.updateTeamResourcePermission(permissionId, {
      createdBy: userId
    });
    
    if (!updatedPermission) {
      return sendError(res, 'Resource permission not found', 404);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'update',
      entityType: 'resource_permission',
      entityId: permissionId.toString(),
      details: { permissions }
    });
    
    return res.json(updatedPermission);
  } catch (error) {
    console.error('Error updating team resource permission:', getErrorMessage(error));
    return sendError(res, 'Failed to update team resource permission', 500);
  }
});

/**
 * Delete team resource permission
 */
router.delete('/teams/:teamId/permissions/:permissionId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const permissionId = parseInt(req.params.permissionId);
    
    if (isNaN(teamId) || isNaN(permissionId)) {
      return sendError(res, 'Invalid team or permission ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    // Get the permission before deleting for logging
    const permission = await storage.getTeamResourcePermission(teamId, permissionId as any, permissionId);
    if (!permission) {
      return sendError(res, 'Resource permission not found', 404);
    }
    
    const success = await storage.deleteTeamResourcePermission(teamId, permission.resourceType as "agent" | "knowledgeBase", permission.resourceId);
    if (!success) {
      return sendError(res, 'Failed to delete resource permission', 500);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'revoke',
      entityType: 'resource_permission',
      entityId: permissionId.toString(),
      details: { 
        resourceType: permission.resourceType,
        resourceId: permission.resourceId
      }
    });
    
    return res.json({ message: 'Resource permission deleted successfully', permissionId });
  } catch (error) {
    console.error('Error deleting team resource permission:', getErrorMessage(error));
    return sendError(res, 'Failed to delete team resource permission', 500);
  }
});

/**
 * Get team integrations
 */
router.get('/teams/:teamId/integrations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user is a team member
    const hasAccess = await storage.hasTeamAccess(teamId, userId);
    if (!hasAccess) {
      return sendError(res, 'You are not a member of this team', 403);
    }
    
    // Get integrations for team
    const integrations = await storage.getIntegrationsByTeamId(teamId);
    
    return res.json(integrations);
  } catch (error) {
    console.error('Error getting team integrations:', getErrorMessage(error));
    return sendError(res, 'Failed to get team integrations', 500);
  }
});

export default router;