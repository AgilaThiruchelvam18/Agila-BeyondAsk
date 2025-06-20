/**
 * @swagger
 * tags:
 *   name: Knowledge Bases
 *   description: Knowledge base management and operations
 * 
 * components:
 *   schemas:
 *     KnowledgeBase:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - userId
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The knowledge base ID
 *         name:
 *           type: string
 *           description: The knowledge base name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Knowledge base description
 *         userId:
 *           type: integer
 *           description: The owner user ID
 *         vectorStoreId:
 *           type: string
 *           nullable: true
 *           description: External vector store identifier
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the knowledge base was created
 *       example:
 *         id: 1
 *         name: Product Documentation
 *         description: Contains all product documentation
 *         userId: 1
 *         vectorStoreId: pinecone-kb-123
 *         metadata: { source: "Internal docs", tags: ["product", "documentation"] }
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         
 *     KnowledgeBaseDependencies:
 *       type: object
 *       properties:
 *         documents:
 *           type: integer
 *           description: Number of documents in this knowledge base
 *         agents:
 *           type: integer
 *           description: Number of agents using this knowledge base
 *         unansweredQuestions:
 *           type: integer
 *           description: Number of unanswered questions associated with this knowledge base
 */

/**
 * @swagger
 * /api/knowledge-bases:
 *   get:
 *     summary: Get all knowledge bases for the current user
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of knowledge bases
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KnowledgeBase'
 *       401:
 *         description: Unauthorized
 * 
 *   post:
 *     summary: Create a new knowledge base
 *     tags: [Knowledge Bases]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Created knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/knowledge-bases/{id}:
 *   get:
 *     summary: Get a specific knowledge base
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 * 
 *   patch:
 *     summary: Update a knowledge base
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
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
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 * 
 *   delete:
 *     summary: Delete a knowledge base
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 * 
 * /api/knowledge-bases/{id}/dependencies:
 *   get:
 *     summary: Get knowledge base dependencies
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base dependencies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBaseDependencies'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 * 
 * /api/knowledge-bases/{id}/cascade-delete:
 *   delete:
 *     summary: Delete a knowledge base and all its documents
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base and all documents deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */

// Export an empty object as this file only contains JSDoc comments
export {};