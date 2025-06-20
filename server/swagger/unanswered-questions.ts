/**
 * @swagger
 * tags:
 *   name: Unanswered Questions
 *   description: Management of questions that couldn't be answered confidently
 * 
 * components:
 *   schemas:
 *     UnansweredQuestion:
 *       type: object
 *       required:
 *         - id
 *         - question
 *         - status
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The question ID
 *         question:
 *           type: string
 *           description: The original question
 *         userId:
 *           type: integer
 *           description: User who asked the question
 *         agentId:
 *           type: integer
 *           description: Agent that received the question
 *         knowledgeBaseId:
 *           type: integer
 *           nullable: true
 *           description: Knowledge base that was queried
 *         conversationId:
 *           type: integer
 *           nullable: true
 *           description: Parent conversation ID
 *         messageId:
 *           type: integer
 *           nullable: true
 *           description: Parent message ID
 *         context:
 *           type: string
 *           nullable: true
 *           description: Context from the conversation
 *         confidenceScore:
 *           type: number
 *           nullable: true
 *           description: Confidence score of the answer
 *         status:
 *           type: string
 *           enum: [pending, reviewed, resolved, ignored]
 *           description: Status of the question
 *         resolution:
 *           type: string
 *           nullable: true
 *           description: Resolution notes or explanation
 *         newDocumentId:
 *           type: integer
 *           nullable: true
 *           description: ID of document created to address this question
 *         source:
 *           type: string
 *           enum: [chat, widget, api]
 *           description: Source of the question
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the question was recorded
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the question was last updated
 *       example:
 *         id: 1
 *         question: How do I cancel my subscription?
 *         userId: 1
 *         agentId: 1
 *         knowledgeBaseId: 1
 *         conversationId: 1
 *         messageId: 2
 *         context: "User asked about subscription cancellation. No relevant information was found in the knowledge base."
 *         confidenceScore: 0.12
 *         status: "pending"
 *         resolution: null
 *         newDocumentId: null
 *         source: "chat"
 *         metadata: { browser: "Chrome", ip_country: "US" }
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         updatedAt: 2023-01-01T00:00:00.000Z
 */

/**
 * @swagger
 * /api/unanswered-questions:
 *   get:
 *     summary: Get all unanswered questions for the current user
 *     tags: [Unanswered Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, reviewed, resolved, ignored]
 *         description: Filter by status
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: integer
 *         description: Filter by agent ID
 *       - in: query
 *         name: knowledgeBaseId
 *         schema:
 *           type: integer
 *         description: Filter by knowledge base ID
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [all, chat, widget, api]
 *         description: Filter by source
 *     responses:
 *       200:
 *         description: List of unanswered questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UnansweredQuestion'
 *       401:
 *         description: Unauthorized
 * 
 * /api/unanswered-questions/{id}:
 *   get:
 *     summary: Get a specific unanswered question
 *     tags: [Unanswered Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnansweredQuestion'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 *
 *   patch:
 *     summary: Update an unanswered question
 *     tags: [Unanswered Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, resolved, ignored]
 *               resolution:
 *                 type: string
 *               newDocumentId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated question
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnansweredQuestion'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 * 
 * /api/unanswered-questions/stats:
 *   get:
 *     summary: Get statistics about unanswered questions
 *     tags: [Unanswered Questions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unanswered questions statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCount:
 *                   type: integer
 *                 byStatus:
 *                   type: object
 *                   properties:
 *                     pending:
 *                       type: integer
 *                     reviewed:
 *                       type: integer
 *                     resolved:
 *                       type: integer
 *                     ignored:
 *                       type: integer
 *                 byAgent:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       agentId:
 *                         type: integer
 *                       agentName:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 byKnowledgeBase:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       knowledgeBaseId:
 *                         type: integer
 *                       knowledgeBaseName:
 *                         type: string
 *                       count:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 */

// Export an empty object as this file only contains JSDoc comments
export {};