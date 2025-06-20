/**
 * User Management Routes
 * Handles user profile, preferences, and account management
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
// Removed unused generateToken import

const router = Router();

// Test endpoints for user domain optimization (development only)
if (process.env.NODE_ENV === 'development') {
  // Get user by ID (for testing)
  router.get('/users/:id', async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.params.id;
      
      // Validate ID format
      const numericId = parseInt(userId, 10);
      if (isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      
      const user = await storage.getUser(numericId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json(user);
    } catch (error) {
      console.error('Error fetching user:', getErrorMessage(error));
      return sendError(res, 'Failed to fetch user', 500);
    }
  });

  // Get user by email (for testing)
  router.get('/users/email/:email', async (req: Request, res: Response): Promise<Response> => {
    try {
      const email = req.params.email;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json(user);
    } catch (error) {
      console.error('Error fetching user by email:', getErrorMessage(error));
      return sendError(res, 'Failed to fetch user by email', 500);
    }
  });

  // Get user by authId (for testing)
  router.get('/users/auth/:authId', async (req: Request, res: Response): Promise<Response> => {
    try {
      const authId = req.params.authId;
      const user = await storage.getUserByAuthId(authId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json(user);
    } catch (error) {
      console.error('Error fetching user by authId:', getErrorMessage(error));
      return sendError(res, 'Failed to fetch user by authId', 500);
    }
  });

  // Update user by ID (for testing)
  router.put('/users/:id', async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.params.id;
      const updateData = req.body;
      
      // Validate ID format
      const numericId = parseInt(userId, 10);
      if (isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      
      const updatedUser = await storage.updateUser(numericId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json(updatedUser);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      
      // Handle UserAdapter validation errors
      if (errorMessage.includes('already in use') || errorMessage.includes('already exists')) {
        return res.status(409).json({ error: errorMessage });
      }
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ error: errorMessage });
      }
      
      console.error('Error updating user:', errorMessage);
      return sendError(res, 'Failed to update user', 500);
    }
  });
}

// Create a new user (public endpoint for registration)
router.post('/users', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { authId, email, name } = req.body;

    if (!authId || !email) {
      return sendError(res, 'authId and email are required', 400);
    }

    console.log(`POST /api/users: Creating user with email ${email}`);

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return sendError(res, 'User already exists with this email', 409);
    }

    const userData = {
      authId,
      email,
      name: name || null,
      preferences: null,
      timezone: 'UTC',
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newUser = await storage.createUser(userData);
    console.log(`POST /api/users: User created successfully with ID ${newUser.id}`);
    
    return res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', getErrorMessage(error));
    return sendError(res, 'Failed to create user', 500);
  }
});

// Get current user profile
router.get('/user', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    console.log(`GET /api/user: Fetching user profile for ID ${userIdInt}`);

    const user = await storage.getUser(userIdInt);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    console.log(`GET /api/user: User profile retrieved for ${user.email}`);
    return res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch user profile', 500);
  }
});

// Update user profile
router.put('/user', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { name, email, preferences, timezone, language } = req.body;

    console.log(`PUT /api/user: Updating user profile for ID ${userIdInt}`);

    const existingUser = await storage.getUser(userIdInt);
    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (preferences !== undefined) updateData.preferences = preferences;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (language !== undefined) updateData.language = language;

    const updatedUser = await storage.updateUser(userIdInt, updateData);

    if (!updatedUser) {
      return sendError(res, 'Failed to update user', 500);
    }

    // Remove sensitive information
    const { password, ...safeUser } = updatedUser as any;

    console.log(`PUT /api/user: User profile updated for ${updatedUser.email}`);
    return res.json(safeUser);
  } catch (error) {
    console.error('Error updating user profile:', getErrorMessage(error));
    return sendError(res, 'Failed to update user profile', 500);
  }
});

// Create user (registration)
router.post('/user', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, authId, password } = req.body;

    if (!email || !authId) {
      return sendError(res, 'Email and auth ID are required', 400);
    }

    console.log(`POST /api/user: Creating new user with email ${email}`);

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return sendError(res, 'User with this email already exists', 409);
    }

    const userData = {
      name: name || null,
      email,
      authId,
      password: password || null,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      },
      timezone: 'UTC',
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newUser = await storage.createUser(userData);

    // Remove sensitive information
    const { password: _, ...safeUser } = newUser as any;

    console.log(`POST /api/user: User created with ID ${newUser.id}`);
    return res.status(201).json(safeUser);
  } catch (error) {
    console.error('Error creating user:', getErrorMessage(error));
    return sendError(res, 'Failed to create user', 500);
  }
});

// Get user preferences
router.get('/user/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    console.log(`GET /api/user/preferences: Fetching preferences for user ID ${userIdInt}`);

    const user = await storage.getUser(userIdInt);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const userPrefs = (user as any).preferences || {};
    const preferences = {
      theme: userPrefs.theme || 'light',
      notifications: userPrefs.notifications ?? true,
      language: (user as any).language || 'en',
      timezone: (user as any).timezone || 'UTC',
      emailNotifications: userPrefs.emailNotifications ?? true,
      autoSave: userPrefs.autoSave ?? true,
      compactMode: userPrefs.compactMode ?? false
    };

    console.log(`GET /api/user/preferences: Preferences retrieved for user ${userIdInt}`);
    return res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch user preferences', 500);
  }
});

// Update user preferences
router.put('/user/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const preferences = req.body;

    console.log(`PUT /api/user/preferences: Updating preferences for user ID ${userIdInt}`);

    const existingUser = await storage.getUser(userIdInt);
    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    const existingPrefs = (existingUser as any).preferences || {};
    const updatedPreferences = Object.assign({}, existingPrefs, preferences);

    const updateData: any = {
      preferences: updatedPreferences,
      updatedAt: new Date()
    };

    // Update language and timezone at user level if provided
    if (preferences.language) updateData.language = preferences.language;
    if (preferences.timezone) updateData.timezone = preferences.timezone;

    await storage.updateUser(userIdInt, updateData);

    console.log(`PUT /api/user/preferences: Preferences updated for user ${userIdInt}`);
    return res.json(updatedPreferences);
  } catch (error) {
    console.error('Error updating user preferences:', getErrorMessage(error));
    return sendError(res, 'Failed to update user preferences', 500);
  }
});

// Get user statistics
router.get('/user/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    console.log(`GET /api/user/stats: Fetching statistics for user ID ${userIdInt}`);

    // Get various user statistics
    const [
      knowledgeBasesCount,
      agentsCount,
      documentsCount,
      conversationsCount
    ] = await Promise.all([
      storage.getUserKnowledgeBasesCount(userIdInt),
      storage.getUserAgentsCount(userIdInt),
      storage.getUserDocumentsCount(userIdInt),
      storage.getUserConversationsCount(userIdInt)
    ]);

    const stats = {
      knowledgeBases: knowledgeBasesCount,
      agents: agentsCount,
      documents: documentsCount,
      conversations: conversationsCount,
      totalQueries: Math.floor(Math.random() * 1000) + 100, // Simulated
      storageUsed: Math.floor(Math.random() * 500) + 50, // MB, simulated
      accountAge: Math.floor((Date.now() - new Date(req.user.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) // days
    };

    console.log(`GET /api/user/stats: Statistics retrieved for user ${userIdInt}`);
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching user statistics:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch user statistics', 500);
  }
});

// Get user activity log
router.get('/user/activity', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { limit = 20, offset = 0, type, startDate, endDate } = req.query;

    console.log(`GET /api/user/activity: Fetching activity log for user ID ${userIdInt}`);

    const filters = {
      type: type as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };

    const activities = await storage.getUserActivityLog(userIdInt, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      filters
    });

    console.log(`GET /api/user/activity: Found ${activities.length} activity entries`);
    return res.json(activities);
  } catch (error) {
    console.error('Error fetching user activity:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch user activity', 500);
  }
});

// Delete user account
router.delete('/user', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { confirmEmail } = req.body;

    console.log(`DELETE /api/user: Deleting user account for ID ${userIdInt}`);

    const user = await storage.getUser(userIdInt);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Require email confirmation for account deletion
    if (confirmEmail !== user.email) {
      return sendError(res, 'Email confirmation required for account deletion', 400);
    }

    // In a real implementation, you would:
    // 1. Delete all user data (knowledge bases, agents, documents, etc.)
    // 2. Cancel subscriptions
    // 3. Clean up file storage
    // 4. Log the deletion for audit purposes

    await storage.deleteUser(userIdInt);

    console.log(`DELETE /api/user: User account deleted for ID ${userIdInt}`);
    return res.json({ message: 'User account deleted successfully', id: userIdInt, deletedAt: new Date() });
  } catch (error) {
    console.error('Error deleting user account:', getErrorMessage(error));
    return sendError(res, 'Failed to delete user account', 500);
  }
});

// Export user data (GDPR compliance)
router.get('/user/export', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    console.log(`GET /api/user/export: Exporting data for user ID ${userIdInt}`);

    const user = await storage.getUser(userIdInt);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Collect all user data
    const [
      knowledgeBases,
      agents,
      documents,
      conversations
    ] = await Promise.all([
      storage.getUserKnowledgeBases(userIdInt),
      storage.getUserAgents(userIdInt),
      storage.getUserDocuments(userIdInt),
      storage.getUserConversations(userIdInt)
    ]);

    const exportData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        timezone: user.timezone,
        language: user.language,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      knowledgeBases: knowledgeBases.map((kb: any) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        createdAt: kb.createdAt
      })),
      agents: agents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        createdAt: agent.createdAt
      })),
      documents: documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        sourceType: doc.sourceType,
        createdAt: doc.createdAt
      })),
      conversations: conversations.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        messageCount: conv.messageCount
      })),
      exportedAt: new Date(),
      exportVersion: '1.0'
    };

    console.log(`GET /api/user/export: Data export completed for user ${userIdInt}`);
    return res.json(exportData);
  } catch (error) {
    console.error('Error exporting user data:', getErrorMessage(error));
    return sendError(res, 'Failed to export user data', 500);
  }
});

export default router;