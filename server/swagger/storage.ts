/**
 * @swagger
 * tags:
 *   name: Storage
 *   description: Storage management and monitoring
 * 
 * components:
 *   schemas:
 *     StorageMetrics:
 *       type: object
 *       properties:
 *         totalBytes:
 *           type: integer
 *           description: Total storage used in bytes
 *         formattedUsage:
 *           type: string
 *           description: Human-readable format of storage used (e.g., "500 MB")
 *         formattedLimit:
 *           type: string
 *           description: Human-readable format of storage limit (e.g., "1 GB")
 *         formattedRemaining:
 *           type: string
 *           description: Human-readable format of remaining storage (e.g., "500 MB")
 *         percentUsed:
 *           type: number
 *           description: Percentage of storage limit used
 *         isWithinLimits:
 *           type: boolean
 *           description: Whether the current usage is within limits
 *       example:
 *         totalBytes: 52428800
 *         formattedUsage: "50 MB"
 *         formattedLimit: "1 GB"
 *         formattedRemaining: "974 MB"
 *         percentUsed: 4.9
 *         isWithinLimits: true
 * 
 * /api/storage/metrics:
 *   get:
 *     summary: Get storage usage metrics for the current user
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorageMetrics'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * 
 * /api/storage/calculate:
 *   post:
 *     summary: Calculate storage usage for a new file before upload
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileSize
 *             properties:
 *               fileSize:
 *                 type: integer
 *                 description: Size of the file in bytes
 *     responses:
 *       200:
 *         description: Calculation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canUpload:
 *                   type: boolean
 *                   description: Whether the file can be uploaded within current limits
 *                 currentUsage:
 *                   type: integer
 *                   description: Current storage usage in bytes
 *                 newUsage:
 *                   type: integer
 *                   description: Projected usage after upload in bytes
 *                 limit:
 *                   type: integer
 *                   description: Maximum storage limit in bytes
 *                 formattedCurrentUsage:
 *                   type: string
 *                   description: Human-readable current usage
 *                 formattedNewUsage:
 *                   type: string
 *                   description: Human-readable projected usage
 *                 formattedLimit:
 *                   type: string
 *                   description: Human-readable limit
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

// Export an empty object as this file only contains JSDoc comments
export {};