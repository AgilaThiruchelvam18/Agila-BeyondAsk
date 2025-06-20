/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Chat conversations and messages with AI agents
 * 
 * components:
 *   schemas:
 *     Conversation:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - userId
 *         - agentId
 *         - createdAt
 *         - lastMessageAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The conversation ID
 *         title:
 *           type: string
 *           description: The conversation title
 *         userId:
 *           type: integer
 *           description: The user ID
 *         agentId:
 *           type: integer
 *           description: The agent ID
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the conversation was created
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *           description: When the last message was sent
 *       example:
 *         id: 1
 *         title: Product Question
 *         userId: 1
 *         agentId: 1
 *         metadata: { source: "widget", clientId: "web-app" }
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         lastMessageAt: 2023-01-01T00:05:00.000Z
 *     
 *     Message:
 *       type: object
 *       required:
 *         - id
 *         - role
 *         - content
 *         - conversationId
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The message ID
 *         role:
 *           type: string
 *           enum: [system, user, assistant]
 *           description: The message role
 *         content:
 *           type: string
 *           description: The message content
 *         conversationId:
 *           type: integer
 *           description: The parent conversation ID
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         tokens:
 *           type: integer
 *           nullable: true
 *           description: Number of tokens in this message
 *         citations:
 *           type: array
 *           nullable: true
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               content:
 *                 type: string
 *               source:
 *                 type: string
 *               document_id:
 *                 type: string
 *               score:
 *                 type: number
 *               chunk_index:
 *                 type: integer
 *           description: Source citations and references
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the message was created
 *       example:
 *         id: 1
 *         role: user
 *         content: How does your product work?
 *         conversationId: 1
 *         metadata: { client: "web", timestamp_ms: 1672531200000 }
 *         tokens: 6
 *         citations: null
 *         createdAt: 2023-01-01T00:00:00.000Z
 */

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Get all conversations for the current user
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Unauthorized
 * 
 *   post:
 *     summary: Create a new conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - agentId
 *             properties:
 *               title:
 *                 type: string
 *               agentId:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Created conversation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/agents/{agentId}/conversations:
 *   get:
 *     summary: Get all conversations for a specific agent
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Unauthorized
 * 
 * /api/conversations/{id}:
 *   get:
 *     summary: Get a specific conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 * 
 *   delete:
 *     summary: Delete a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 * 
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: Get all messages in a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 * 
 *   post:
 *     summary: Send a message in a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Message sent and response received
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */

// Export an empty object as this file only contains JSDoc comments
export {};