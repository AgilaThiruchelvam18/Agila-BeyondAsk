/**
 * LLM Management Routes
 * Handles language model providers, API keys, chat requests, and embeddings
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendSuccess, sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get available LLM providers
router.get('/llm/providers', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    console.log('GET /api/llm/providers: Fetching available LLM providers');

    // Use the legacy getLlmProviders function to get real database providers
    const { getLlmProviders } = await import('../services/llm');
    const providers = await getLlmProviders();

    console.log(`GET /api/llm/providers: Found ${providers.length} providers`);
    return res.json(providers);
  } catch (error) {
    console.error('Error fetching LLM providers:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch LLM providers');
  }
});

// Get models for a specific LLM provider
router.get('/llm/providers/:id/models', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const providerId = req.params.id;
    console.log(`GET /api/llm/providers/${providerId}/models: Fetching models for provider`);

    // Use the legacy getLlmModels function to get real database models
    const { getLlmModels } = await import('../services/llm');
    const models = await getLlmModels(providerId);

    console.log(`GET /api/llm/providers/${providerId}/models: Found ${models.length} models`);
    return res.json(models);
  } catch (error) {
    console.error('Error fetching LLM models:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch LLM models');
  }
});

// Get user's LLM API keys
router.get('/llm/api-keys', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const userId = req.user.id;
    console.log(`GET /api/llm/api-keys: Fetching API keys for user ${userId}`);

    // Use the legacy getUserApiKeys function to get proper LLM provider keys
    const { getUserApiKeys } = await import('../services/llm');
    const apiKeys = await getUserApiKeys(userId);

    console.log(`GET /api/llm/api-keys: Found ${apiKeys.length} API keys`);
    return res.json(apiKeys);
  } catch (error) {
    console.error('Error fetching API keys:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to fetch API keys');
  }
});

// Add new LLM API key
router.post('/llm/api-keys', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const { providerId, keyName, apiKey, isDefault } = req.body;
    const userId = req.user.id;

    if (!providerId || !keyName || !apiKey) {
      return sendError(res, 'Provider ID, key name, and API key are required', 400);
    }

    console.log(`POST /api/llm/api-keys: Adding API key for user ${userId}`);

    // Use the legacy storeUserApiKey function to maintain compatibility
    const { storeUserApiKey } = await import('../services/llm');
    const newApiKeyId = await storeUserApiKey(userId, providerId, keyName, apiKey, isDefault || false);

    // Get the created key with full details using getUserApiKeys
    const { getUserApiKeys } = await import('../services/llm');
    const allKeys = await getUserApiKeys(userId);
    const newApiKey = allKeys.find(key => key.id === newApiKeyId);

    console.log(`POST /api/llm/api-keys: Created API key with ID ${newApiKeyId}`);
    return res.status(201).json(newApiKey || { id: newApiKeyId, message: 'API key created successfully' });
  } catch (error) {
    console.error('Error creating API key:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to add API key');
  }
});

// Update LLM API key
router.put('/llm/api-keys/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const keyId = parseInt(req.params.id);
    const userId = req.user.id;
    const { keyName, isDefault } = req.body;

    console.log(`PUT /api/llm/api-keys/${keyId}: Updating API key`);

    // Use legacy service functions
    const { updateUserApiKey } = await import('../services/llm');
    const success = await updateUserApiKey(userId, keyId, { keyName, isDefault });

    if (!success) {
      return sendError(res, 'API key not found or access denied', 404);
    }

    console.log(`PUT /api/llm/api-keys/${keyId}: API key updated successfully`);
    return res.json({ message: 'API key updated successfully' });
  } catch (error) {
    console.error('Error updating API key:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to update API key');
  }
});

// Delete LLM API key
router.delete('/llm/api-keys/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const keyId = parseInt(req.params.id);
    const userId = req.user.id;

    console.log(`DELETE /api/llm/api-keys/${keyId}: Deleting API key`);

    // Use legacy service functions
    const { deleteUserApiKey } = await import('../services/llm');
    const success = await deleteUserApiKey(userId, keyId);

    if (!success) {
      return sendError(res, 'API key not found or access denied', 404);
    }

    console.log(`DELETE /api/llm/api-keys/${keyId}: API key deleted successfully`);
    return res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', getErrorMessage(error));
    return sendError(res, error, 500, 'Failed to delete API key');
  }
});

// Send chat request to LLM (standard endpoint)
router.post('/llm/chat', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    let { 
      messages,
      model, 
      providerId = 1,
      conversationId,
      agentId,
      temperature = 0.7,
      maxTokens = 4096
    } = req.body;
    const userId = req.user.id;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return sendError(res, 'Messages array is required', 400);
    }

    console.log(`POST /api/llm/chat: Processing chat request for user ${userId} with provider ${providerId}`);

    // Provider ID resolution logic (matching legacy implementation)
    let numericProviderId = 1; // Default to OpenAI

    if (providerId === undefined || providerId === null || providerId === "" || 
        (typeof providerId === "number" && isNaN(providerId))) {
      console.log(`Invalid providerId: ${providerId}, using default ID: 1`);
    } else {
      if (typeof providerId === "string") {
        // Known provider slug mapping
        if (["openai", "anthropic", "mistral"].includes(providerId.toLowerCase())) {
          const providerMap: Record<string, number> = {
            openai: 1,
            anthropic: 2,
            mistral: 3,
          };
          numericProviderId = providerMap[providerId.toLowerCase()];
          console.log(`Matched provider slug '${providerId}' to ID: ${numericProviderId}`);
        }
        // Numeric string parsing
        else if (/^\d+$/.test(providerId)) {
          const parsed = parseInt(providerId, 10);
          if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed)) {
            numericProviderId = parsed;
            console.log(`Parsed providerId string '${providerId}' to number: ${numericProviderId}`);
          }
        }
        // Provider slug lookup
        else {
          try {
            const { getProviderIdBySlug } = await import('../services/llm');
            const id = await getProviderIdBySlug(providerId);
            if (id !== null && !isNaN(id) && id > 0 && Number.isFinite(id)) {
              numericProviderId = id;
              console.log(`Resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
            }
          } catch (error) {
            console.error(`Error resolving provider ID for ${providerId}:`, error);
          }
        }
      } else if (typeof providerId === "number") {
        if (!isNaN(providerId) && providerId > 0 && Number.isFinite(providerId)) {
          numericProviderId = providerId;
          console.log(`Using numeric provider ID: ${numericProviderId}`);
        }
      }
    }

    // Final safety checks
    numericProviderId = Math.floor(numericProviderId);
    if (isNaN(numericProviderId) || numericProviderId <= 0 || !Number.isFinite(numericProviderId)) {
      numericProviderId = 1;
    }
    providerId = numericProviderId;

    // Knowledge base integration (matching legacy implementation)
    let knowledgeContext = "";
    let customPromptTemplate = "The following information from knowledge bases may be helpful for answering the user's question. Use this information to provide a more accurate and informed response.";

    if (agentId) {
      const agent = await storage.getAgent(parseInt(agentId));
      if (agent && agent.userId === userId) {
        // Get custom prompt template if available
        if (agent.promptTemplate) {
          customPromptTemplate = agent.promptTemplate;
          console.log(`Using custom prompt template for agent ${agentId}`);
        }

        // Query knowledge bases if agent has them
        if (Array.isArray(agent.knowledgeBaseIds) && agent.knowledgeBaseIds.length > 0) {
          const userLastMessage = messages.findLast((m: any) => m.role === "user")?.content || "";

          if (userLastMessage) {
            const { queryKnowledgeBase } = await import('../services/embedding_service');
            
            for (const kbId of agent.knowledgeBaseIds) {
              try {
                const kbResponse = await queryKnowledgeBase(
                  userId,
                  kbId,
                  userLastMessage,
                  numericProviderId,
                  parseInt(agentId)
                );

                if (kbResponse && kbResponse.relevant_chunks) {
                  const kb = await storage.getKnowledgeBase(kbId);
                  knowledgeContext += `\n\nKnowledge from ${kb?.name || `Knowledge Base #${kbId}`}:\n`;

                  kbResponse.relevant_chunks.forEach((chunk: any, index: number) => {
                    knowledgeContext += `\n[${index + 1}] ${chunk.content}\n`;
                  });
                }
              } catch (error) {
                console.error(`Error querying knowledge base ${kbId}:`, error);
              }
            }
          }
        }
      }
    }

    // Insert knowledge context before last user message
    let messagesWithContext = messages;
    if (knowledgeContext) {
      const lastUserMsgIndex = messages.findLastIndex((m: any) => m.role === "user");
      
      if (lastUserMsgIndex >= 0) {
        const systemMsg = {
          role: "system",
          content: `${customPromptTemplate}${knowledgeContext}`,
        };

        messagesWithContext = [
          ...messages.slice(0, lastUserMsgIndex),
          systemMsg,
          ...messages.slice(lastUserMsgIndex),
        ];
      }
    }

    // Use the real chatCompletion service function
    const { chatCompletion } = await import('../services/llm');
    
    const response = await chatCompletion(
      userId,
      providerId,
      messagesWithContext,
      model,
      temperature,
      maxTokens
    );

    // Add metadata about knowledge bases used
    if (knowledgeContext) {
      response.knowledge_augmented = true;
    }

    // If conversationId provided, save the assistant response
    if (conversationId && response.content) {
      await storage.createMessage({
        conversationId: parseInt(conversationId),
        role: 'assistant',
        content: response.content,
        metadata: response.usage ? { usage: response.usage } : {},
        tokens: response.usage?.total_tokens || null
      });
    }

    console.log(`POST /api/llm/chat: Chat response generated successfully`);
    return res.json(response);
  } catch (error) {
    console.error('Error processing chat request:', getErrorMessage(error));
    
    // Check for specific API key error
    if (error instanceof Error && error.message === "No API key found for this provider") {
      return sendError(res, error.message, 400, "NO_API_KEY");
    }
    
    return sendError(res, error, 500, 'Failed to process chat request');
  }
});

// Generate embeddings
router.post('/llm/embeddings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    const { 
      text,
      providerId = 1,
      model
    } = req.body;
    const userId = req.user.id;

    if (!text) {
      return sendError(res, 'Text is required', 400);
    }

    console.log(`POST /api/llm/embeddings: Generating embeddings for user ${userId} with provider ${providerId}`);

    // Use the real embeddings service function
    const { generateEmbeddings } = await import('../services/llm');
    
    const response = await generateEmbeddings(
      userId,
      providerId,
      text,
      model
    );

    console.log(`POST /api/llm/embeddings: Generated embeddings successfully`);
    return res.json(response);
  } catch (error) {
    console.error('Error generating embeddings:', getErrorMessage(error));
    
    // Check for specific API key error
    if (error instanceof Error && error.message === "No API key found for this provider") {
      return sendError(res, error.message, 400, "NO_API_KEY");
    }
    
    return sendError(res, error, 500, 'Failed to generate embeddings');
  }
});

// OpenAI-compatible chat completions endpoint
router.post('/llm/chat/completions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let { 
      messages,
      model, 
      providerId = 1,
      temperature = 0.7,
      max_tokens = 4096
    } = req.body;
    const userId = req.user.id;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    console.log(`POST /api/llm/chat/completions: Processing request for user ${userId}`);

    // Use the chat completion service
    const { chatCompletion } = await import('../services/llm');
    
    const response = await chatCompletion(
      userId,
      providerId,
      messages,
      model,
      temperature,
      max_tokens
    );

    console.log(`POST /api/llm/chat/completions: Request completed successfully`);
    return res.json(response);
  } catch (error) {
    console.error('Error processing chat completions request:', getErrorMessage(error));
    return res.status(500).json({ error: "Failed to process chat completions request" });
  }
});

export default router;