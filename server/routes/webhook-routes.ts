import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { chatCompletion } from '../services/llm';

// Note: Express Request user type is declared in api-key-auth.ts

const router = Router();

// Schema for chat request validation
const chatRequestSchema = z.object({
  agentId: z.number().int().positive(),
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
});
/**
 * @swagger
 * /api/webhook/agents:
 *   get:
 *     summary: Get a list of all accessible agents
 *     tags: [API Webhook]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: A list of accessible agents
 *       401:
 *         description: Unauthorized
 */
router.get('/webhook/agents', apiKeyAuth(['agent:read']), async (req: Request, res: Response) => {
    try {
      // Get user ID from the API key
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Fetch agents owned by the user
      const agents = await storage.getAgentsByUserId(userId);

      // Return only necessary details
      const sanitizedAgents = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        createdAt: agent.createdAt,
        isActive: agent.isActive
      }));

      res.json(sanitizedAgents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

/**
 * @swagger
 * /api/webhook/agents/{id}:
 *   get:
 *     summary: Get details of a specific agent
 *     tags: [API Webhook]
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID of the agent to retrieve
 *     responses:
 *       200:
 *         description: Agent details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.get('/webhook/agents/:id', apiKeyAuth(['agent:read']), async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Fetch the agent
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Check if user owns the agent
      // Convert userId to the same type for comparison
      const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
      if (agent.userId !== userIdNum) {
        return res.status(403).json({ error: 'You do not have access to this agent' });
      }

      // Return sanitized agent details
      const sanitizedAgent = {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        createdAt: agent.createdAt,
        isActive: agent.isActive,
        configuration: agent.configuration
      };

      res.json(sanitizedAgent);
    } catch (error) {
      console.error('Error fetching agent details:', error);
      res.status(500).json({ error: 'Failed to fetch agent details' });
    }
  });

/**
 * @swagger
 * /api/webhook/chat:
 *   post:
 *     summary: Send a message to chat with an agent
 *     tags: [API Webhook]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agentId
 *               - message
 *             properties:
 *               agentId:
 *                 type: number
 *                 description: ID of the agent to chat with
 *               message:
 *                 type: string
 *                 description: The message to send to the agent
 *               conversationId:
 *                 type: string
 *                 description: Optional conversation ID for continuing a conversation
 *     responses:
 *       200:
 *         description: Agent response
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.post('/webhook/chat', apiKeyAuth(['agent:chat']), async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validationResult = chatRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.format()
        });
      }

      const { agentId, message, conversationId } = validationResult.data;

      // Fetch the agent
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Check if user has access to the agent
      // Convert userId to the same type for comparison
      const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
      if (agent.userId !== userIdNum) {
        return res.status(403).json({ error: 'You do not have access to this agent' });
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        const conversationIdNum = parseInt(conversationId);
        if (isNaN(conversationIdNum)) {
          return res.status(400).json({ error: 'Invalid conversation ID' });
        }
        conversation = await storage.getConversation(conversationIdNum);
        if (!conversation || conversation.userId !== userId) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
      } else {
        // Create a new conversation
        conversation = await storage.createConversation({
          userId,
          agentId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          metadata: { source: 'api' }
        });
      }

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        metadata: { source: 'api' }
      });

      // Get agent configuration
      const providerId = agent.providerId || 1; // Default to first provider if not specified
      const config = agent.configuration || {};
      
      // Extract system prompt from configuration
      const systemPrompt = typeof config === 'object' && 
        config !== null && 
        'systemPrompt' in config ? 
        config.systemPrompt as string : 
        'You are a helpful assistant.';
        
      const systemMessage = {
        role: 'system',
        content: systemPrompt
      };

      // Create the messages array with system message first
      const messages = [
        systemMessage,
        { role: 'user', content: message }
      ];

      // Extract other configuration parameters
      const model = typeof config === 'object' && 
        config !== null && 
        'model' in config ? 
        config.model as string : 
        undefined;
        
      const temperature = typeof config === 'object' && 
        config !== null && 
        'temperature' in config ? 
        config.temperature as number : 
        0.7;
        
      const maxTokens = typeof config === 'object' && 
        config !== null && 
        'maxTokens' in config ? 
        config.maxTokens as number : 
        1024;

      // Get chat completion from LLM
      const response = await chatCompletion(
        userId,
        providerId,
        messages,
        model,
        temperature,
        maxTokens
      );

      // Create assistant message in the conversation
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: response.content || 'Sorry, I could not generate a response.',
        metadata: { usage: response.usage || {} }
      });

      // Return the response
      res.json({
        id: assistantMessage.id,
        content: assistantMessage.content,
        conversationId: conversation.id,
        agentId: agent.id,
        usage: response.usage || {},
        timestamp: assistantMessage.createdAt
      });
    } catch (error) {
      console.error('Error processing chat request:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  });

export default router;