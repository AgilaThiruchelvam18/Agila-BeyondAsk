/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription plans, user subscriptions and usage metrics
 * 
 * components:
 *   schemas:
 *     SubscriptionPlan:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - description
 *         - priceMonthly
 *         - priceYearly
 *         - isActive
 *       properties:
 *         id:
 *           type: integer
 *           description: The subscription plan ID
 *         name:
 *           type: string
 *           description: Plan name (e.g., Starter, Professional, Enterprise)
 *         description:
 *           type: string
 *           description: Brief description of the plan
 *         priceMonthly:
 *           type: integer
 *           description: Monthly price in cents
 *         priceYearly:
 *           type: integer
 *           description: Yearly price in cents
 *         agentLimit:
 *           type: integer
 *           description: Maximum number of agents allowed
 *         knowledgeBaseLimit:
 *           type: integer
 *           description: Maximum number of knowledge bases allowed
 *         storageLimit:
 *           type: integer
 *           description: Maximum storage in bytes
 *         questionPerMonthLimit:
 *           type: integer
 *           description: Maximum questions per month
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           description: List of features included in the plan
 *         isActive:
 *           type: boolean
 *           description: Whether the plan is currently active
 *         sortOrder:
 *           type: integer
 *           description: Order to display plans
 *       example:
 *         id: 1
 *         name: Professional
 *         description: For growing businesses
 *         priceMonthly: 4900
 *         priceYearly: 49900
 *         agentLimit: 10
 *         knowledgeBaseLimit: 20
 *         storageLimit: 1073741824
 *         questionPerMonthLimit: 5000
 *         features: ["Custom branding", "Priority support", "Advanced analytics"]
 *         isActive: true
 *         sortOrder: 2
 *     
 *     UserSubscription:
 *       type: object
 *       required:
 *         - id
 *         - userId
 *         - planId
 *         - status
 *         - billingPeriod
 *         - startDate
 *       properties:
 *         id:
 *           type: integer
 *           description: The subscription ID
 *         userId:
 *           type: integer
 *           description: User ID this subscription belongs to
 *         planId:
 *           type: integer
 *           description: Subscription plan ID
 *         status:
 *           type: string
 *           enum: [active, canceled, expired, trial]
 *           description: Current subscription status
 *         billingPeriod:
 *           type: string
 *           enum: [monthly, yearly]
 *           description: Billing period type
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: When the subscription began
 *         endDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the subscription ends/ended
 *         trialEndDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the trial period ends
 *         canceledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the subscription was canceled
 *         nextBillingDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Next billing date
 *         paymentProvider:
 *           type: string
 *           nullable: true
 *           description: Payment provider (e.g., stripe)
 *         paymentProviderId:
 *           type: string
 *           nullable: true
 *           description: ID assigned by payment provider
 *       example:
 *         id: 1
 *         userId: 42
 *         planId: 2
 *         status: active
 *         billingPeriod: monthly
 *         startDate: 2025-04-01T00:00:00Z
 *         endDate: null
 *         trialEndDate: null
 *         canceledAt: null
 *         nextBillingDate: 2025-05-01T00:00:00Z
 *         paymentProvider: stripe
 *         paymentProviderId: sub_1234567890
 *     
 *     UsageMetrics:
 *       type: object
 *       required:
 *         - id
 *         - userId
 *         - metricType
 *         - metricValue
 *         - periodStart
 *         - periodEnd
 *       properties:
 *         id:
 *           type: integer
 *           description: The usage metric ID
 *         userId:
 *           type: integer
 *           description: User ID this usage belongs to
 *         subscriptionId:
 *           type: integer
 *           nullable: true
 *           description: Associated subscription ID
 *         metricType:
 *           type: string
 *           enum: [agent, knowledgeBase, storage, questions]
 *           description: Type of resource being measured
 *         metricValue:
 *           type: integer
 *           description: Current usage value
 *         periodStart:
 *           type: string
 *           format: date-time
 *           description: Start of the measurement period
 *         periodEnd:
 *           type: string
 *           format: date-time
 *           description: End of the measurement period
 *       example:
 *         id: 1
 *         userId: 42
 *         subscriptionId: 5
 *         metricType: storage
 *         metricValue: 52428800
 *         periodStart: 2025-04-01T00:00:00Z
 *         periodEnd: 2025-04-30T23:59:59Z
 *
 * /api/subscription/plans:
 *   get:
 *     summary: Get all active subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of subscription plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlan'
 *       500:
 *         description: Server error
 * 
 * /api/subscription/user:
 *   get:
 *     summary: Get the current user's active subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User subscription details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscription:
 *                   $ref: '#/components/schemas/UserSubscription'
 *                 plan:
 *                   $ref: '#/components/schemas/SubscriptionPlan'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * 
 * /api/subscription/{id}/cancel:
 *   post:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *       - in: query
 *         name: immediate
 *         schema:
 *           type: boolean
 *         description: Whether to cancel immediately (true) or at the end of the billing period (false)
 *     responses:
 *       200:
 *         description: Subscription canceled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSubscription'
 *       400:
 *         description: Invalid subscription ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your subscription
 *       500:
 *         description: Server error
 * 
 * /api/subscription/usage-metrics:
 *   get:
 *     summary: Get usage metrics for the current user
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [agent, knowledgeBase, storage, questions]
 *         description: Type of resource to check usage for
 *     responses:
 *       200:
 *         description: Usage metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isWithinLimits:
 *                   type: boolean
 *                   description: Whether the user is within their subscription limits
 *                 currentUsage:
 *                   type: integer
 *                   description: Current usage of the resource
 *                 limit:
 *                   type: integer
 *                   description: Maximum allowed by the subscription
 *                 remainingUsage:
 *                   type: integer
 *                   description: Remaining available usage
 *                 percentUsed:
 *                   type: number
 *                   description: Percentage of limit used
 *                 planName:
 *                   type: string
 *                   description: Name of the subscription plan
 *                 storageMetrics:
 *                   type: object
 *                   description: Additional formatted storage metrics (only for storage resource type)
 *                   properties:
 *                     formattedUsage:
 *                       type: string
 *                       description: Human-readable current usage (e.g., "500 MB")
 *                     formattedLimit:
 *                       type: string
 *                       description: Human-readable limit (e.g., "1 GB")
 *                     formattedRemaining:
 *                       type: string
 *                       description: Human-readable remaining storage (e.g., "500 MB")
 *       400:
 *         description: Invalid resource type
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */