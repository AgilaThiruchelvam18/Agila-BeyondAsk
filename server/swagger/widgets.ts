/**
 * @swagger
 * tags:
 *   name: Widgets
 *   description: Chat widget management and public API
 * 
 * components:
 *   schemas:
 *     Widget:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - userId
 *         - agentId
 *         - publicKey
 *         - secretKey
 *         - config
 *         - active
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: The widget ID
 *         name:
 *           type: string
 *           description: Widget name
 *         userId:
 *           type: integer
 *           description: Owner user ID
 *         agentId:
 *           type: integer
 *           description: Agent ID used by this widget
 *         publicKey:
 *           type: string
 *           description: Public API key (safe to expose)
 *         secretKey:
 *           type: string
 *           description: Secret API key (should not be exposed)
 *         config:
 *           type: object
 *           properties:
 *             theme:
 *               type: object
 *               properties:
 *                 primaryColor:
 *                   type: string
 *                 textColor:
 *                   type: string
 *                 backgroundColor:
 *                   type: string
 *             position:
 *               type: string
 *               enum: [bottom-right, bottom-left, top-right, top-left]
 *             size:
 *               type: string
 *               enum: [small, medium, large]
 *             welcomeMessage:
 *               type: string
 *             widgetTitle:
 *               type: string
 *         active:
 *           type: boolean
 *           description: Whether the widget is active
 *         allowAnonymous:
 *           type: boolean
 *           description: Whether anonymous access is allowed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the widget was created
 *       example:
 *         id: 1
 *         name: Support Widget
 *         userId: 1
 *         agentId: 1
 *         publicKey: pk_abc123
 *         secretKey: sk_xyz789
 *         config:
 *           theme:
 *             primaryColor: "#3b82f6"
 *             textColor: "#ffffff"
 *             backgroundColor: "#ffffff"
 *           position: "bottom-right"
 *           size: "medium"
 *           welcomeMessage: "How can I help you today?"
 *           widgetTitle: "Support Bot"
 *         active: true
 *         allowAnonymous: false
 *         createdAt: 2023-01-01T00:00:00.000Z
 *     
 *     WidgetUser:
 *       type: object
 *       required:
 *         - id
 *         - email
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Widget user ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         name:
 *           type: string
 *           nullable: true
 *           description: User name
 *         verified:
 *           type: boolean
 *           nullable: true
 *           description: Whether email is verified
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Time of last login
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the user was created
 *       example:
 *         id: 1
 *         email: user@example.com
 *         name: John Doe
 *         verified: true
 *         lastLoginAt: 2023-01-01T12:00:00.000Z
 *         createdAt: 2023-01-01T00:00:00.000Z
 *     
 *     OTP:
 *       type: object
 *       required:
 *         - id
 *         - email
 *         - code
 *         - expiresAt
 *         - verified
 *         - createdAt
 *       properties:
 *         id:
 *           type: string
 *           description: OTP record ID (UUID format)
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         code:
 *           type: string
 *           description: One-time password code
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: When the OTP expires
 *         verified:
 *           type: boolean
 *           description: Whether the OTP has been verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the OTP was created
 *       example:
 *         id: "c7b6e981-159e-4d09-8e7c-c45532a7e837"
 *         email: user@example.com
 *         code: "123456"
 *         expiresAt: 2023-01-01T01:00:00.000Z
 *         verified: false
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         
 *     AnonymousWidgetUser:
 *       type: object
 *       required:
 *         - id
 *         - uuid
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Anonymous user ID
 *         uuid:
 *           type: string
 *           description: Unique identifier for the anonymous user
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           description: IP address of the user
 *         lastActive:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Time of last activity
 *         metadata:
 *           type: object
 *           nullable: true
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the anonymous user was created
 *       example:
 *         id: 1
 *         uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *         ipAddress: "192.168.1.1"
 *         lastActive: "2025-04-08T12:00:00.000Z"
 *         metadata: { userAgent: "Mozilla/5.0" }
 *         createdAt: "2025-04-08T00:00:00.000Z"
 *         
 *     AnonymousWidgetSession:
 *       type: object
 *       required:
 *         - id
 *         - anonymousUserId
 *         - widgetId
 *         - token
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Session ID
 *         anonymousUserId:
 *           type: integer
 *           description: Anonymous user ID
 *         widgetId:
 *           type: integer
 *           description: Widget ID
 *         token:
 *           type: string
 *           description: Session token
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the session expires
 *         lastActive:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Time of last activity
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the session was created
 *       example:
 *         id: 1
 *         anonymousUserId: 1
 *         widgetId: 1
 *         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         expiresAt: "2025-04-09T00:00:00.000Z"
 *         lastActive: "2025-04-08T12:00:00.000Z"
 *         createdAt: "2025-04-08T00:00:00.000Z"
 *         
 *     WidgetLead:
 *       type: object
 *       required:
 *         - id
 *         - widgetId
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Lead ID
 *         widgetId:
 *           type: integer
 *           description: Widget ID
 *         anonymousUserId:
 *           type: integer
 *           nullable: true
 *           description: Anonymous user ID if applicable
 *         name:
 *           type: string
 *           nullable: true
 *           description: Lead's name
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: Lead's email
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Lead's phone number
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           description: IP address
 *         metadata:
 *           type: object
 *           nullable: true
 *           description: Additional metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the lead was created
 *       example:
 *         id: 1
 *         widgetId: 1
 *         anonymousUserId: 1
 *         name: "Jane Smith"
 *         email: "jane@example.com"
 *         phone: "+1234567890"
 *         ipAddress: "192.168.1.1"
 *         metadata: { source: "homepage", referrer: "google.com" }
 *         createdAt: "2025-04-08T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/widgets:
 *   get:
 *     summary: Get all widgets for the current user
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of widgets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Widget'
 *       401:
 *         description: Unauthorized
 * 
 *   post:
 *     summary: Create a new widget
 *     tags: [Widgets]
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
 *               - agentId
 *             properties:
 *               name:
 *                 type: string
 *               agentId:
 *                 type: integer
 *               config:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: object
 *                     properties:
 *                       primaryColor:
 *                         type: string
 *                       textColor:
 *                         type: string
 *                       backgroundColor:
 *                         type: string
 *                   position:
 *                     type: string
 *                     enum: [bottom-right, bottom-left, top-right, top-left]
 *                   size:
 *                     type: string
 *                     enum: [small, medium, large]
 *                   welcomeMessage:
 *                     type: string
 *                   widgetTitle:
 *                     type: string
 *               allowAnonymous:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Created widget
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 * /api/widgets/{id}:
 *   get:
 *     summary: Get a specific widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Widget ID
 *     responses:
 *       200:
 *         description: Widget details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Widget not found
 *
 *   patch:
 *     summary: Update a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Widget ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               agentId:
 *                 type: integer
 *               config:
 *                 type: object
 *               active:
 *                 type: boolean
 *               allowAnonymous:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated widget
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Widget'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Widget not found
 * 
 *   delete:
 *     summary: Delete a widget
 *     tags: [Widgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Widget ID
 *     responses:
 *       200:
 *         description: Widget deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Widget not found
 * 
 * /api/widgets/public/{publicKey}:
 *   get:
 *     summary: Get public widget information
 *     tags: [Widgets]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Widget public key
 *     responses:
 *       200:
 *         description: Public widget information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 widget:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     config:
 *                       type: object
 *                     allowAnonymous:
 *                       type: boolean
 *       404:
 *         description: Widget not found
 * 
 * /api/widget/auth/request-otp:
 *   post:
 *     summary: Request a one-time password for widget authentication
 *     tags: [Widgets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - widgetPublicKey
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               widgetPublicKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Widget not found
 * 
 * /api/widget/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get access token
 *     tags: [Widgets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - widgetPublicKey
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *               widgetPublicKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/WidgetUser'
 *       400:
 *         description: Invalid OTP
 *       404:
 *         description: OTP not found
 *
 * /api/public/widgets/{publicKey}/anonymous/init:
 *   post:
 *     summary: Initialize an anonymous widget session
 *     tags: [Widgets]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Widget public key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uuid:
 *                 type: string
 *                 description: Client-generated UUID for anonymous user
 *               ipAddress:
 *                 type: string
 *                 description: IP address (optional, can be detected server-side)
 *               metadata:
 *                 type: object
 *                 description: Additional metadata like user agent
 *     responses:
 *       200:
 *         description: Anonymous session initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Session token
 *                 user:
 *                   $ref: '#/components/schemas/AnonymousWidgetUser'
 *                 widget:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     config:
 *                       type: object
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Widget not found
 * 
 * /api/public/widgets/{publicKey}/anonymous/leads:
 *   post:
 *     summary: Submit lead information from an anonymous widget user
 *     tags: [Widgets]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Widget public key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 description: Lead's name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Lead's email
 *               phone:
 *                 type: string
 *                 description: Lead's phone number (optional)
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the lead
 *     responses:
 *       201:
 *         description: Lead information captured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WidgetLead'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized (missing Authorization header)
 *       404:
 *         description: Widget not found
 *
 * /api/public/widgets/{publicKey}/anonymous/chat:
 *   post:
 *     summary: Send a message as an anonymous widget user
 *     tags: [Widgets]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Widget public key
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message content
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the message
 *     responses:
 *       200:
 *         description: Agent response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Response message from the agent
 *                 sourceDocuments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       metadata:
 *                         type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Widget not found
 */

// Export an empty object as this file only contains JSDoc comments
export {};