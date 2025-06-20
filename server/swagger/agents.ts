/**
 * @swagger
 * tags:
 *   name: Agents
 *   description: AI Agent management and interactions
 * 
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - userId
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The agent ID
 *         name:
 *           type: string
 *           description: The agent's name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Agent description
 *         userId:
 *           type: integer
 *           description: The owner user ID
 *         isActive:
 *           type: boolean
 *           description: Whether the agent is active
 *         providerId:
 *           type: integer
 *           description: The LLM provider ID
 *         modelId:
 *           type: integer
 *           description: The LLM model ID
 *         knowledgeBaseIds:
 *           type: array
 *           items:
 *             type: integer
 *           nullable: true
 *           description: Array of knowledge base IDs associated with this agent
 *         configuration:
 *           type: object
 *           description: Agent configuration
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the agent was created
 *       example:
 *         id: 1
 *         name: Customer Support Agent
 *         description: Handles customer inquiries
 *         userId: 1
 *         isActive: true
 *         providerId: 1
 *         modelId: 1
 *         knowledgeBaseIds: [1, 2]
 *         configuration: { temperature: 0.7, systemPrompt: "You are a helpful customer support agent." }
 *         createdAt: 2023-01-01T00:00:00.000Z
 * 
 *     AgentDependencies:
 *       type: object
 *       properties:
 *         conversations:
 *           type: integer
 *           description: Number of conversations associated with this agent
 *         widgets:
 *           type: integer
 *           description: Number of widgets associated with this agent
 *         unansweredQuestions:
 *           type: integer
 *           description: Number of unanswered questions associated with this agent
 */

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: Get all agents for the current user
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agent'
 *       401:
 *         description: Unauthorized
 * 
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - providerId
 *               - modelId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               providerId:
 *                 type: integer
 *               modelId:
 *                 type: integer
 *               knowledgeBaseIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               configuration:
 *                 type: object
 *     responses:
 *       201:
 *         description: Created agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/agents/{id}:
 *   get:
 *     summary: Get a specific agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 * 
 *   patch:
 *     summary: Update an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               providerId:
 *                 type: integer
 *               modelId:
 *                 type: integer
 *               knowledgeBaseIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               configuration:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 * 
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 * 
 * /api/agents/{id}/dependencies:
 *   get:
 *     summary: Get agent dependencies
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent dependencies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentDependencies'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 * 
 * /api/agents/{id}/cascade-delete:
 *   delete:
 *     summary: Delete an agent and all its dependencies
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent and all dependencies deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */

// Export an empty object as this file only contains JSDoc comments
export {};