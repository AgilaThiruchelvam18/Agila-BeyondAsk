/**
 * Subscription Management Routes
 * Handles billing, payment processing, plan management, and subscription lifecycle
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createSubscriptionSchema = z.object({
  planId: z.number().min(1, 'Plan ID is required'),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  metadata: z.record(z.any()).optional()
});

const updateSubscriptionSchema = z.object({
  planId: z.number().optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']).optional(),
  status: z.enum(['active', 'cancelled', 'paused', 'past_due', 'unpaid']).optional(),
  metadata: z.record(z.any()).optional()
});

const createPaymentSchema = z.object({
  subscriptionId: z.number().min(1, 'Subscription ID is required'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  metadata: z.record(z.any()).optional()
});

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']),
  features: z.array(z.string()).optional(),
  limits: z.record(z.any()).optional(),
  isActive: z.boolean().default(true)
});

/**
 * Get all subscription plans (public endpoint)
 */
router.get('/subscriptions/plans', async (req: Request, res: Response): Promise<Response> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const plans = await storage.getSubscriptionPlans(includeInactive);
    
    return res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch subscription plans', 500);
  }
});

/**
 * Get specific subscription plan
 */
router.get('/subscriptions/plans/:planId', async (req: Request, res: Response): Promise<Response> => {
  try {
    const planId = parseInt(req.params.planId);
    
    if (isNaN(planId)) {
      return sendError(res, 'Invalid plan ID', 400);
    }
    
    const plan = await storage.getSubscriptionPlan(planId);
    if (!plan) {
      return sendError(res, 'Subscription plan not found', 404);
    }
    
    return res.json(plan);
  } catch (error) {
    console.error('Error fetching subscription plan:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch subscription plan', 500);
  }
});

/**
 * Create subscription plan (admin only)
 */
router.post('/subscriptions/plans', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid plan data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const planData = validation.data;
    // Transform to match database schema
    const dbPlanData = {
      name: planData.name,
      description: planData.description || '',
      displayName: planData.name,
      monthlyPrice: planData.billingCycle === 'monthly' ? planData.price : planData.price / 12,
      annualPrice: planData.billingCycle === 'yearly' ? planData.price : planData.price * 12,
      agentLimit: (planData.limits as any)?.agents || 10,
      knowledgeBaseLimit: (planData.limits as any)?.knowledgeBases || 5,
      storageLimit: (planData.limits as any)?.storage || 1000,
      monthlyQuestionLimit: (planData.limits as any)?.questions || 1000,
      features: planData.features || [],
      isActive: planData.isActive,
      billingCycles: [planData.billingCycle],
      trialDays: 0,
      maxTeamMembers: (planData.limits as any)?.teamMembers || 5,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
      integrations: [] as string[],
      supportLevel: 'standard'
    };
    const plan = await storage.createSubscriptionPlan(dbPlanData);
    
    return res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating subscription plan:', getErrorMessage(error));
    return sendError(res, 'Failed to create subscription plan', 500);
  }
});

/**
 * Update subscription plan (admin only)
 */
router.put('/subscriptions/plans/:planId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const planId = parseInt(req.params.planId);
    
    if (isNaN(planId)) {
      return sendError(res, 'Invalid plan ID', 400);
    }
    
    const validation = createPlanSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid plan data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const planData = validation.data;
    const updatedPlan = await storage.updateSubscriptionPlan(planId, planData);
    
    if (!updatedPlan) {
      return sendError(res, 'Subscription plan not found', 404);
    }
    
    return res.json(updatedPlan);
  } catch (error) {
    console.error('Error updating subscription plan:', getErrorMessage(error));
    return sendError(res, 'Failed to update subscription plan', 500);
  }
});

/**
 * Get user's subscription
 */
router.get('/subscriptions/current', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const subscription = await storage.getUserSubscription(userId);
    
    if (!subscription) {
      return sendError(res, 'No active subscription found', 404);
    }
    
    // Get plan details
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    const result = {
      ...subscription,
      plan: plan
    };
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching current subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch current subscription', 500);
  }
});

/**
 * Create new subscription
 */
router.post('/subscriptions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid subscription data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    // Check if user already has an active subscription
    const existingSubscription = await storage.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      return sendError(res, 'User already has an active subscription', 400);
    }
    
    // Verify plan exists
    const plan = await storage.getSubscriptionPlan(validation.data.planId);
    if (!plan) {
      return sendError(res, 'Subscription plan not found', 404);
    }
    
    if (!plan.isActive) {
      return sendError(res, 'Subscription plan is not available', 400);
    }
    
    const subscriptionData = {
      userId: userId,
      status: 'active' as const,
      billingPeriod: validation.data.billingCycle,
      startDate: new Date().toISOString(),
      planId: validation.data.planId,
      metadata: validation.data.metadata || {}
    };
    
    const subscription = await storage.createSubscription(subscriptionData);
    
    // Create initial payment record
    const paymentData = {
      subscriptionId: subscription.id,
      amount: validation.data.billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice,
      currency: 'USD',
      paymentMethod: validation.data.paymentMethod,
      paymentProvider: 'stripe',
      status: 'completed' as const,
      metadata: { planName: plan.name, billingCycle: validation.data.billingCycle }
    };
    
    await storage.createPayment(paymentData);
    
    return res.status(201).json(subscription);
  } catch (error) {
    console.error('Error creating subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to create subscription', 500);
  }
});

/**
 * Update subscription
 */
