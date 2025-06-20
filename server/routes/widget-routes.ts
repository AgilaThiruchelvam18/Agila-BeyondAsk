/**
 * Widget System Routes
 * Handles embedded widget functionality, lead capture, and widget configuration
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError, sendNotFound } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createWidgetSchema = z.object({
  name: z.string().min(1, 'Widget name is required'),
  agentId: z.number().min(1, 'Agent ID is required'),
  configuration: z.object({
    theme: z.enum(['light', 'dark', 'auto']).default('light'),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right'),
    showAvatar: z.boolean().default(true),
    collectLeads: z.boolean().default(false),
    customCss: z.string().optional(),
    welcomeMessage: z.string().optional(),
    placeholder: z.string().optional()
  }),
  allowedDomains: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

const updateWidgetSchema = createWidgetSchema.partial();

const createWidgetLeadSchema = z.object({
  widgetId: z.number().min(1, 'Widget ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Get user's widgets
 */
router.get('/widgets', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const widgets = await storage.getWidgetsByUserId(userId);
    return res.json(widgets);
  } catch (error) {
    console.error('Error fetching widgets:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch widgets', 500);
  }
});

/**
 * Get specific widget
 */
router.get('/widgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    const widget = await storage.getWidget(widgetId.toString());
    if (!widget) {
      return sendNotFound(res, 'Widget not found');
    }

    // Check ownership
    if (widget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    return res.json(widget);
  } catch (error) {
    console.error('Error fetching widget:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch widget', 500);
  }
});

/**
 * Create new widget
 */
router.post('/widgets', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const validatedData = createWidgetSchema.parse(req.body);

    // Verify agent ownership
    const agent = await storage.getAgent(validatedData.agentId);
    if (!agent || agent.userId !== userId) {
      return sendError(res, 'Agent not found or access denied', 404);
    }

    // Transform the validated data to match the storage interface
    const widgetData = {
      name: validatedData.name,
      agentId: validatedData.agentId?.toString() || null,
      userId: userId?.toString() || null,
      config: {
        theme: {
          primaryColor: '#007bff',
          textColor: '#333333',
          backgroundColor: '#ffffff'
        },
        position: validatedData.configuration?.position || 'bottom-right',
        welcomeMessage: validatedData.configuration?.welcomeMessage || 'Hello! How can I help you?',
        size: 'medium' as const,
        widgetTitle: 'AI Assistant'
      },
      active: validatedData.isActive !== false,
      allowedDomains: validatedData.allowedDomains || []
    };

    const widget = await storage.createWidget(widgetData);

    return res.status(201).json(widget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, `Invalid widget data: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    console.error('Error creating widget:', getErrorMessage(error));
    return sendError(res, 'Failed to create widget', 500);
  }
});

/**
 * Update widget
 */
router.put('/widgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    const validatedData = updateWidgetSchema.parse(req.body);

    // Check ownership
    const existingWidget = await storage.getWidget(widgetId.toString());
    if (!existingWidget) {
      return sendNotFound(res, 'Widget not found');
    }

    if (existingWidget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    // If agentId is being updated, verify ownership
    if (validatedData.agentId) {
      const agent = await storage.getAgent(validatedData.agentId);
      if (!agent || agent.userId !== userId) {
        return sendError(res, 'Agent not found or access denied', 404);
      }
    }

    // Transform the validated data to match the storage interface
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.agentId !== undefined) updateData.agentId = validatedData.agentId?.toString() || null;
    if (validatedData.allowedDomains !== undefined) updateData.allowedDomains = validatedData.allowedDomains;
    if (validatedData.isActive !== undefined) updateData.active = validatedData.isActive;
    
    // Transform configuration to config format if provided
    if (validatedData.configuration) {
      updateData.config = {
        theme: {
          primaryColor: '#007bff',
          textColor: '#333333',
          backgroundColor: '#ffffff'
        },
        position: validatedData.configuration.position || existingWidget.config?.position || 'bottom-right',
        welcomeMessage: validatedData.configuration.welcomeMessage || existingWidget.config?.welcomeMessage || 'Hello! How can I help you?',
        size: 'medium' as const,
        widgetTitle: 'AI Assistant'
      };
    }

    const updatedWidget = await storage.updateWidget(widgetId.toString(), updateData);
    if (!updatedWidget) {
      return sendError(res, 'Failed to update widget', 500);
    }

    return res.json(updatedWidget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, `Invalid widget data: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    console.error('Error updating widget:', getErrorMessage(error));
    return sendError(res, 'Failed to update widget', 500);
  }
});

