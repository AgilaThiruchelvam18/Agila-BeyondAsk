import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { storage } from '../storage';
import axios from 'axios';
import { queryKnowledgeBase } from '../services/embedding_service';

const router = Router();

// Get all visualizer boards for the current user
router.get('/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Fetch boards from the database
    const boards = await storage.getVisualizerBoardsByUserId(Number(userId));
    return res.json(boards);
  } catch (error) {
    console.error('Error fetching visualizer boards:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific visualizer board by ID - only match numeric IDs
router.get('/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    const board = await storage.getVisualizerBoard(boardId);
    
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Add detailed logging for debugging user ID comparison
    console.log('Checking board access:', {
      boardUserId: board.userId,
      requestUserId: userId,
      boardUserIdType: typeof board.userId,
      requestUserIdType: typeof userId,
      stringComparison: String(board.userId) === String(userId)
    });
    
    // Check if the board belongs to the user - use string comparison to handle type mismatches
    if (String(board.userId) !== String(userId)) {
      console.log('Board access denied');
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    return res.json(board);
  } catch (error) {
    console.error('Error fetching visualizer board:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create a new visualizer board
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { name, nodes, edges } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Missing required field: name' });
    }

    // Create board in the database
    const newBoard = await storage.createVisualizerBoard({
      name,
      userId: Number(userId),
      nodes: nodes || [],
      edges: edges || []
    });

    return res.status(201).json(newBoard);
  } catch (error) {
    console.error('Error creating visualizer board:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update a specific visualizer board - only match numeric IDs
router.put('/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    const { name, nodes, edges, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Missing required field: name' });
    }

    console.log(`Updating board ${boardId} for user ${userId}`);
    console.log('Board data:', { name, nodeCount: nodes?.length, edgeCount: edges?.length });

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    // Update board in the database
    const updatedBoard = await storage.updateVisualizerBoard(boardId, {
      name,
      description: description || existingBoard.description,
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      updatedAt: new Date()
    });

    console.log('Board updated successfully');
    return res.json(updatedBoard);
  } catch (error) {
    console.error('Error updating visualizer board:', error);
    return res.status(500).json({ message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
});

// Delete a specific visualizer board - only match numeric IDs
router.delete('/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    // Delete board from the database
    const success = await storage.deleteVisualizerBoard(boardId);

    if (success) {
      return res.json({ 
        success: true,
        message: 'Board deleted successfully',
        id: boardId
      });
    } else {
      return res.status(500).json({ message: 'Failed to delete board' });
    }
  } catch (error) {
    console.error('Error deleting visualizer board:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Chat Conversation Operations
// Get a specific chat conversation for a board and chat node
router.get('/:boardId/conversations/:chatNodeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.boardId);
    const chatNodeId = req.params.chatNodeId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    if (!chatNodeId) {
      return res.status(400).json({ message: 'Invalid chat node ID' });
    }

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    // Get the chat conversation
    const conversation = await storage.getVisualizerChatConversation(boardId, chatNodeId);
    
    if (!conversation) {
      // If conversation doesn't exist yet, return an empty message array
      return res.json({ 
        boardId, 
        chatNodeId, 
        messages: [] 
      });
    }

    return res.json(conversation);
  } catch (error) {
    console.error('Error fetching visualizer chat conversation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Create or update a chat conversation
router.post('/:boardId/conversations/:chatNodeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.boardId);
    const chatNodeId = req.params.chatNodeId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    if (!chatNodeId) {
      return res.status(400).json({ message: 'Invalid chat node ID' });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ message: 'Messages must be an array' });
    }

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    // Check if conversation already exists
    const existingConversation = await storage.getVisualizerChatConversation(boardId, chatNodeId);
    
    let result;
    if (existingConversation) {
      // Update existing conversation
      result = await storage.updateVisualizerChatConversation(boardId, chatNodeId, {
        messages,
        updatedAt: new Date()
      });
    } else {
      // Create new conversation
      result = await storage.createVisualizerChatConversation({
        boardId,
        chatNodeId,
        messages
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error saving visualizer chat conversation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete a chat conversation
router.delete('/:boardId/conversations/:chatNodeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.boardId);
    const chatNodeId = req.params.chatNodeId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    if (!chatNodeId) {
      return res.status(400).json({ message: 'Invalid chat node ID' });
    }

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    // Delete conversation
    const success = await storage.deleteVisualizerChatConversation(boardId, chatNodeId);

    if (success) {
      return res.json({ 
        success: true,
        message: 'Chat conversation deleted successfully',
        boardId,
        chatNodeId
      });
    } else {
      return res.status(404).json({ message: 'Chat conversation not found' });
    }
  } catch (error) {
    console.error('Error deleting visualizer chat conversation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Process query against multiple knowledge bases without creating an agent
router.post('/:boardId/process-query', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.boardId);
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    const { query, knowledgeBaseIds, messageContext, chatNodeId } = req.body;
    
    console.log('DEBUG: Request body data:', { 
      hasQuery: !!query, 
      kbCount: knowledgeBaseIds?.length || 0, 
      hasMessageContext: !!messageContext,
      hasChatNodeId: !!chatNodeId,
      messageContext,
      chatNodeId
    });

    // Detect content creation intent
    const contentCreationKeywords = [
      'create', 'write', 'generate', 'compose', 'draft', 'build', 'make',
      'facebook ad', 'sales copy', 'email', 'blog post', 'content', 'copy',
      'headline', 'description', 'marketing', 'advertisement', 'campaign'
    ];
    
    const isContentCreation = contentCreationKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
    
    console.log(`Content creation detected: ${isContentCreation}`);

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'Query is required and must be a string' });
    }

    if (!Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return res.status(400).json({ message: 'At least one knowledge base ID is required' });
    }

    // Verify board exists and belongs to user
    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (String(existingBoard.userId) !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized access to this board' });
    }

    console.log(`Processing visualizer query with ${knowledgeBaseIds.length} knowledge bases for board ${boardId}`);
    
    // Validate that all knowledge bases exist and user has access
    const validKnowledgeBases = [];
    for (const kbId of knowledgeBaseIds) {
      const kb = await storage.getKnowledgeBase(kbId);
      if (kb) {
        validKnowledgeBases.push(kb);
      }
    }

    if (validKnowledgeBases.length === 0) {
      return res.status(400).json({ 
        message: 'No valid knowledge bases found for the provided IDs' 
      });
    }

    let finalAnswer: string = '';
    let allSources: any[] = [];
    let maxConfidence: number = 0;

    if (isContentCreation && validKnowledgeBases.length > 1) {
      // Enhanced content synthesis mode for multiple knowledge bases
      console.log('Using enhanced content synthesis mode');
      
      try {
        // Gather comprehensive context from all knowledge bases
        const contextData = [];
        
        for (const kb of validKnowledgeBases) {
          try {
            console.log(`Gathering context from knowledge base: ${kb.name} (ID: ${kb.id})`);
            const result = await queryKnowledgeBase(userId, kb.id, query, 1);
            
            if (result && result.answer) {
              contextData.push({
                knowledgeBaseName: kb.name,
                content: result.answer,
                sources: result.references || []
              });
              allSources = allSources.concat(result.references || []);
              maxConfidence = Math.max(maxConfidence, result.confidenceScore || 0.7);
            }
          } catch (error) {
            console.error(`Error gathering context from knowledge base ${kb.id}:`, error);
            // Check if it's a 502 error (service unavailable)
            if ((error as any).code === 'ERR_BAD_RESPONSE' || (error as any).response?.status === 502) {
              console.log(`External LLM service appears to be unavailable for KB ${kb.id}`);
            }
            // Continue with other knowledge bases
          }
        }

        if (contextData.length > 0) {
          // Create synthesis prompt with all gathered context
          const combinedContext = contextData.map(data => 
            `[From ${data.knowledgeBaseName}]:\n${data.content}`
          ).join('\n\n');
          
          const synthesisPrompt = `You are an expert content creator. Using the information provided from multiple knowledge bases, create compelling content that synthesizes and combines the information effectively.

AVAILABLE INFORMATION:
${combinedContext}

USER REQUEST: ${query}

INSTRUCTIONS:
- Combine information from all sources to create cohesive, compelling content
- Use specific details, facts, and insights from the knowledge bases
- For marketing content, focus on benefits, credibility, and persuasive elements
- Make the content engaging and actionable
- Don't just list information - weave it into a compelling narrative
- Include relevant details that support the main message

Create the requested content now:`;

          console.log('Sending synthesis prompt to LLM...');
          
          try {
            // Use the LLM service to generate synthesized content
            const { generateAnswerFromContext } = await import('../services/llm.js');
            const response = await generateAnswerFromContext(
              userId,
              1, // provider ID
              combinedContext,
              synthesisPrompt,
              undefined, // model
              0.7, // temperature for creativity
              4096, // maxTokens
              undefined, // agentId
              validKnowledgeBases[0].id // use first KB ID for context
            );
            
            finalAnswer = response.answer;
            console.log(`Synthesis completed, generated ${finalAnswer.length} characters`);
          } catch (llmError) {
            console.error('Error in LLM synthesis:', llmError);
            finalAnswer = "The content synthesis service is currently unavailable. Please ensure your API credentials are properly configured and try again.";
            maxConfidence = 0.1;
          }
        } else {
          finalAnswer = "The knowledge base search service appears to be unavailable. Please check your API credentials and try again.";
          maxConfidence = 0.1;
        }
      } catch (error) {
        console.error('Error in content synthesis mode:', error);
        finalAnswer = "There was an error processing your content creation request. Please try again.";
        maxConfidence = 0.1;
      }
    } else {
      // Standard Q&A mode - query each knowledge base individually
      console.log('Using standard Q&A mode');
      const queryResults = [];
      
      for (const kb of validKnowledgeBases) {
        try {
          console.log(`Querying knowledge base: ${kb.name} (ID: ${kb.id})`);
          const result = await queryKnowledgeBase(userId, kb.id, query, 1);
          
          if (result && result.answer) {
            queryResults.push({
              knowledgeBaseId: kb.id,
              knowledgeBaseName: kb.name,
              response: result.answer,
              sources: result.references || [],
              confidence: result.confidenceScore || 0.7
            });
          }
        } catch (error) {
          console.error(`Error querying knowledge base ${kb.id}:`, error);
        }
      }

      // Process standard Q&A results
      if (queryResults.length > 0) {
        if (queryResults.length === 1) {
          const result = queryResults[0];
          finalAnswer = result.response;
          allSources = result.sources;
          maxConfidence = result.confidence;
        } else {
          // Smart combination logic for Q&A responses
          const responseMap = new Map();
          
          queryResults.forEach((result) => {
            const responseKey = result.response.trim().toLowerCase();
            if (!responseMap.has(responseKey)) {
              responseMap.set(responseKey, {
                response: result.response,
                knowledgeBases: [result.knowledgeBaseName],
                sources: result.sources || [],
                confidence: result.confidence
              });
            } else {
              responseMap.get(responseKey).knowledgeBases.push(result.knowledgeBaseName);
              responseMap.get(responseKey).sources = responseMap.get(responseKey).sources.concat(result.sources || []);
              responseMap.get(responseKey).confidence = Math.max(responseMap.get(responseKey).confidence, result.confidence);
            }
            allSources = allSources.concat(result.sources || []);
            maxConfidence = Math.max(maxConfidence, result.confidence);
          });
          
          const uniqueResponseArray = Array.from(responseMap.values());
          
          if (uniqueResponseArray.length === 1) {
            finalAnswer = uniqueResponseArray[0].response;
          } else {
            finalAnswer = `Based on information from ${queryResults.length} knowledge bases:\n\n`;
            uniqueResponseArray.forEach((item) => {
              const kbNames = item.knowledgeBases.length > 1 
                ? `${item.knowledgeBases.slice(0, -1).join(', ')} and ${item.knowledgeBases.slice(-1)[0]}`
                : item.knowledgeBases[0];
              finalAnswer += `**From ${kbNames}:**\n${item.response}\n\n`;
            });
          }
        }
      } else {
        finalAnswer = "I couldn't find relevant information in the connected knowledge bases to answer your question. You might want to try rephrasing your question or check if the knowledge bases contain information about this topic.";
        maxConfidence = 0.1;
      }
    }

    // Store the conversation - try multiple ways to get the chatNodeId
    const nodeId = chatNodeId || (messageContext && messageContext.chatNodeId) || `chat-${Date.now()}`;
    
    try {
      console.log(`Attempting to store conversation for chat node: ${nodeId}`);
      
      // Get existing conversation or create new messages array
      const existingConversation = await storage.getVisualizerChatConversation(boardId, nodeId);
      const messages = existingConversation && Array.isArray(existingConversation.messages) 
        ? [...existingConversation.messages] 
        : [];
      
      console.log(`Found existing conversation: ${!!existingConversation}, current message count: ${messages.length}`);
      
      // Add user message
      messages.push({
        id: Date.now(),
        role: 'user',
        content: query,
        timestamp: new Date().toISOString()
      });
      
      // Add assistant message
      messages.push({
        id: Date.now() + 1,
        role: 'assistant', 
        content: finalAnswer,
        sources: allSources,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Prepared ${messages.length} total messages for storage`);
      
      // Save conversation
      if (existingConversation) {
        console.log(`Updating existing conversation for node: ${nodeId}`);
        await storage.updateVisualizerChatConversation(boardId, nodeId, {
          messages,
          updatedAt: new Date()
        });
      } else {
        console.log(`Creating new conversation for node: ${nodeId}`);
        await storage.createVisualizerChatConversation({
          boardId,
          chatNodeId: nodeId,
          messages
        });
      }
      
      console.log(`✅ Conversation stored successfully for chat node: ${nodeId}`);
    } catch (storageError) {
      console.error('❌ Error storing conversation:', storageError);
      // Continue anyway - don't fail the response if storage fails
    }

    const response = {
      answer: finalAnswer,
      sources: allSources,
      confidence: maxConfidence,
      isFallback: maxConfidence === 0.1,
      knowledgeBasesQueried: validKnowledgeBases.map(kb => ({ id: kb.id, name: kb.name }))
    };
    
    console.log('Knowledge base query completed successfully');
    
    // Return the response
    return res.json(response);
    
  } catch (error) {
    console.error('Error processing visualizer query:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get conversation history for a specific chat node
router.get('/:boardId/conversations/:chatNodeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    const chatNodeId = req.params.chatNodeId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    // Verify user has access to this board
    const board = await storage.getVisualizerBoard(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.userId !== parseInt(userId.toString())) {
      return res.status(403).json({ message: 'Unauthorized access to board' });
    }

    // Get conversation for this chat node
    const conversation = await storage.getVisualizerChatConversation(boardId, chatNodeId);
    
    if (!conversation) {
      // Return empty conversation structure if none exists
      return res.json({ messages: [] });
    }

    // Transform the stored messages to match frontend expectations
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const transformedMessages = (messages as any[]).map((msg: any) => ({
      sender: msg.role === 'user' ? 'user' : 'bot',
      text: msg.content,
      timestamp: msg.timestamp,
      sources: msg.sources || []
    }));

    return res.json({ 
      messages: transformedMessages,
      chatNodeId: conversation.chatNodeId,
      lastUpdated: conversation.updatedAt
    });
    
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Save conversation messages for a specific chat node
router.post('/:boardId/conversations/:chatNodeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    const chatNodeId = req.params.chatNodeId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const { messages } = req.body;

    if (isNaN(boardId)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    // Verify user has access to this board
    const board = await storage.getVisualizerBoard(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.userId !== parseInt(userId.toString())) {
      return res.status(403).json({ message: 'Unauthorized access to board' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Messages array is required' });
    }

    // Transform frontend messages to storage format
    const transformedMessages = messages.map((msg: any) => ({
      id: Date.now() + Math.random(),
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
      timestamp: msg.timestamp || new Date().toISOString(),
      sources: msg.sources || []
    }));

    // Check if conversation exists
    const existingConversation = await storage.getVisualizerChatConversation(boardId, chatNodeId);
    
    if (existingConversation) {
      // Update existing conversation
      await storage.updateVisualizerChatConversation(boardId, chatNodeId, {
        messages: transformedMessages,
        updatedAt: new Date()
      });
    } else {
      // Create new conversation
      await storage.createVisualizerChatConversation({
        boardId,
        chatNodeId,
        messages: transformedMessages
      });
    }

    return res.json({ 
      success: true,
      message: 'Conversation saved successfully',
      messageCount: transformedMessages.length
    });
    
  } catch (error) {
    console.error('Error saving conversation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;