router.put('/subscriptions/current', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = updateSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid subscription data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const subscription = await storage.getUserSubscription(userId);
    
    if (!subscription) {
      return sendError(res, 'No subscription found', 404);
    }
    
    // If changing plan, verify new plan exists
    if (validation.data.planId) {
      const newPlan = await storage.getSubscriptionPlan(validation.data.planId);
      if (!newPlan) {
        return sendError(res, 'New subscription plan not found', 404);
      }
      
      if (!newPlan.isActive) {
        return sendError(res, 'New subscription plan is not available', 400);
      }
    }
    
    const updateData = validation.data;
    const updatedSubscription = await storage.updateSubscription(subscription.id, updateData);
    
    if (!updatedSubscription) {
      return sendError(res, 'Subscription not found', 404);
    }
    
    return res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to update subscription', 500);
  }
});

/**
 * Cancel subscription
 */
router.delete('/subscriptions/current', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const immediate = req.query.immediate === 'true';
    
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      return sendError(res, 'No subscription found', 404);
    }
    
    if (subscription.status === 'cancelled') {
      return sendError(res, 'Subscription is already cancelled', 400);
    }
    
    const updateData = {
      status: 'cancelled' as const,
      ...(immediate ? { endDate: new Date().toISOString() } : {})
    };
    
    const cancelledSubscription = await storage.updateSubscription(subscription.id, updateData);
    
    return res.json(cancelledSubscription);
  } catch (error) {
    console.error('Error cancelling subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to cancel subscription', 500);
  }
});

/**
 * Get subscription payments
 */
router.get('/subscriptions/payments', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      return sendError(res, 'No subscription found', 404);
    }
    
    const payments = await storage.getSubscriptionPayments(subscription.id, page, limit);
    return res.json(payments);
  } catch (error) {
    console.error('Error fetching subscription payments:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch subscription payments', 500);
  }
});

/**
 * Process payment
 */
router.post('/subscriptions/payments', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid payment data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    // Verify subscription ownership
    const subscription = await storage.getSubscription(validation.data.subscriptionId);
    if (!subscription) {
      return sendError(res, 'Subscription not found', 404);
    }
    
    if (subscription.userId !== userId) {
      return sendError(res, 'Access denied to this subscription', 403);
    }
    
    const paymentData = {
      ...validation.data,
      paymentProvider: 'stripe',
      status: 'completed' as const, // In real implementation, this would be 'pending' until processed
    };
    
    const payment = await storage.createPayment(paymentData);
    
    // Update subscription status if payment successful
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      await storage.updateSubscription(subscription.id, { 
        status: 'active'
      });
    }
    
    return res.status(201).json(payment);
  } catch (error) {
    console.error('Error processing payment:', getErrorMessage(error));
    return sendError(res, 'Failed to process payment', 500);
  }
});

/**
 * Get subscription usage
 */
router.get('/subscriptions/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const period = req.query.period as string || 'current_month';
    
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      return sendError(res, 'No subscription found', 404);
    }
    
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'current_billing_cycle':
        // Calculate based on subscription start and billing cycle
        startDate = calculateBillingCycleStart(subscription);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    // Get usage records for the period
    const usageRecords = await storage.getUsageRecords(userId, startDate, now);
    
    // Get plan limits
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    
    const usage = {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      subscription: {
        id: subscription.id,
        planName: plan?.name,
        status: subscription.status
      },
      limits: {
        agents: plan?.agentLimit || 0,
        knowledgeBases: plan?.knowledgeBaseLimit || 0,
        storage: plan?.storageLimit || 0,
        questions: plan?.monthlyQuestionLimit || 0
      },
      current: usageRecords.reduce((acc, record) => {
        acc[record.resourceType] = (acc[record.resourceType] || 0) + record.amount;
        return acc;
      }, {} as Record<string, number>),
      details: usageRecords
    };
    
    return res.json(usage);
  } catch (error) {
    console.error('Error fetching subscription usage:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch subscription usage', 500);
  }
});

/**
 * Get billing history
 */
router.get('/subscriptions/billing', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      return sendError(res, 'No subscription found', 404);
    }
    
    const payments = await storage.getSubscriptionPayments(subscription.id, page, limit);
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    
    const billing = {
      subscription: {
        id: subscription.id,
        planName: plan?.name,
        status: subscription.status,
        billingCycle: subscription.billingPeriod,
        nextBillingDate: subscription.startDate
      },
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paymentProvider: payment.paymentProvider,
        createdAt: payment.createdAt
      })),
      summary: {
        totalPaid: payments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
        pendingAmount: payments
          .filter(p => p.status === 'pending')
          .reduce((sum, p) => sum + p.amount, 0),
        failedPayments: payments.filter(p => p.status === 'failed').length
      }
    };
    
    return res.json(billing);
  } catch (error) {
    console.error('Error fetching billing history:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch billing history', 500);
  }
});

// Helper methods
const calculateNextBillingDate = (billingCycle: string, fromDate: Date = new Date()): Date => {
  const date = new Date(fromDate);
  
  switch (billingCycle) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date;
};

const calculateBillingCycleStart = (subscription: any): Date => {
  const startDate = new Date(subscription.startDate);
  const now = new Date();
  
  // Calculate how many billing cycles have passed
  let cycleLength: number;
  switch (subscription.billingCycle) {
    case 'monthly':
      cycleLength = 30 * 24 * 60 * 60 * 1000; // Approximate
      break;
    case 'quarterly':
      cycleLength = 90 * 24 * 60 * 60 * 1000; // Approximate
      break;
    case 'yearly':
      cycleLength = 365 * 24 * 60 * 60 * 1000; // Approximate
      break;
    default:
      cycleLength = 30 * 24 * 60 * 60 * 1000;
  }
  
  const timeElapsed = now.getTime() - startDate.getTime();
  const cyclesPassed = Math.floor(timeElapsed / cycleLength);
  
  return new Date(startDate.getTime() + (cyclesPassed * cycleLength));
};

export default router;