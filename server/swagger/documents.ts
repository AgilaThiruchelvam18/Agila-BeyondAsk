/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management, processing, and embedding
 * 
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - knowledgeBaseId
 *         - sourceType
 *         - userId
 *         - status
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The document ID
 *         title:
 *           type: string
 *           description: The document title
 *         description:
 *           type: string
 *           nullable: true
 *           description: Document description
 *         content:
 *           type: string
 *           nullable: true
 *           description: Raw text content (may be null for PDF/URL documents)
 *         knowledgeBaseId:
 *           type: integer
 *           description: The parent knowledge base ID
 *         userId:
 *           type: integer
 *           description: The owner user ID
 *         status:
 *           type: string
 *           enum: [pending, processing, processed, failed, archived]
 *           description: Processing status
 *         sourceType:
 *           type: string
 *           enum: [text, pdf, url, image, audio, youtube]
 *           description: Document source type
 *         sourceUrl:
 *           type: string
 *           nullable: true
 *           description: Source URL for URL documents
 *         filePath:
 *           type: string
 *           nullable: true
 *           description: File path for uploaded documents
 *         fileSize:
 *           type: integer
 *           nullable: true
 *           description: File size in bytes
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         processingInfo:
 *           type: object
 *           description: Information about processing status
 *         embeddingIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Vector embeddings IDs
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the document was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the document was last updated
 *       example:
 *         id: 1
 *         title: API Documentation
 *         description: API Reference Guide
 *         content: null
 *         knowledgeBaseId: 1
 *         userId: 1
 *         status: processed
 *         sourceType: pdf
 *         sourceUrl: null
 *         filePath: /uploads/1234567890.pdf
 *         fileSize: 1024567
 *         metadata: { pages: 25, author: "John Doe" }
 *         processingInfo: { chunks: 42, completed_at: "2023-01-01T01:00:00.000Z" }
 *         embeddingIds: ["emb_123", "emb_124"]
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         updatedAt: 2023-01-01T01:00:00.000Z
 */

/**
 * @swagger
 * /api/knowledge-bases/{kbId}/documents/upload-multiple:
 *   post:
 *     summary: Upload multiple PDF documents at once
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - baseTitle
 *               - files
 *             properties:
 *               baseTitle:
 *                 type: string
 *                 description: Base title to use for all uploaded documents
 *               description:
 *                 type: string
 *                 description: Optional description for the documents
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: PDF files to upload (maximum 10)
 *               metadata:
 *                 type: string
 *                 format: json
 *                 description: Optional metadata to apply to all documents
 *     responses:
 *       201:
 *         description: Documents uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Document ID
 *                       title:
 *                         type: string
 *                         description: Document title
 *                       status:
 *                         type: string
 *                         description: Document status
 *                       originalName:
 *                         type: string
 *                         description: Original filename
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (storage limit exceeded)
 *
 * /api/knowledge-bases/{kbId}/documents:
 *   get:
 *     summary: Get all documents in a knowledge base
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *
 * /api/knowledge-bases/{kbId}/documents/export:
 *   get:
 *     summary: Export all documents from a knowledge base
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: JSON file with all documents in the knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 knowledgeBase:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     customFields:
 *                       type: array
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 *
 * /api/knowledge-bases/{kbId}/documents/import:
 *   post:
 *     summary: Import multiple documents to a knowledge base
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
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
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - sourceType
 *                     - content
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Document title
 *                     description:
 *                       type: string
 *                       description: Document description
 *                     sourceType:
 *                       type: string
 *                       enum: [text]
 *                       description: Currently only text documents are supported for bulk import
 *                     content:
 *                       type: string
 *                       description: Text content
 *                     metadata:
 *                       type: object
 *                       description: Optional metadata
 *     responses:
 *       200:
 *         description: Import results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of documents in the import
 *                 successful:
 *                   type: integer
 *                   description: Number of successfully imported documents
 *                 failed:
 *                   type: integer
 *                   description: Number of failed documents
 *                 createdDocuments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       error:
 *                         type: string
 *       400:
 *         description: Invalid request format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden or storage limit exceeded
 *       404:
 *         description: Knowledge base not found
 *       500:
 *         description: Server error
 *
 * /api/knowledge-bases/{kbId}/documents/{id}:
 *   get:
 *     summary: Get a specific document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 * 
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 * 
 * /api/knowledge-bases/{kbId}/documents/text:
 *   post:
 *     summary: Create a new text document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
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
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/knowledge-bases/{kbId}/documents/url:
 *   post:
 *     summary: Create a new document from URL
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
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
 *               - title
 *               - sourceUrl
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               sourceUrl:
 *                 type: string
 *                 format: url
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/knowledge-bases/{kbId}/documents/upload:
 *   post:
 *     summary: Upload a PDF document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - file
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *               metadata:
 *                 type: string
 *                 format: json
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/knowledge-bases/{kbId}/documents/youtube:
 *   post:
 *     summary: Create a new document from YouTube video
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
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
 *               - title
 *               - youtubeUrl
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               youtubeUrl:
 *                 type: string
 *                 format: url
 *                 description: URL of the YouTube video to process
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       402:
 *         description: Payment Required (storage limit exceeded)
 *
 * /api/knowledge-bases/{kbId}/documents/{id}/process:
 *   post:
 *     summary: Process a document to generate embeddings
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge base ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document_id:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [processing]
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */

// Export an empty object as this file only contains JSDoc comments
export {};