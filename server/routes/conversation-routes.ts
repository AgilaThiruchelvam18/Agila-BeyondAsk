/**
 * Conversation Management Routes
 * Handles conversation lifecycle, message management, and chat interactions
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get user's conversations
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const userIdInt = parseInt(userId);
    const { agentId, search, status, limit = 20, offset = 0, sortBy = 'lastUpdatedAt', sortOrder = 'desc' } = req.query;

    console.log(`GET /api/conversations: Fetching conversations for user ${userIdInt}`);

    const filters = {
      agentId: agentId ? parseInt(agentId as string) : undefined,
      search: search as string,
      status: status as string
    };

    const conversations = await storage.getConversations(userIdInt, {
      limit: parseInt((limit as string) || '20') || 20,
      offset: parseInt((offset as string) || '0') || 0,
      search: filters.search
    });

    const totalCount = await storage.getConversationsCount(userIdInt, filters);

    // Enrich conversations with additional data
    const enrichedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const [messageCount, lastMessage, agent] = await Promise.all([
          storage.getConversationMessageCount(conversation.id),
          storage.getConversationLastMessage(conversation.id),
          conversation.agentId ? storage.getAgent(conversation.agentId) : Promise.resolve(null)
        ]);

        return {
          ...conversation,
          messageCount,
          lastMessage,
          agent: agent ? { id: agent.id, name: agent.name } : null
        };
      })
    );

    console.log(`GET /api/conversations: Returning ${enrichedConversations.length} conversations`);
    return res.json({
      conversations: enrichedConversations,
      pagination: {
        limit: parseInt((limit as string) || '20') || 20,
        offset: parseInt((offset as string) || '0') || 0,
        total: totalCount,
        pages: Math.ceil(totalCount / (parseInt((limit as string) || '20') || 20))
      }
    });
  } catch (error) {
    console.error('Error fetching conversations:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch conversations', 500);
  }
});

// Get conversation by ID
router.get('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`GET /api/conversations/${conversationId}: Fetching conversation details`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    // Check access permissions
    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    // Get additional details
    const [messages, agent, summary] = await Promise.all([
      storage.getConversationMessages(conversationId),
      conversation.agentId ? storage.getAgent(conversation.agentId) : Promise.resolve(null),
      storage.getConversationSummary(conversationId)
    ]);

    const enrichedConversation = {
      ...conversation,
      messages,
      agent: agent ? { id: agent.id, name: agent.name, instructions: agent.description } : null,
      summary,
      messageCount: messages.length
    };

    console.log(`GET /api/conversations/${conversationId}: Conversation retrieved successfully`);
    return res.json(enrichedConversation);
  } catch (error) {
    console.error('Error fetching conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch conversation', 500);
  }
});

// Create new conversation
router.post('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { title, agentId, initialMessage, metadata = {} } = req.body;
    const userIdInt = parseInt(userId);

    console.log(`POST /api/conversations: Creating conversation for user ${userIdInt}`);

    // Validate agent access if provided
    if (agentId) {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return sendError(res, 'Agent not found', 404);
      }

      // Check agent access permissions
      if (agent.userId !== userIdInt && !agent.isPublic) {
        const hasAccess = await storage.checkAgentAccess(agentId, userIdInt);
        if (!hasAccess) {
          return sendError(res, 'Access denied to this agent', 403);
        }
      }
    }

    const conversationData = {
      title: title || 'New Conversation',
      userId: userIdInt,
      agentId: agentId || null,
      status: 'active',
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date()
    };

    const newConversation = await storage.createConversation(conversationData);

    // Add initial message if provided
    if (initialMessage) {
      const messageData = {
        conversationId: newConversation.id,
        content: initialMessage,
        role: 'user' as const,
        userId: userIdInt,
        createdAt: new Date()
      };
      
      await storage.createMessage(messageData);
    }

    console.log(`POST /api/conversations: Conversation created with ID ${newConversation.id}`);
    return res.status(201).json(newConversation);
  } catch (error) {
    console.error('Error creating conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to create conversation', 500);
  }
});

// Update conversation
router.put('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { title, status, metadata } = req.body;

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`PUT /api/conversations/${conversationId}: Updating conversation`);

    const existingConversation = await storage.getConversation(conversationId);
    if (!existingConversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (existingConversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) {
      updateData.metadata = { 
        ...(existingConversation.metadata as object || {}), 
        ...(metadata as object || {}) 
      };
    }

    const updatedConversation = await storage.updateConversation(conversationId, updateData);

    console.log(`PUT /api/conversations/${conversationId}: Conversation updated successfully`);
    return res.json(updatedConversation);
  } catch (error) {
    console.error('Error updating conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to update conversation', 500);
  }
});

// Delete conversation
router.delete('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`DELETE /api/conversations/${conversationId}: Deleting conversation`);

    const existingConversation = await storage.getConversation(conversationId);
    if (!existingConversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (existingConversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    // Delete all messages in the conversation
    await storage.deleteConversationMessages(conversationId);
    
    // Delete the conversation
    await storage.deleteConversation(conversationId);

    console.log(`DELETE /api/conversations/${conversationId}: Conversation deleted successfully`);
    return res.json({ message: 'Conversation deleted successfully', id: conversationId });
  } catch (error) {
    console.error('Error deleting conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to delete conversation', 500);
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { limit = 50, offset = 0, beforeId, afterId } = req.query;

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`GET /api/conversations/${conversationId}/messages: Fetching messages`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    const filters = {
      beforeId: beforeId ? parseInt(beforeId as string) : undefined,
      afterId: afterId ? parseInt(afterId as string) : undefined
    };

    const messages = await storage.getConversationMessages(conversationId, {
      limit: Math.min(parseInt((limit as string) || '50') || 50, 100),
      offset: parseInt((offset as string) || '0') || 0,
      filters
    });

    console.log(`GET /api/conversations/${conversationId}/messages: Found ${messages.length} messages`);
    return res.json({"messages":messages});
  } catch (error) {
    console.error('Error fetching messages:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch messages', 500);
  }
});

// Add message to conversation
router.post('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { 
      content, 
      role = 'user', 
      metadata = {}, 
      providerId, 
      providerIdNum, 
      model, 
      autoMode 
    } = req.body;

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    if (!content) {
      return sendError(res, 'Message content is required', 400);
    }

    console.log(`POST /api/conversations/${conversationId}/messages: Adding message with LLM processing`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    // Save the user message first
    const userMessageData = {
      conversationId,
      content,
      role,
      userId: userIdInt,
      metadata,
      createdAt: new Date()
    };

    const userMessage = await storage.createMessage(userMessageData);
    console.log(`POST /api/conversations/${conversationId}/messages: User message saved with ID ${userMessage.id}`);

    // If this is a user message, generate AI response
    if (role === 'user') {
      try {
        console.log(`POST /api/conversations/${conversationId}/messages: Processing LLM response for agent ${conversation.agentId}`);

        // Get the agent to determine LLM settings
        const agent = await storage.getAgent(conversation.agentId);
        if (!agent) {
          return sendError(res, 'Agent not found for this conversation', 404);
        }

        // Get all messages in the conversation for context
        const allMessages = await storage.getConversationMessages(conversationId, { limit: 100, offset: 0 });
        
        // Format messages for LLM based on conversation memory setting
        let formattedMessages;
        if (agent.enableConversationMemory !== false) {
          // Include full conversation history
          console.log(`Using conversation memory for agent ${agent.id}, including ${allMessages.length} messages in context`);
          formattedMessages = allMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
        } else {
          // Only include system messages and the latest user message
          console.log(`Conversation memory disabled for agent ${agent.id}, only including latest message`);
          const systemMessages = allMessages.filter((msg) => msg.role === "system");
          formattedMessages = [
            ...systemMessages.map((msg) => ({ role: msg.role, content: msg.content })),
            { role: "user", content: content }
          ];
        }

        // Resolve provider ID (use legacy logic for compatibility)
        let numericProviderId = 1; // Default to OpenAI
        
        if (providerIdNum && !isNaN(parseInt(providerIdNum))) {
          numericProviderId = parseInt(providerIdNum);
        } else if (providerId) {
          if (typeof providerId === "string") {
            // Known provider slug mapping
            if (["openai", "anthropic", "mistral"].includes(providerId.toLowerCase())) {
              const providerMap: Record<string, number> = {
                openai: 1,
                anthropic: 2,
                mistral: 3,
              };
              numericProviderId = providerMap[providerId.toLowerCase()];
            } else if (/^\d+$/.test(providerId)) {
              const parsed = parseInt(providerId, 10);
              if (!isNaN(parsed) && parsed > 0) {
                numericProviderId = parsed;
              }
            }
          }
        }

        console.log(`POST /api/conversations/${conversationId}/messages: Using provider ID ${numericProviderId}, model: ${model}`);

        // Knowledge base integration (matching legacy implementation)
        let knowledgeContext = "";
        let customPromptTemplate = "The following information from knowledge bases may be helpful for answering the user's question. Use this information to provide a more accurate and informed response.";

        if (agent.knowledgeBaseIds && Array.isArray(agent.knowledgeBaseIds) && agent.knowledgeBaseIds.length > 0) {
          console.log(`POST /api/conversations/${conversationId}/messages: Agent has ${agent.knowledgeBaseIds.length} knowledge bases, querying for context`);
          
          // Get custom prompt template if available
          if (agent.promptTemplate) {
            customPromptTemplate = agent.promptTemplate;
            console.log(`Using custom prompt template for agent ${agent.id}`);
          }

          const { queryKnowledgeBase } = await import('../services/embedding_service');
          
          for (const kbId of agent.knowledgeBaseIds) {
            try {
              const kbResponse = await queryKnowledgeBase(
                userIdInt,
                kbId,
                content,
                numericProviderId,
                agent.id
              );

              if (kbResponse && kbResponse.relevant_chunks) {
                const kb = await storage.getKnowledgeBase(kbId);
                knowledgeContext += `\n\nKnowledge from ${kb?.name || `Knowledge Base #${kbId}`}:\n`;

                kbResponse.relevant_chunks.forEach((chunk: any, index: number) => {
                  knowledgeContext += `\n[${index + 1}] ${chunk.content}\n`;
                });
                
                console.log(`POST /api/conversations/${conversationId}/messages: Added knowledge context from KB ${kbId}`);
              }
            } catch (error) {
              console.error(`Error querying knowledge base ${kbId}:`, error);
            }
          }
        }

        // Insert knowledge context before last user message
        let messagesWithContext = formattedMessages;
        if (knowledgeContext) {
          const lastUserMsgIndex = formattedMessages.findLastIndex((m: any) => m.role === "user");
          
          if (lastUserMsgIndex >= 0) {
            const systemMsg = {
              role: "system",
              content: `${customPromptTemplate}${knowledgeContext}`,
            };

            messagesWithContext = [
              ...formattedMessages.slice(0, lastUserMsgIndex),
              systemMsg,
              ...formattedMessages.slice(lastUserMsgIndex),
            ];
            
            console.log(`POST /api/conversations/${conversationId}/messages: Injected knowledge context into conversation`);
          }
        }

        // Call LLM service
        const { chatCompletion } = await import('../services/llm');
        
        console.log(`POST /api/conversations/${conversationId}/messages: Calling LLM with ${messagesWithContext.length} messages`);
        
        const llmResponse = await chatCompletion(
          userIdInt,
          numericProviderId,
          messagesWithContext,
          model,
          0.7, // Default temperature
          4096 // Default max tokens
        );

        console.log(`POST /api/conversations/${conversationId}/messages: LLM response received: ${llmResponse.content?.substring(0, 100)}...`);

        // Save the assistant response
        const assistantMessageData = {
          conversationId,
          content: llmResponse.content || 'I apologize, but I was unable to generate a response.',
          role: 'assistant' as const,
          userId: userIdInt,
          metadata: {
            providerId: numericProviderId,
            model: model,
            usage: llmResponse.usage,
            knowledge_augmented: !!knowledgeContext
          },
          tokens: llmResponse.usage?.total_tokens || null,
          createdAt: new Date()
        };

        const assistantMessage = await storage.createMessage(assistantMessageData);
        console.log(`POST /api/conversations/${conversationId}/messages: Assistant message saved with ID ${assistantMessage.id}`);

      } catch (llmError) {
        console.error('Error generating LLM response:', getErrorMessage(llmError));
        
        // Save an error message so the user knows something went wrong
        const errorMessageData = {
          conversationId,
          content: 'I apologize, but I encountered an error while processing your message. Please try again.',
          role: 'assistant' as const,
          userId: userIdInt,
          metadata: { error: true, error_message: getErrorMessage(llmError) },
          createdAt: new Date()
        };

        await storage.createMessage(errorMessageData);
        console.log(`POST /api/conversations/${conversationId}/messages: Error message saved due to LLM failure`);
      }
    }

    // Update conversation last message timestamp
    await storage.updateConversation(conversationId, {
      lastMessageAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`POST /api/conversations/${conversationId}/messages: Message processing completed`);
    return res.status(201).json(userMessage);
  } catch (error) {
    console.error('Error adding message:', getErrorMessage(error));
    return sendError(res, 'Failed to add message', 500);
  }
});

// Generate conversation summary
router.post('/conversations/:id/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`POST /api/conversations/${conversationId}/summary: Generating summary`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    // Get messages for summary generation
    const messages = await storage.getConversationMessages(conversationId);
    
    if (messages.length === 0) {
      return sendError(res, 'Cannot generate summary for empty conversation', 400);
    }

    // Generate summary using LLM service
    const summaryData = await storage.generateConversationSummary(conversationId, messages);

    // Save summary
    await storage.saveConversationSummary(conversationId, summaryData);

    console.log(`POST /api/conversations/${conversationId}/summary: Summary generated successfully`);
    return res.status(201).json(summaryData);
  } catch (error) {
    console.error('Error generating summary:', getErrorMessage(error));
    return sendError(res, 'Failed to generate conversation summary', 500);
  }
});

// Export conversation
router.get('/conversations/:id/export', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);
    const { format = 'json' } = req.query;

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`GET /api/conversations/${conversationId}/export: Exporting conversation`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    // Get all conversation data
    const [messages, agent, summary] = await Promise.all([
      storage.getConversationMessages(conversationId),
      conversation.agentId ? storage.getAgent(conversation.agentId) : Promise.resolve(null),
      storage.getConversationSummary(conversationId)
    ]);

    const exportData = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        status: conversation.status
      },
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        instructions: agent.description
      } : null,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        createdAt: msg.createdAt,
        metadata: msg.metadata
      })),
      summary,
      exportedAt: new Date(),
      exportFormat: format
    };

    console.log(`GET /api/conversations/${conversationId}/export: Conversation exported successfully`);
    return res.json(exportData);
  } catch (error) {
    console.error('Error exporting conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to export conversation', 500);
  }
});

// Archive conversation
router.post('/conversations/:id/archive', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const conversationId = parseInt(req.params.id);
    const userIdInt = parseInt(userId);

    if (isNaN(conversationId)) {
      return sendError(res, 'Invalid conversation ID', 400);
    }

    console.log(`POST /api/conversations/${conversationId}/archive: Archiving conversation`);

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    if (conversation.userId !== userIdInt) {
      return sendError(res, 'Access denied to this conversation', 403);
    }

    const updatedConversation = await storage.updateConversation(conversationId, {
      status: 'archived',
      updatedAt: new Date()
    });

    console.log(`POST /api/conversations/${conversationId}/archive: Conversation archived successfully`);
    return res.status(201).json(updatedConversation);
  } catch (error) {
    console.error('Error archiving conversation:', getErrorMessage(error));
    return sendError(res, 'Failed to archive conversation', 500);
  }
});

export default router;