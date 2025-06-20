/**
 * @swagger
 * tags:
 *   name: Embeddings
 *   description: Vector embeddings management and retrieval
 * 
 * components:
 *   schemas:
 *     EmbeddingResult:
 *       type: object
 *       required:
 *         - id
 *         - embedding
 *         - metadata
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the embedding
 *         embedding:
 *           type: array
 *           items:
 *             type: number
 *           description: Vector representation of the text
 *         metadata:
 *           type: object
 *           description: Additional metadata about the embedding
 *     
 *     EmbeddingVector:
 *       type: object
 *       required:
 *         - id
 *         - values
 *         - metadata
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the vector
 *         values:
 *           type: array
 *           items:
 *             type: number
 *           description: The embedding vector values
 *         metadata:
 *           type: object
 *           description: Metadata associated with this vector
 *           properties:
 *             documentId:
 *               type: string
 *               description: ID of the source document
 *             chunkIndex:
 *               type: integer
 *               description: Index of the chunk within the document
 *             source:
 *               type: string
 *               description: Source type of the document
 *             title:
 *               type: string
 *               description: Document title
 *
 *     SearchResult:
 *       type: object
 *       required:
 *         - id
 *         - content
 *         - score
 *         - metadata
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the result
 *         content:
 *           type: string
 *           description: The text content of the result
 *         score:
 *           type: number
 *           description: Similarity score (0-1)
 *         metadata:
 *           type: object
 *           description: Additional metadata about the result
 */
 
/**
 * @swagger
 * /api/llm/embeddings:
 *   post:
 *     summary: Generate vector embeddings for text
 *     description: Generates vector embeddings for the provided text using the specified provider
 *     tags: [Embeddings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to generate embeddings for
 *               providerId:
 *                 type: string
 *                 description: Provider ID (openai, anthropic, mistral) or numeric ID
 *                 default: "openai"
 *               model:
 *                 type: string
 *                 description: Model name (optional, provider-specific)
 *     responses:
 *       200:
 *         description: Successfully generated embeddings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 embedding:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: Vector representation
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * 
 * /api/knowledge-base/{knowledgeBaseId}/search:
 *   post:
 *     summary: Search knowledge base for relevant content
 *     description: |
 *       Searches knowledge base for content relevant to the query.
 *       Includes retry mechanism for newly added content with a delay between attempts.
 *     tags: [Embeddings, Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: knowledgeBaseId
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
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query text
 *               providerId:
 *                 type: string
 *                 description: Provider ID for embeddings (openai, anthropic, mistral)
 *                 default: "openai"
 *               limit:
 *                 type: integer
 *                 description: Maximum number of results to return
 *                 default: 5
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SearchResult'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *       500:
 *         description: Server error
 *
 * /api/knowledge-base/{knowledgeBaseId}/query:
 *   post:
 *     summary: Query knowledge base and generate AI response
 *     description: |
 *       Searches knowledge base for relevant content and uses it to generate an AI response.
 *       Includes retry mechanism with delay for newly indexed content.
 *     tags: [Embeddings, Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: knowledgeBaseId
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
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Question to ask
 *               providerId:
 *                 type: string
 *                 description: Provider ID for LLM (openai, anthropic, mistral)
 *                 default: "openai"
 *     responses:
 *       200:
 *         description: AI response with references
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                   description: AI-generated answer
 *                 references:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Reference ID
 *                       score:
 *                         type: number
 *                         description: Relevance score
 *                       content:
 *                         type: string
 *                         description: Preview of content
 *                       source:
 *                         type: string
 *                         description: Source information
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *       500:
 *         description: Server error
 * 
 * /api/document/{documentId}/embeddings:
 *   post:
 *     summary: Create or reprocess embeddings for a document
 *     description: |
 *       Processes a document and creates vector embeddings. 
 *       Includes a delay after processing to ensure proper indexing in Pinecone.
 *     tags: [Embeddings, Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               providerId:
 *                 type: string
 *                 description: Provider ID for embeddings (openai, anthropic, mistral)
 *                 default: "openai"
 *               forceReprocess:
 *                 type: boolean
 *                 description: Force reprocessing even if already processed
 *                 default: false
 *     responses:
 *       200:
 *         description: Embeddings created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document_id:
 *                   type: integer
 *                   description: Document ID
 *                 status:
 *                   type: string
 *                   description: Processing status
 *                 chunks:
 *                   type: integer
 *                   description: Number of chunks created
 *                 embeddings:
 *                   type: integer
 *                   description: Number of embeddings created
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */

// Export an empty object as this file only contains JSDoc comments
export {};