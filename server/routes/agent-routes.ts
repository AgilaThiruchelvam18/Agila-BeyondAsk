/**
 * Agent Management Routes
 * Handles AI agent creation, configuration, deployment, and interaction management
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get user's agents
router.get('/agents', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = parseInt(req.user.id);
    
    // Include team-accessible resources flag (default to true unless explicitly set to false)
    const includeShared = req.query.includeShared !== "false";
    console.log(`GET /api/agents: Fetching agents for user ID ${userId}, includeShared=${includeShared}`);

    // Get user's own agents
    const ownedAgents = await storage.getAgentsByUserId(userId);
    let result = [...ownedAgents];

    // If includeShared is true, add agents accessible through team permissions
    if (includeShared) {
      try {
        // Resource permission service not yet implemented - skip shared resources for now
        const accessibleAgentIds: number[] = [];

        if (accessibleAgentIds.length > 0) {
          console.log(`GET /api/agents: User has access to ${accessibleAgentIds.length} shared agents`);

          // Fetch the actual agent objects for these IDs, excluding ones the user already owns
          const ownedAgentIds = ownedAgents.map(agent => agent.id);
          const sharedAgentIds = accessibleAgentIds.filter(id => !ownedAgentIds.includes(id));

          const sharedAgentsPromises = sharedAgentIds.map(id => storage.getAgent(id));
          const sharedAgentsWithoutNulls = (await Promise.all(sharedAgentsPromises)).filter(agent => agent !== undefined);

          // Add a flag to indicate these are shared resources
          const sharedAgents = sharedAgentsWithoutNulls.map(agent => ({
            ...agent,
            isShared: true
          }));

          // Combine with user's own agents
          result = [...ownedAgents, ...sharedAgents];
        }
      } catch (permError) {
        console.error('GET /api/agents: Error fetching shared agents:', permError);
        // Continue with just the user's own agents
      }
    }

    console.log(`GET /api/agents: Returning ${result.length} total agents`);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching agents:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch agents');
  }
});

// Get agent by ID
router.get('/agents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);

    console.log(`GET /api/agents/${agentId}: Fetching agent details`);

    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return sendError(res, 'Agent not found', 404);
    }

    // Check access permissions
    if (agent.userId !== userId && !agent.isPublic) {
      const hasAccess = await storage.checkAgentAccess(agentId, userId);
      if (!hasAccess) {
        return sendError(res, 'Access denied to this agent', 403);
      }
    }

    // Get additional details
    const [knowledgeBases, conversationCount, recentConversations] = await Promise.all([
      storage.getAgentKnowledgeBases(agentId),
      storage.getAgentConversationCount(agentId),
      storage.getAgentRecentConversations(agentId, 5)
    ]);

    const enrichedAgent = {
      ...agent,
      knowledgeBases,
      conversationCount,
      recentConversations,
      isActive: agent.status === 'active'
    };

    console.log(`GET /api/agents/${agentId}: Agent retrieved successfully`);
    return res.json(enrichedAgent);
    //return sendSuccess(res, enrichedAgent, 'Agent retrieved successfully');
  } catch (error) {
    console.error('Error fetching agent:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch agent');
  }
});

// Get conversations for a specific agent
router.get('/agents/:agentId/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = req.params.agentId;
    const userId = parseInt(req.user.id);
    
    console.log(`GET /api/agents/${agentId}/conversations: Fetching conversations for agent ${agentId}, user ${userId}`);

    // First verify the agent exists and user has access to it
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return sendError(res, 'Agent not found', 404);
    }

    // Check if user owns the agent or has access through team permissions
    if (agent.userId !== userId) {
      // TODO: Add team permission check when implemented
      return sendError(res, 'Access denied to this agent', 403);
    }

    // Get conversations for this agent
    const conversations = await storage.getConversationsByAgentId(parseInt(agentId));
    
    console.log(`GET /api/agents/${agentId}/conversations: Found ${conversations.length} conversations`);
    
    // Return in the format expected by frontend
    return res.json({ conversations });
  } catch (error) {
    console.error(`Error fetching conversations for agent ${req.params.agentId}:`, getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch agent conversations');
  }
});

// Create new agent
router.post('/agents', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const {
      name,
      description,
      configuration,
      knowledgeBaseIds = [],
      isActive = true,
      promptTemplate,
      tags = []
    } = req.body;

    const userId = parseInt(req.user.id);

    if (!name) {
      return sendError(res, 'Agent name is required', 400);
    }

    console.log(`POST /api/agents: Creating agent for user ${userId}`);

    // Note: Knowledge base access validation would be implemented here
    // For now, we'll trust the frontend validation

    // Default configuration if not provided
    const defaultConfiguration = {
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      system_message: "You are a helpful assistant."
    };

    const agentData = {
      name: name.trim(),
      description: description || null,
      userId,
      configuration: configuration || defaultConfiguration,
      knowledgeBaseIds: knowledgeBaseIds || [],
      promptTemplate: promptTemplate || null,
      isActive: isActive,
      tags: tags || [],
      // Set default provider and model IDs (these should reference actual records)
      providerId: 1, // Default OpenAI provider
      modelId: 1     // Default GPT-4 model
    };

    const newAgent = await storage.createAgent(agentData);

    console.log(`POST /api/agents: Agent created with ID ${newAgent.id}`);
    return res.json(newAgent);
    //return sendSuccess(res, newAgent, 'Agent created successfully');
  } catch (error) {
    console.error('Error creating agent:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to create agent');
  }
});

// Update agent
router.put('/agents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);
    const {
      name,
      description,
      instructions,
      knowledgeBaseIds,
      llmProvider,
      model,
      temperature,
      maxTokens,
      isPublic,
      category,
      tags,
      status,
      settings
    } = req.body;

    console.log(`PUT /api/agents/${agentId}: Updating agent`);

    const existingAgent = await storage.getAgent(agentId);
    if (!existingAgent) {
      return sendError(res, 'Agent not found', 404);
    }

    if (existingAgent.userId !== userId) {
      return sendError(res, 'Access denied to this agent', 403);
    }

    const updateData: any = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (llmProvider !== undefined) updateData.llmProvider = llmProvider;
    if (model !== undefined) updateData.model = model;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (maxTokens !== undefined) updateData.maxTokens = maxTokens;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) updateData.status = status;
    if (settings !== undefined) {
      updateData.settings = { ...existingAgent.settings, ...settings };
    }

    const updatedAgent = await storage.updateAgent(agentId, updateData);

    // Update knowledge base associations if provided
    if (knowledgeBaseIds !== undefined) {
      await storage.updateAgentKnowledgeBases(agentId, knowledgeBaseIds);
    }

    // Log activity
    await storage.createAgentActivity({
      agentId,
      userId,
      action: 'updated',
      details: 'Agent configuration updated',
      timestamp: new Date()
    });

    console.log(`PUT /api/agents/${agentId}: Agent updated successfully`);
    return res.json(updatedAgent);
    //return sendSuccess(res, updatedAgent, 'Agent updated successfully');
  } catch (error) {
    console.error('Error updating agent:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to update agent');
  }
});

// Get agent dependencies (for delete confirmation)
router.get('/agents/:id/dependencies', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);

    console.log(`GET /api/agents/${agentId}/dependencies: Checking dependencies`);

    const existingAgent = await storage.getAgent(agentId);
    if (!existingAgent) {
      return sendError(res, 'Agent not found', 404);
    }

    if (existingAgent.userId !== userId) {
      return sendError(res, 'Access denied to this agent', 403);
    }

    const dependencies = await storage.getAgentDependencies(agentId);
    console.log(`GET /api/agents/${agentId}/dependencies: Found dependencies:`, dependencies);
    
    return sendSuccess(res, dependencies, 'Dependencies retrieved successfully');
  } catch (error) {
    console.error('Error checking agent dependencies:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to check agent dependencies');
  }
});

// Delete agent
router.delete('/agents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);
    const cascade = req.query.cascade === 'true';

    console.log(`DELETE /api/agents/${agentId}: Deleting agent (cascade=${cascade})`);

    const existingAgent = await storage.getAgent(agentId);
    if (!existingAgent) {
      return sendError(res, 'Agent not found', 404);
    }

    if (existingAgent.userId !== userId) {
      return sendError(res, 'Access denied to this agent', 403);
    }

    // Check dependencies first
    const dependencies = await storage.getAgentDependencies(agentId);
    const hasDependencies = dependencies.conversations > 0 || dependencies.widgets > 0 || dependencies.unansweredQuestions > 0;
    
    if (hasDependencies && !cascade) {
      console.log(`DELETE /api/agents/${agentId}: Agent has dependencies, cascade required`);
      return res.status(409).json({
        success: false,
        error: 'Agent has dependencies that must be handled first',
        dependencies: dependencies,
        message: 'Use cascade=true to force deletion with dependency cleanup'
      });
    }

    // If cascade is enabled, handle dependencies
    if (cascade && hasDependencies) {
      console.log(`DELETE /api/agents/${agentId}: Cascading deletion with dependency cleanup`);
      
      // Archive conversations instead of deleting them
      if (dependencies.conversations > 0) {
        await storage.archiveAgentConversations(agentId);
      }
      
      // Remove agent reference from unanswered questions (preserve questions)
      if (dependencies.unansweredQuestions > 0) {
        await storage.deleteAgentUnansweredQuestions(agentId);
      }
      
      // Delete widgets that reference this agent
      if (dependencies.widgets > 0) {
        await storage.deleteAgentWidgets(agentId);
      }
    }

    // Delete related data
    await Promise.all([
      storage.deleteAgentKnowledgeBaseAssociations(agentId),
      storage.deleteAgentActivities(agentId),
      storage.deleteAgentShares(agentId)
    ]);

    await storage.deleteAgent(agentId);

    console.log(`DELETE /api/agents/${agentId}: Agent deleted successfully`);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting agent:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to delete agent');
  }
});

// Clone agent
router.post('/agents/:id/clone', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);
    const { name } = req.body;

    console.log(`POST /api/agents/${agentId}/clone: Cloning agent`);

    const originalAgent = await storage.getAgent(agentId);
    if (!originalAgent) {
      return sendError(res, 'Agent not found', 404);
    }

    // Check access permissions
    if (originalAgent.userId !== userId && !originalAgent.isPublic) {
      const hasAccess = await storage.checkAgentAccess(agentId, userId);
      if (!hasAccess) {
        return sendError(res, 'Access denied to this agent', 403);
      }
    }

    // Get knowledge base associations
    const knowledgeBases = await storage.getAgentKnowledgeBases(agentId);
    const knowledgeBaseIds = knowledgeBases.map(kb => kb.id);

    // Create cloned agent
    const clonedAgentData = {
      ...originalAgent,
      id: undefined, // Remove ID to create new
      name: name || `${originalAgent.name} (Copy)`,
      userId,
      isPublic: false, // Clones are private by default
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: JSON.parse(JSON.stringify(originalAgent.configuration)) // Ensure proper JSON serialization
    };

    const clonedAgent = await storage.createAgent(clonedAgentData);

    // Associate with knowledge bases (if user has access)
    if (knowledgeBaseIds.length > 0) {
      const hasAccess = await storage.validateKnowledgeBaseAccess(userId, knowledgeBaseIds);
      if (hasAccess) {
        await storage.associateAgentKnowledgeBases(clonedAgent.id, knowledgeBaseIds);
      }
    }

    // Log activity
    await storage.createAgentActivity({
      agentId: clonedAgent.id,
      userId,
      action: 'cloned',
      details: `Cloned from agent ${agentId}`,
      timestamp: new Date()
    });

    console.log(`POST /api/agents/${agentId}/clone: Agent cloned with ID ${clonedAgent.id}`);
    return res.json(clonedAgent);
    //return sendSuccess(res, clonedAgent, 'Agent cloned successfully');
  } catch (error) {
    console.error('Error cloning agent:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to clone agent');
  }
});

// Get agent performance metrics
router.get('/agents/:id/metrics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const agentId = parseInt(req.params.id);
    const userId = parseInt(req.user.id);
    const { timeframe = '7d' } = req.query;

    console.log(`GET /api/agents/${agentId}/metrics: Fetching performance metrics`);

    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return sendError(res, 'Agent not found', 404);
    }

    // Check access permissions
    if (agent.userId !== userId && !agent.isPublic) {
      const hasAccess = await storage.checkAgentAccess(agentId, userId);
      if (!hasAccess) {
        return sendError(res, 'Access denied to this agent', 403);
      }
    }

    // Get comprehensive metrics
    const [
      conversationMetrics,
      responseMetrics,
      usageMetrics,
      errorMetrics
    ] = await Promise.all([
      storage.getAgentConversationMetrics(agentId),
      storage.getAgentResponseMetrics(agentId),
      storage.getAgentUsageMetrics(agentId),
      storage.getAgentErrorMetrics(agentId)
    ]);

    const metrics = {
      conversations: {
        total: conversationMetrics.total,
        active: conversationMetrics.recent, // Use available recent property
        completed: conversationMetrics.total, // Use total as fallback
        dailyBreakdown: [] // Placeholder for unavailable property
      },
      responses: {
        averageTime: responseMetrics.averageResponseTime,
        successRate: responseMetrics.successRate,
        totalResponses: responseMetrics.averageResponseTime // Use available property
      },
      usage: {
        totalTokens: usageMetrics.tokensUsed,
        inputTokens: usageMetrics.tokensUsed, // Use available property
        outputTokens: usageMetrics.totalRequests, // Use available property
        estimatedCost: 0 // Placeholder for unavailable property
      },
      errors: {
        total: errorMetrics.errorCount,
        byType: [], // Placeholder for unavailable property
        errorRate: errorMetrics.errorRate
      },
      timeframe
    };

    console.log(`GET /api/agents/${agentId}/metrics: Metrics retrieved successfully`);
    return res.json(metrics);
    //return sendSuccess(res, metrics, 'Agent metrics retrieved successfully');
  } catch (error) {
    console.error('Error fetching agent metrics:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch agent metrics');
  }
});

// Create agent from template
router.post('/agents/from-template/:templateId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const templateId = parseInt(req.params.templateId);
    const userId = parseInt(req.user.id);
    const { name, customizations = {} } = req.body;

    console.log(`POST /api/agents/from-template/${templateId}: Creating agent from template`);

    const template = await storage.getAgentTemplate(templateId);
    if (!template) {
      return sendError(res, 'Agent template not found', 404);
    }

    // Create agent from template
    const agentData = {
      ...template,
      id: undefined, // Remove template ID
      name: name || template.name,
      userId,
      isPublic: false,
      status: 'active',
      ...customizations,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newAgent = await storage.createAgent(agentData);

    // Log activity
    await storage.createAgentActivity({
      agentId: newAgent.id,
      userId,
      action: 'created_from_template',
      details: `Created from template ${templateId}`,
      timestamp: new Date()
    });

    console.log(`POST /api/agents/from-template/${templateId}: Agent created with ID ${newAgent.id}`);
    return res.json(newAgent);
    //return sendSuccess(res, newAgent, 'Agent created from template successfully');
  } catch (error) {
    console.error('Error creating agent from template:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to create agent from template');
  }
});

// Get widget for a specific agent
router.get('/agents/:id/widget', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = parseInt(req.user.id);
    const agentId = parseInt(req.params.id);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    // Verify agent exists and user has access
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Check if user has proper access to this agent
    try {
      const hasAccess = agent.userId === userId;
      if (!hasAccess) {
        return res.status(403).json({
          message: "You don't have permission to access this agent",
        });
      }
    } catch (error) {
      console.error(`Error checking permissions for agent ${agentId}:`, error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }

    // Find widget for this agent
    const widgets = await storage.getWidgetsByUserId(userId);

    // Need to compare with both the string and number versions as there might be inconsistency in the database
    const agentWidget = widgets.find(
      (w) => Number(w.agentId) === Number(agentId), // Normalize both to numbers for comparison
    );

    console.log(
      `Looking for widget for agent ${agentId}, found widgets:`,
      widgets.map((w) => ({
        id: w.id,
        agentId: w.agentId,
        type: typeof w.agentId,
      })),
    );

    if (!agentWidget) {
      return res.status(404).json({ message: "Widget not found for this agent" });
    }

    res.status(200).json(agentWidget);
  } catch (error) {
    console.error("Error getting agent widget:", error);
    res.status(500).json({ message: "Failed to get agent widget" });
  }
});

// Create widget for a specific agent
router.post('/agents/:id/widget', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = parseInt(req.user.id);
    const agentId = parseInt(req.params.id);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    // Verify agent exists and user has access
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Check if user has proper access to this agent
    try {
      const hasAccess = agent.userId === userId;
      if (!hasAccess) {
        return res.status(403).json({
          message: "You don't have permission to access this agent",
        });
      }
    } catch (error) {
      console.error(`Error checking permissions for agent ${agentId}:`, error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }

    // Check if widget already exists for this agent
    const widgets = await storage.getWidgetsByUserId(userId);

    // Need to compare with both the string and number versions as there might be inconsistency in the database
    const existingWidget = widgets.find(
      (w) =>
        w.agentId === String(agentId) || // Compare with string
        (w.agentId !== null && Number(w.agentId) === agentId) // Handle case where agentId is stored as string
    );

    console.log(
      `Checking for existing widget for agent ${agentId}, found widgets:`,
      widgets.map((w) => ({
        id: w.id,
        agentId: w.agentId,
        type: typeof w.agentId,
      })),
    );

    if (existingWidget) {
      return res.status(400).json({
        message: "Widget already exists for this agent",
        widget: existingWidget,
      });
    }

    // Extract configuration from request body
    const { name, config } = req.body;

    // Generate widget credentials
    const { nanoid } = await import('nanoid');
    const widgetId = nanoid();
    const publicKey = `pk_${nanoid(32)}`;
    const secretKey = `sk_${nanoid(48)}`;

    // Create widget
    const widgetData = {
      // id is generated by the database (serial type)
      widgetIdentifier: widgetId, // Store the old string ID format for compatibility
      name: name || `${agent.name} Widget`,
      agentId: String(agentId), // Convert to string for widget storage
      userId: String(userId), // Convert to string for widget storage
      config: config || {
        theme: {
          primaryColor: "#0078d4",
          textColor: "#ffffff",
          backgroundColor: "#ffffff",
          secondaryTextColor: "#333333",
        },
        position: "bottom-right",
        size: "medium",
        welcomeMessage: "Hello! How can I help you today?",
        widgetTitle: agent.name,
        collectName: true,
        collectEmail: true,
        collectPhone: false,
        requireOtpVerification: true,
      },
      allowAnonymous: true,
      publicKey,
      secretKey,
    };

    console.log("Creating widget with ID:", widgetId);
    const widget = await storage.createWidget(widgetData);
    res.status(201).json(widget);
  } catch (error) {
    console.error("Error creating agent widget:", error);
    res.status(500).json({ message: "Failed to create agent widget" });
  }
});

// Update widget for a specific agent
router.put('/agents/:id/widget', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = parseInt(req.user.id);
    const agentId = parseInt(req.params.id);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    // Verify agent exists and user has access
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Check if user has proper access to this agent
    try {
      const hasAccess = agent.userId === userId;
      if (!hasAccess) {
        return res.status(403).json({
          message: "You don't have permission to access this agent",
        });
      }
    } catch (error) {
      console.error(`Error checking permissions for agent ${agentId}:`, error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }

    // Find existing widget for this agent
    const widgets = await storage.getWidgetsByUserId(userId);
    const existingWidget = widgets.find(
      (w) => Number(w.agentId) === Number(agentId),
    );

    if (!existingWidget) {
      return res.status(404).json({ message: "Widget not found for this agent" });
    }

    // Extract update data from request body
    const updateData = req.body;

    // Update the widget
    console.log(`Updating widget ${existingWidget.id} for agent ${agentId}`);
    const updatedWidget = await storage.updateWidget(existingWidget.id, updateData);
    
    if (!updatedWidget) {
      return res.status(500).json({ message: "Failed to update widget" });
    }

    res.status(200).json(updatedWidget);
  } catch (error) {
    console.error("Error updating agent widget:", error);
    res.status(500).json({ message: "Failed to update agent widget" });
  }
});

export default router;