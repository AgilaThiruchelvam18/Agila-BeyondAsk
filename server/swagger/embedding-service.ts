/**
 * @swagger
 * tags:
 *   name: Embedding Service
 *   description: Internal embedding service functions with improved reliability
 * 
 * components:
 *   schemas:
 *     EmbeddingStats:
 *       type: object
 *       properties:
 *         totalVectors:
 *           type: integer
 *           description: Total number of vectors in the namespace
 *         namespaceInfo:
 *           type: object
 *           description: Information about the namespace
 *     
 *     QueryResult:
 *       type: object
 *       required:
 *         - answer
 *         - references
 *       properties:
 *         answer:
 *           type: string
 *           description: AI-generated answer based on knowledge base content
 *         references:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Reference ID
 *               score:
 *                 type: number
 *                 description: Relevance score (0-1)
 *               content:
 *                 type: string
 *                 description: Preview of the referenced content
 *               source:
 *                 type: string
 *                 description: Source information
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the reference
 */
 
/**
 * @swagger
 * /api/embedding-service/functions:
 *   get:
 *     summary: List embedding service functions
 *     description: Shows documentation for improved embedding service functions
 *     tags: [Embedding Service]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of embedding service functions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 functions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Function name
 *                       description:
 *                         type: string
 *                         description: Function description
 *                       parameters:
 *                         type: object
 *                         description: Function parameters
 *       401:
 *         description: Unauthorized
 *
 * /api/embedding-service/create-and-store-embeddings:
 *   post:
 *     summary: Create and store embeddings for document chunks
 *     description: |
 *       Processes document chunks, creates embeddings, and stores them in Pinecone.
 *       Includes improved indexing delay to ensure searchability of newly created vectors.
 *     tags: [Embedding Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - knowledgeBaseId
 *               - documentId
 *               - processedDocument
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               knowledgeBaseId:
 *                 type: integer
 *                 description: Knowledge base ID
 *               documentId:
 *                 type: string
 *                 description: Document ID
 *               processedDocument:
 *                 type: object
 *                 description: Processed document with chunks
 *               providerId:
 *                 type: integer
 *                 description: Provider ID for embeddings
 *                 default: 1
 *     responses:
 *       200:
 *         description: Embeddings created and stored
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmbeddingResult'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * /api/embedding-service/query-knowledge-base:
 *   post:
 *     summary: Query knowledge base with reliable retry mechanism
 *     description: |
 *       Searches knowledge base for content relevant to query and generates AI answer.
 *       Implements retry mechanism for newly indexed content with configurable attempts.
 *     tags: [Embedding Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - knowledgeBaseId
 *               - query
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               knowledgeBaseId:
 *                 type: integer
 *                 description: Knowledge base ID
 *               query:
 *                 type: string
 *                 description: Question to ask
 *               providerId:
 *                 type: integer
 *                 description: Provider ID for LLM
 *                 default: 1
 *               maxAttempts:
 *                 type: integer
 *                 description: Maximum number of retry attempts
 *                 default: 2
 *     responses:
 *       200:
 *         description: Query result with references
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryResult'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * /api/embedding-service/search-embeddings:
 *   post:
 *     summary: Search embeddings with retry mechanism
 *     description: |
 *       Searches vector embeddings for similar content with retry logic.
 *       Improved for handling newly indexed content with configurable attempts.
 *     tags: [Embedding Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - knowledgeBaseId
 *               - query
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               knowledgeBaseId:
 *                 type: integer
 *                 description: Knowledge base ID
 *               query:
 *                 type: string
 *                 description: Search query
 *               providerId:
 *                 type: integer
 *                 description: Provider ID for embeddings
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 description: Maximum number of results
 *                 default: 5
 *               attempts:
 *                 type: integer
 *                 description: Number of search attempts
 *                 default: 2
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SearchResult'
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * /api/embedding-service/delete-embeddings-by-filter:
 *   post:
 *     summary: Delete embeddings by filter criteria
 *     description: Delete embeddings in a namespace matching specified filter criteria
 *     tags: [Embedding Service]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - knowledgeBaseId
 *               - filter
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               knowledgeBaseId:
 *                 type: integer
 *                 description: Knowledge base ID
 *               filter:
 *                 type: object
 *                 description: Filter criteria for embeddings to delete
 *     responses:
 *       204:
 *         description: Embeddings deleted successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

// Export an empty object as this file only contains JSDoc comments
export {};