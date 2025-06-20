/**
 * @swagger
 * tags:
 *   name: LLM
 *   description: LLM Providers, Models, and API Keys
 * 
 * components:
 *   schemas:
 *     Provider:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - slug
 *       properties:
 *         id:
 *           type: integer
 *           description: The provider ID
 *         name:
 *           type: string
 *           description: Provider name (e.g., OpenAI, Anthropic)
 *         slug:
 *           type: string
 *           description: URL-friendly identifier
 *         logoUrl:
 *           type: string
 *           nullable: true
 *           description: URL to provider logo
 *         apiKeyRequired:
 *           type: boolean
 *           description: Whether an API key is required
 *       example:
 *         id: 1
 *         name: OpenAI
 *         slug: openai
 *         logoUrl: null
 *         apiKeyRequired: true
 *     
 *     Model:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - providerId
 *       properties:
 *         id:
 *           type: integer
 *           description: The model ID
 *         name:
 *           type: string
 *           description: Model name (e.g., gpt-4o)
 *         providerId:
 *           type: integer
 *           description: Provider ID this model belongs to
 *         contextWindow:
 *           type: integer
 *           description: Maximum context length in tokens
 *         isDefault:
 *           type: boolean
 *           description: Whether this is the default model for the provider
 *         capabilities:
 *           type: array
 *           items:
 *             type: string
 *           description: Model capabilities (e.g., chat, embeddings)
 *       example:
 *         id: 1
 *         name: gpt-4o
 *         providerId: 1
 *         contextWindow: 128000
 *         isDefault: true
 *         capabilities: ["chat", "multimodal"]
 *
 *     ApiKey:
 *       type: object
 *       required:
 *         - id
 *         - providerId
 *         - userId
 *         - isValid
 *       properties:
 *         id:
 *           type: integer
 *           description: API key record ID
 *         providerId:
 *           type: integer
 *           description: Provider ID
 *         userId:
 *           type: integer
 *           description: User ID
 *         providerKeyId:
 *           type: string
 *           description: Provider's internal key identifier
 *         isValid:
 *           type: boolean
 *           description: Whether the key is valid
 *       example:
 *         id: 1
 *         providerId: 1
 *         userId: 1
 *         providerKeyId: "org-xxx"
 *         isValid: true
 */

/**
 * @swagger
 * /api/llm/providers:
 *   get:
 *     summary: Get all available LLM providers
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Provider'
 *       401:
 *         description: Unauthorized
 * 
 * /api/llm/providers/{id}/models:
 *   get:
 *     summary: Get all models for a specific provider
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Provider ID
 *     responses:
 *       200:
 *         description: List of models
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Model'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 * 
 * /api/llm/api-keys:
 *   get:
 *     summary: Get all API keys for the current user
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiKey'
 *       401:
 *         description: Unauthorized
 * 
 *   post:
 *     summary: Add a new API key
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerId
 *               - key
 *             properties:
 *               providerId:
 *                 type: integer
 *               key:
 *                 type: string
 *     responses:
 *       201:
 *         description: API key added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/llm/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 * 
 * /api/llm/health:
 *   get:
 *     summary: Check LLM service health
 *     tags: [LLM]
 *     responses:
 *       200:
 *         description: LLM service is healthy
 *       503:
 *         description: LLM service is unhealthy
 */

// Export an empty object as this file only contains JSDoc comments
export {};