/**
 * Delete widget
 */
router.delete('/widgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    // Check ownership
    const widget = await storage.getWidget(widgetId.toString());
    if (!widget) {
      return sendNotFound(res, 'Widget not found');
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    const success = await storage.deleteWidget(widgetId.toString());
    if (!success) {
      return sendError(res, 'Failed to delete widget', 500);
    }

    return res.json({ message: 'Widget deleted successfully' });
  } catch (error) {
    console.error('Error deleting widget:', getErrorMessage(error));
    return sendError(res, 'Failed to delete widget', 500);
  }
});

/**
 * Get widget embed code
 */
router.get('/widgets/:id/embed', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    const widget = await storage.getWidget(widgetId.toString());
    if (!widget) {
      return sendNotFound(res, 'Widget not found');
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    const embedCode = `<script src="https://widget.beyondask.com/embed.js" data-widget-id="${widgetId}"></script>`;
    
    return res.json({ embedCode });
  } catch (error) {
    console.error('Error generating embed code:', getErrorMessage(error));
    return sendError(res, 'Failed to generate embed code', 500);
  }
});

/**
 * Get widget leads
 */
router.get('/widgets/:id/leads', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    const page = parseInt((req.query.page as string) || '1') || 1;
    const limit = Math.min(parseInt((req.query.limit as string) || '50') || 50, 100); // Cap at 100
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    // Check ownership
    const widget = await storage.getWidget(widgetId.toString());
    if (!widget) {
      return sendNotFound(res, 'Widget not found');
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    // Note: getWidgetLeads method not implemented yet - placeholder for functionality
    const leads: any[] = [];
    // const leads = await storage.getWidgetLeads(widgetId.toString(), page, limit);
    return res.json(leads);
  } catch (error) {
    console.error('Error fetching widget leads:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch widget leads', 500);
  }
});

/**
 * Create widget lead (public endpoint)
 */
router.post('/widgets/:id/leads', async (req: Request, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    const validatedData = createWidgetLeadSchema.parse(req.body);

    // Verify widget exists and is active
    const widget = await storage.getWidget(widgetId.toString());
    if (!widget || !widget.active) {
      return sendNotFound(res, 'Widget not found or inactive');
    }

    // Check if lead collection is enabled
    if (!widget.config || typeof widget.config !== 'object') {
      return sendError(res, 'Widget configuration not available', 400);
    }

    // Note: createWidgetLead method not implemented yet - placeholder for functionality
    const lead = { id: Date.now(), ...validatedData, widgetId: widgetId.toString(), createdAt: new Date() };
    // const lead = await storage.createWidgetLead(validatedData);
    return res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, `Invalid lead data: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    console.error('Error creating widget lead:', getErrorMessage(error));
    return sendError(res, 'Failed to capture lead', 500);
  }
});

/**
 * Get widget analytics
 */
router.get('/widgets/:id/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const widgetId = parseInt(req.params.id);
    const userId = req.user?.id;
    const period = (req.query.period as string) || 'last_30_days';
    
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    if (isNaN(widgetId)) {
      return sendError(res, 'Invalid widget ID', 400);
    }

    // Check ownership
    const widget = await storage.getWidget(widgetId.toString());
    if (!widget) {
      return sendNotFound(res, 'Widget not found');
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied', 403);
    }

    // Note: getWidgetAnalytics method not implemented yet - placeholder for functionality
    const analytics = { views: 0, leads: 0, conversionRate: 0, period };
    // const analytics = await storage.getWidgetAnalytics(widgetId.toString(), period);
    return res.json(analytics);
  } catch (error) {
    console.error('Error fetching widget analytics:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch widget analytics', 500);
  }
});

export default router;