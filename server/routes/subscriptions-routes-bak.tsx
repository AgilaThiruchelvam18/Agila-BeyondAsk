/**
 * Subscription Management Routes
 * Handles billing, payment processing, subscription plans, and usage tracking
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';

const router = Router();

// Get available subscription plans
router.get('/subscriptions/plans', async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log('GET /api/subscriptions/plans: Fetching available subscription plans');

    const plans = await storage.getSubscriptionPlans();

    console.log(`GET /api/subscriptions/plans: Found ${plans.length} plans`);
    return res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch subscription plans', 500);
  }
});

// Get user's current subscription
router.get('/subscriptions/current', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    console.log(`GET /api/subscriptions/current: Fetching current subscription for user ${userId}`);

    const subscription = await storage.getUserSubscription(userId);
    
    if (!subscription) {
      // Return default free plan if no subscription exists
      const freePlan = {
        id: null,
        userId,
        planId: 'free',
        planName: 'Free Plan',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        usage: {
          documentsProcessed: 0,
          queriesPerformed: 0,
          storageUsed: 0
        },
        limits: {
          maxDocuments: 10,
          maxQueries: 100,
          maxStorage: 100 // MB
        }
      };
      return res.json(freePlan);
    }

    console.log(`GET /api/subscriptions/current: Found subscription ID ${subscription.id}`);
    return res.json(subscription);
  } catch (error) {
    console.error('Error fetching current subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch current subscription', 500);
  }
});

// Create new subscription
router.post('/subscriptions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { planId, paymentMethodId, billingCycle = 'monthly' } = req.body;

    if (!planId) {
      return sendError(res, 'Plan ID is required', 400);
    }

    console.log(`POST /api/subscriptions: Creating subscription for user ${userId}, plan ${planId}`);

    // Check if user already has an active subscription
    const existingSubscription = await storage.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      return sendError(res, 'User already has an active subscription', 400);
    }

    // Get plan details
    const plan = await storage.getSubscriptionPlanById(planId);
    if (!plan) {
      return sendError(res, 'Invalid plan ID', 400);
    }

    // Create subscription
    const subscriptionData = {
      userId,
      planId: plan.id,
      planName: plan.name,
      status: 'active',
      billingCycle,
      amount: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice,
      currency: 'USD',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
      paymentMethodId: paymentMethodId || null,
      stripeSubscriptionId: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newSubscription = await storage.createSubscription(subscriptionData);

    console.log(`POST /api/subscriptions: Subscription created with ID ${newSubscription.id}`);
    return res.status(201).json(newSubscription);
  } catch (error) {
    console.error('Error creating subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to create subscription', 500);
  }
});

// Update subscription
router.put('/subscriptions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const subscriptionId = parseInt(req.params.id);
    const { planId, billingCycle, paymentMethodId } = req.body;

    if (isNaN(subscriptionId)) {
      return sendError(res, 'Invalid subscription ID', 400);
    }

    console.log(`PUT /api/subscriptions/${subscriptionId}: Updating subscription`);

    const existingSubscription = await storage.getSubscriptionById(subscriptionId);
    if (!existingSubscription) {
      return sendError(res, 'Subscription not found', 404);
    }

    if (existingSubscription.userId !== userId) {
      return sendError(res, 'Access denied to this subscription', 403);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (planId !== undefined) {
      const plan = await storage.getSubscriptionPlanById(planId);
      if (!plan) {
        return sendError(res, 'Invalid plan ID', 400);
      }
      updateData.planId = plan.id;
      updateData.planName = plan.name;
      updateData.amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    }
    
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (paymentMethodId !== undefined) updateData.paymentMethodId = paymentMethodId;

    const updatedSubscription = await storage.updateSubscription(subscriptionId, updateData);

    console.log(`PUT /api/subscriptions/${subscriptionId}: Subscription updated successfully`);
    return res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to update subscription', 500);
  }
});

// Cancel subscription
router.post('/subscriptions/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const subscriptionId = parseInt(req.params.id);
    const { cancelAtPeriodEnd = true, reason } = req.body;

    if (isNaN(subscriptionId)) {
      return sendError(res, 'Invalid subscription ID', 400);
    }

    console.log(`POST /api/subscriptions/${subscriptionId}/cancel: Canceling subscription`);

    const existingSubscription = await storage.getSubscriptionById(subscriptionId);
    if (!existingSubscription) {
      return sendError(res, 'Subscription not found', 404);
    }

    if (existingSubscription.userId !== userId) {
      return sendError(res, 'Access denied to this subscription', 403);
    }

    const updateData: any = {
      status: cancelAtPeriodEnd ? 'cancel_at_period_end' : 'canceled',
      canceledAt: new Date(),
      cancelReason: reason || null,
      updatedAt: new Date()
    };

    if (!cancelAtPeriodEnd) {
      updateData.currentPeriodEnd = new Date();
    }

    const canceledSubscription = await storage.updateSubscription(subscriptionId, updateData);

    console.log(`POST /api/subscriptions/${subscriptionId}/cancel: Subscription canceled successfully`);
    return res.json(canceledSubscription);
  } catch (error) {
    console.error('Error canceling subscription:', getErrorMessage(error));
    return sendError(res, 'Failed to cancel subscription', 500);
  }
});

// Get subscription usage
router.get('/subscriptions/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { period = 'current' } = req.query;

    console.log(`GET /api/subscriptions/usage: Fetching usage for user ${userId}, period ${period}`);

    const usage = await storage.getUserUsage(userId, period as string);

    console.log(`GET /api/subscriptions/usage: Usage data retrieved successfully`);
    return res.json(usage);
  } catch (error) {
    console.error('Error fetching usage data:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch usage data', 500);
  }
});

// Get billing history
router.get('/subscriptions/billing-history', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { limit = 10, offset = 0 } = req.query;

    console.log(`GET /api/subscriptions/billing-history: Fetching billing history for user ${userId}`);

    const billingHistory = await storage.getUserBillingHistory(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    console.log(`GET /api/subscriptions/billing-history: Found ${billingHistory.length} billing records`);
    return res.json(billingHistory);
  } catch (error) {
    console.error('Error fetching billing history:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch billing history', 500);
  }
});

// Process payment
router.post('/subscriptions/payments', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { subscriptionId, amount, paymentMethodId, description } = req.body;

    if (!subscriptionId || !amount || !paymentMethodId) {
      return sendError(res, 'Subscription ID, amount, and payment method are required', 400);
    }

    console.log(`POST /api/subscriptions/payments: Processing payment for user ${userId}`);

    // Verify subscription ownership
    const subscription = await storage.getSubscriptionById(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      return sendError(res, 'Invalid subscription', 400);
    }

    // Create payment record
    const paymentData = {
      userId,
      subscriptionId,
      amount: parseFloat(amount),
      currency: 'USD',
      paymentMethodId,
      description: description || 'Subscription payment',
      status: 'succeeded',
      stripePaymentIntentId: `pi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      processedAt: new Date(),
      createdAt: new Date()
    };

    const payment = await storage.createPayment(paymentData);

    // Update subscription if payment is successful
    if (payment.status === 'succeeded') {
      const nextPeriodEnd = new Date(subscription.currentPeriodEnd);
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + (subscription.billingCycle === 'yearly' ? 12 : 1));

      await storage.updateSubscription(subscriptionId, {
        currentPeriodStart: subscription.currentPeriodEnd,
        currentPeriodEnd: nextPeriodEnd,
        status: 'active',
        updatedAt: new Date()
      });
    }

    console.log(`POST /api/subscriptions/payments: Payment processed successfully with ID ${payment.id}`);
    return res.status(201).json(payment);
  } catch (error) {
    console.error('Error processing payment:', getErrorMessage(error));
    return sendError(res, 'Failed to process payment', 500);
  }
});

// Get payment methods
router.get('/subscriptions/payment-methods', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    console.log(`GET /api/subscriptions/payment-methods: Fetching payment methods for user ${userId}`);

    const paymentMethods = await storage.getUserPaymentMethods(userId);

    // Mask sensitive information
    const maskedMethods = paymentMethods.map(method => ({
      id: method.id,
      type: method.type,
      last4: method.last4,
      brand: method.brand,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      isDefault: method.isDefault,
      createdAt: method.createdAt
    }));

    console.log(`GET /api/subscriptions/payment-methods: Found ${maskedMethods.length} payment methods`);
    return res.json(maskedMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch payment methods', 500);
  }
});

// Add payment method
router.post('/subscriptions/payment-methods', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { stripePaymentMethodId, isDefault = false } = req.body;

    if (!stripePaymentMethodId) {
      return sendError(res, 'Stripe payment method ID is required', 400);
    }

    console.log(`POST /api/subscriptions/payment-methods: Adding payment method for user ${userId}`);

    // In a real implementation, you would validate the payment method with Stripe
    const paymentMethodData = {
      userId,
      stripePaymentMethodId,
      type: 'card',
      last4: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault,
      createdAt: new Date()
    };

    const paymentMethod = await storage.createPaymentMethod(paymentMethodData);

    // If this is set as default, update other methods
    if (isDefault) {
      await storage.updateUserPaymentMethods(userId, { isDefault: false });
      await storage.updatePaymentMethod(paymentMethod.id, { isDefault: true });
    }

    const responseMethod = {
      id: paymentMethod.id,
      type: paymentMethod.type,
      last4: paymentMethod.last4,
      brand: paymentMethod.brand,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt
    };

    console.log(`POST /api/subscriptions/payment-methods: Payment method added with ID ${paymentMethod.id}`);
    return res.status(201).json(responseMethod);
  } catch (error) {
    console.error('Error adding payment method:', getErrorMessage(error));
    return sendError(res, 'Failed to add payment method', 500);
  }
});

// Delete payment method
router.delete('/subscriptions/payment-methods/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const paymentMethodId = parseInt(req.params.id);

    if (isNaN(paymentMethodId)) {
      return sendError(res, 'Invalid payment method ID', 400);
    }

    console.log(`DELETE /api/subscriptions/payment-methods/${paymentMethodId}: Deleting payment method`);

    const paymentMethod = await storage.getPaymentMethodById(paymentMethodId);
    if (!paymentMethod) {
      return sendError(res, 'Payment method not found', 404);
    }

    if (paymentMethod.userId !== userId) {
      return sendError(res, 'Access denied to this payment method', 403);
    }

    await storage.deletePaymentMethod(paymentMethodId);

    console.log(`DELETE /api/subscriptions/payment-methods/${paymentMethodId}: Payment method deleted successfully`);
    return res.json({ message: 'Payment method deleted successfully', id: paymentMethodId });
  } catch (error) {
    console.error('Error deleting payment method:', getErrorMessage(error));
    return sendError(res, 'Failed to delete payment method', 500);
  }
});

export default router;