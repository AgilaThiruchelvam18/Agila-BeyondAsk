/**
 * Widget Management Routes
 * Handles embeddable widgets, configurations, analytics, and customization
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get user's widgets
router.get('/widgets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = req.user.id;
    const { type, status } = req.query;

    console.log(`GET /api/widgets: Fetching widgets for user ${userId}`);

    let widgets = await storage.getUserWidgets(userId);

    // Apply filters
    if (type) {
      widgets = widgets.filter(widget => widget.type === type);
    }
    if (status) {
      widgets = widgets.filter(widget => widget.status === status);
    }

    console.log(`GET /api/widgets: Found ${widgets.length} widgets`);
    return res.json(widgets);
    //return sendSuccess(res, widgets, 'Widgets retrieved successfully');
  } catch (error) {
    console.error('Error fetching widgets:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch widgets');
  }
});

// Get widget by ID
router.get('/widgets/:id', async (req: Request, res: Response) => {
  try {
    const widgetId = parseInt(req.params.id);
    console.log(`GET /api/widgets/${widgetId}: Fetching widget details`);

    const widget = await storage.getWidgetById(widgetId);
    if (!widget) {
      return sendError(res, 'Widget not found', 404);
    }

    // For public access, don't require authentication but mask sensitive data
    const isPublicAccess = !req.headers.authorization;
    if (isPublicAccess) {
      const publicWidget = {
        id: widget.id,
        name: widget.name,
        type: widget.type,
        config: widget.config,
        customization: widget.customization,
        isActive: widget.status === 'active'
      };
      //return sendSuccess(res, publicWidget, 'Widget retrieved successfully');
      return res.json(publicWidget);
    }
    return res.json(widget);
    //return sendSuccess(res, widget, 'Widget retrieved successfully');
  } catch (error) {
    console.error('Error fetching widget:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch widget');
  }
});

// Create new widget
router.post('/widgets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const {
      name,
      type,
      agentId,
      knowledgeBaseIds = [],
      config = {},
      customization = {},
      allowedDomains = []
    } = req.body;
    const userId = req.user.id;

    if (!name || !type) {
      return sendError(res, 'Name and type are required', 400);
    }

    const supportedTypes = ['chat', 'search', 'qa', 'assistant', 'form'];
    if (!supportedTypes.includes(type)) {
      return sendError(res, `Unsupported widget type. Supported types: ${supportedTypes.join(', ')}`, 400);
    }

    console.log(`POST /api/widgets: Creating ${type} widget for user ${userId}`);

    const widgetData = {
      userId,
      name: name.trim(),
      type,
      agentId: agentId || null,
      knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
      config: JSON.stringify(config),
      customization: JSON.stringify(customization),
      allowedDomains: JSON.stringify(allowedDomains),
      status: 'draft',
      embedCode: '',
      accessKey: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newWidget = await storage.createWidget(widgetData);

    // Generate embed code and access key
    const accessKey = `widget_${newWidget.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const embedCode = `<script src="https://your-domain.com/widget.js" data-widget-id="${newWidget.id}" data-access-key="${accessKey}"></script>`;

    const updatedWidget = await storage.updateWidget(newWidget.id, {
      embedCode,
      accessKey
    });

    console.log(`POST /api/widgets: Widget created with ID ${updatedWidget.id}`);
    return res.json(updatedWidget);
    //return sendSuccess(res, updatedWidget, 'Widget created successfully');
  } catch (error) {
    console.error('Error creating widget:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to create widget');
  }
});

// Update widget
router.put('/widgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const widgetId = parseInt(req.params.id);
    const userId = req.user.id;
    const {
      name,
      agentId,
      knowledgeBaseIds,
      config,
      customization,
      allowedDomains,
      status
    } = req.body;

    console.log(`PUT /api/widgets/${widgetId}: Updating widget`);

    const existingWidget = await storage.getWidgetById(widgetId);
    if (!existingWidget) {
      return sendError(res, 'Widget not found', 404);
    }

    if (existingWidget.userId !== userId) {
      return sendError(res, 'Access denied to this widget', 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (name !== undefined) updateData.name = name.trim();
    if (agentId !== undefined) updateData.agentId = agentId;
    if (knowledgeBaseIds !== undefined) updateData.knowledgeBaseIds = JSON.stringify(knowledgeBaseIds);
    if (config !== undefined) updateData.config = JSON.stringify(config);
    if (customization !== undefined) updateData.customization = JSON.stringify(customization);
    if (allowedDomains !== undefined) updateData.allowedDomains = JSON.stringify(allowedDomains);
    if (status !== undefined) updateData.status = status;

    const updatedWidget = await storage.updateWidget(widgetId, updateData);

    console.log(`PUT /api/widgets/${widgetId}: Widget updated successfully`);
    return res.json(updatedWidget);
    //return sendSuccess(res, updatedWidget, 'Widget updated successfully');
  } catch (error) {
    console.error('Error updating widget:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to update widget');
  }
});

// Delete widget
router.delete('/widgets/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const widgetId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log(`DELETE /api/widgets/${widgetId}: Deleting widget`);

    const existingWidget = await storage.getWidgetById(widgetId);
    if (!existingWidget) {
      return sendError(res, 'Widget not found', 404);
    }

    if (existingWidget.userId !== userId) {
      return sendError(res, 'Access denied to this widget', 403);
    }

    await storage.deleteWidget(widgetId);

    console.log(`DELETE /api/widgets/${widgetId}: Widget deleted successfully`);
    return sendSuccess(res, { id: widgetId }, 'Widget deleted successfully');
  } catch (error) {
    console.error('Error deleting widget:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to delete widget');
  }
});

// Get widget analytics
router.get('/widgets/:id/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const widgetId = parseInt(req.params.id);
    const userId = req.user.id;
    const { period = '7d' } = req.query;

    console.log(`GET /api/widgets/${widgetId}/analytics: Fetching analytics for period ${period}`);

    const widget = await storage.getWidgetById(widgetId);
    if (!widget) {
      return sendError(res, 'Widget not found', 404);
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied to this widget', 403);
    }

    // Get analytics data
    const analytics = await storage.getWidgetAnalytics(widgetId, period as string);

    // Calculate additional metrics
    const totalViews = analytics.reduce((sum, day) => sum + day.views, 0);
    const totalInteractions = analytics.reduce((sum, day) => sum + day.interactions, 0);
    const avgInteractionRate = totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;

    const analyticsData = {
      widgetId,
      period,
      totalViews,
      totalInteractions,
      interactionRate: Math.round(avgInteractionRate * 100) / 100,
      dailyData: analytics,
      topDomains: [
        { domain: 'example.com', views: Math.floor(totalViews * 0.6) },
        { domain: 'demo.com', views: Math.floor(totalViews * 0.3) },
        { domain: 'test.com', views: Math.floor(totalViews * 0.1) }
      ]
    };

    console.log(`GET /api/widgets/${widgetId}/analytics: Analytics retrieved successfully`);
    return res.json(analyticsData);
    //return sendSuccess(res, analyticsData, 'Widget analytics retrieved successfully');
  } catch (error) {
    console.error('Error fetching widget analytics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch widget analytics');
  }
});

// Handle widget interaction (public endpoint)
router.post('/widgets/:id/interact', async (req: Request, res: Response) => {
  try {
    const widgetId = parseInt(req.params.id);
    const { accessKey, message, sessionId, domain } = req.body;

    console.log(`POST /api/widgets/${widgetId}/interact: Processing widget interaction`);

    if (!accessKey || !message) {
      return sendError(res, 'Access key and message are required', 400);
    }

    const widget = await storage.getWidgetById(widgetId);
    if (!widget) {
      return sendError(res, 'Widget not found', 404);
    }

    if (widget.status !== 'active') {
      return sendError(res, 'Widget is not active', 400);
    }

    if (widget.accessKey !== accessKey) {
      return sendError(res, 'Invalid access key', 403);
    }

    // Check domain restrictions
    if (widget.allowedDomains && widget.allowedDomains.length > 0) {
      const allowedDomains = JSON.parse(widget.allowedDomains);
      if (domain && !allowedDomains.some((allowed: string) => domain.includes(allowed))) {
        return sendError(res, 'Domain not allowed', 403);
      }
    }

    // Process the interaction based on widget type
    let response: any = {};

    switch (widget.type) {
      case 'chat':
      case 'assistant':
        response = {
          type: 'message',
          content: `Thank you for your message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}". This is a simulated response from the ${widget.name} widget.`,
          timestamp: new Date().toISOString(),
          sessionId: sessionId || `session_${Date.now()}`
        };
        break;

      case 'search':
        response = {
          type: 'search_results',
          query: message,
          results: [
            {
              title: 'Sample Result 1',
              snippet: 'This is a sample search result for your query.',
              url: '#'
            },
            {
              title: 'Sample Result 2', 
              snippet: 'Another relevant result matching your search.',
              url: '#'
            }
          ],
          total: 2
        };
        break;

      case 'qa':
        response = {
          type: 'answer',
          question: message,
          answer: 'This is a simulated answer to your question. In a real implementation, this would query the knowledge base.',
          confidence: 0.85,
          sources: ['Document 1', 'Document 2']
        };
        break;

      case 'form':
        response = {
          type: 'form_response',
          message: 'Form submission received successfully.',
          submissionId: `form_${Date.now()}`
        };
        break;

      default:
        response = {
          type: 'message',
          content: 'Widget interaction processed successfully.'
        };
    }

    // Track interaction analytics
    await storage.trackWidgetInteraction(widgetId, {
      sessionId: sessionId || `session_${Date.now()}`,
      message,
      response: JSON.stringify(response),
      domain: domain || 'unknown',
      timestamp: new Date()
    });

    console.log(`POST /api/widgets/${widgetId}/interact: Interaction processed successfully`);
    return res.json(response);
    //return sendSuccess(res, response, 'Widget interaction processed successfully');
  } catch (error) {
    console.error('Error processing widget interaction:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to process widget interaction');
  }
});

// Get widget embed code
router.get('/widgets/:id/embed', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const widgetId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log(`GET /api/widgets/${widgetId}/embed: Fetching embed code`);

    const widget = await storage.getWidgetById(widgetId);
    if (!widget) {
      return sendError(res, 'Widget not found', 404);
    }

    if (widget.userId !== userId) {
      return sendError(res, 'Access denied to this widget', 403);
    }

    const embedData = {
      widgetId: widget.id,
      embedCode: widget.embedCode,
      instructions: [
        '1. Copy the embed code below',
        '2. Paste it into your website HTML where you want the widget to appear',
        '3. The widget will automatically load and be ready for interactions',
        '4. Customize the appearance using the widget configuration panel'
      ],
      customizationOptions: {
        theme: 'light/dark',
        position: 'bottom-right/bottom-left/center',
        size: 'small/medium/large',
        colors: 'primary/secondary/accent'
      }
    };

    console.log(`GET /api/widgets/${widgetId}/embed: Embed code retrieved successfully`);
    return res.json(embedData);
    //return sendSuccess(res, embedData, 'Widget embed code retrieved successfully');
  } catch (error) {
    console.error('Error fetching widget embed code:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch widget embed code');
  }
});

export default router;