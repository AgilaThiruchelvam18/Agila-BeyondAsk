import { db } from "../postgresql";
import { subscriptionPlans, userSubscriptions, usageMetrics, agents, knowledgeBases, documents } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { StorageService } from "./storage_service";

export class SubscriptionService {
  private static instance: SubscriptionService;
  private storageService: StorageService;

  private constructor() {
    this.storageService = new StorageService();
  }

  public static getInstance(): SubscriptionService {
    if (!this.instance) {
      this.instance = new SubscriptionService();
    }
    return this.instance;
  }

  /**
   * Get all subscription plans
   */
  async getAllPlans() {
    try {
      const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder);
      return plans;
    } catch (error) {
      console.error("Error getting subscription plans:", error);
      throw error;
    }
  }

  /**
   * Get a specific subscription plan by ID
   */
  async getPlanById(planId: number) {
    try {
      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      return plan.length > 0 ? plan[0] : null;
    } catch (error) {
      console.error(`Error getting subscription plan with ID ${planId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific subscription plan by name
   */
  async getPlanByName(planName: string) {
    try {
      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, planName)).limit(1);
      return plan.length > 0 ? plan[0] : null;
    } catch (error) {
      console.error(`Error getting subscription plan with name ${planName}:`, error);
      throw error;
    }
  }

  /**
   * Get a user's active subscription
   */
  async getUserActiveSubscription(userId: number) {
    try {
      const now = new Date().toISOString();
      
      // Debug the query being executed
      console.log(`Getting active subscription for user ${userId} with status 'active' and valid end date`);
      
      // Use a more basic query to avoid any potential issues with column references
      const subscription = await db.select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        planId: userSubscriptions.planId,
        status: userSubscriptions.status,
        billingPeriod: userSubscriptions.billingPeriod,
        startDate: userSubscriptions.startDate,
        endDate: userSubscriptions.endDate,
        trialEndDate: userSubscriptions.trialEndDate,
        canceledAt: userSubscriptions.canceledAt,
        paymentProvider: userSubscriptions.paymentProvider,
        paymentProviderId: userSubscriptions.paymentProviderId,
        lastBillingDate: userSubscriptions.lastBillingDate,
        nextBillingDate: userSubscriptions.nextBillingDate,
        usageData: userSubscriptions.usageData,
        // Explicitly do not select metadata field as it's causing issues
        createdAt: userSubscriptions.createdAt,
        updatedAt: userSubscriptions.updatedAt
      })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, "active"),
          sql`(${userSubscriptions.endDate} IS NULL OR ${userSubscriptions.endDate}::timestamp >= ${now}::timestamp)`
        )
      )
      .limit(1);
      
      if (subscription.length === 0) {
        // Default to Starter plan if no active subscription
        const starterPlan = await this.getPlanByName("starter");
        return {
          plan: starterPlan,
          subscription: null,
        };
      }

      const plan = await this.getPlanById(subscription[0].planId);
      return {
        plan,
        subscription: subscription[0],
      };
    } catch (error) {
      console.error(`Error getting active subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(
    userId: number, 
    planId: number, 
    billingPeriod: 'monthly' | 'annual' = 'monthly',
    trialDays: number = 0,
    paymentProvider?: string,
    paymentProviderId?: string
  ) {
    try {
      const now = new Date();
      const startDate = now;
      
      // Calculate end date based on billing period
      const endDate = new Date(now);
      if (billingPeriod === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Calculate trial end date if applicable
      let trialEndDate = null;
      if (trialDays > 0) {
        trialEndDate = new Date(now);
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      }

      // Create values conforming to the table schema (use camelCase for Drizzle interface)
      const subscriptionValues = {
        userId: userId,
        planId: planId,
        status: trialDays > 0 ? "trial" : "active",
        billingPeriod: billingPeriod,
        startDate: startDate.toISOString().split('T')[0], // Convert Date to string for date column
        endDate: endDate.toISOString().split('T')[0], // Convert Date to string for date column
        trialEndDate: trialEndDate ? trialEndDate.toISOString().split('T')[0] : null,
        paymentProvider: paymentProvider,
        paymentProviderId: paymentProviderId,
        nextBillingDate: endDate.toISOString().split('T')[0], // Convert Date to string for date column
      };

      // Insert using the SQL adapter
      const subscription = await db.insert(userSubscriptions).values(subscriptionValues).returning();

      return subscription[0];
    } catch (error) {
      console.error(`Error creating subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update a user's subscription
   */
  async updateSubscription(subscriptionId: number, updateData: any) {
    try {
      const subscription = await db.update(userSubscriptions)
        .set(updateData)
        .where(eq(userSubscriptions.id, subscriptionId))
        .returning();
      
      return subscription[0];
    } catch (error) {
      console.error(`Error updating subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a user's subscription
   */
  async cancelSubscription(subscriptionId: number, immediate: boolean = false) {
    try {
      const now = new Date();
      let updateData: any = {
        status: immediate ? "canceled" : "active", // Only mark as canceled immediately if immediate=true
        canceledAt: now,
      };

      if (immediate) {
        updateData.endDate = now;
      }

      const subscription = await db.update(userSubscriptions)
        .set(updateData)
        .where(eq(userSubscriptions.id, subscriptionId))
        .returning();
      
      return subscription[0];
    } catch (error) {
      console.error(`Error canceling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a user is within their plan limits for a specific resource
   */
  async checkUserPlanLimits(userId: number, resourceType: 'agent' | 'knowledgeBase' | 'storage' | 'questions') {
    try {
      const { plan, subscription } = await this.getUserActiveSubscription(userId);
      if (!plan) {
        throw new Error("No active plan found");
      }

      // Get current usage counts
      let currentCount = 0;
      let limit = 0;

      switch (resourceType) {
        case 'agent':
          const agentCountResult = await db.select({
            count: sql`COUNT(*)`
          }).from(agents).where(eq(agents.userId, userId));
          currentCount = Number(agentCountResult[0]?.count) || 0;
          limit = plan.agentLimit;
          break;
        
        case 'knowledgeBase':
          const kbCountResult = await db.select({
            count: sql`COUNT(*)`
          }).from(knowledgeBases).where(eq(knowledgeBases.userId, userId));
          currentCount = Number(kbCountResult[0]?.count) || 0;
          limit = plan.knowledgeBaseLimit;
          break;
        
        case 'storage':
          // Calculate storage usage from documents
          const docs = await db.select({ fileSize: documents.fileSize }).from(documents).where(eq(documents.userId, userId));
          const storageUsed = docs.reduce((total, doc) => total + (doc.fileSize || 0), 0);
          currentCount = storageUsed;
          limit = plan.storageLimit;
          break;
        
        case 'questions':
          // Get questions asked this month
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          
          const questionMetrics = await db.select({
            value: sql`SUM(${usageMetrics.metricValue})`
          })
            .from(usageMetrics)
            .where(
              and(
                eq(usageMetrics.userId, userId),
                eq(usageMetrics.metricType, "questions_asked"),
                gte(usageMetrics.createdAt, firstDayOfMonth),
                lte(usageMetrics.createdAt, lastDayOfMonth)
              )
            );
          
          currentCount = Number(questionMetrics[0]?.value) || 0;
          limit = plan.monthlyQuestionLimit;
          break;
        
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }

      // Update usage data in subscription if available
      if (subscription && subscription.id) {
        try {
          // Safely handle usageData which might be undefined
          const usageData = typeof subscription.usageData === 'object' ? 
            { ...subscription.usageData } : {};
          
          switch (resourceType) {
            case 'agent':
              usageData.currentAgentCount = currentCount;
              break;
            case 'knowledgeBase':
              usageData.currentKbCount = currentCount;
              break;
            case 'storage':
              usageData.currentStorageUsed = currentCount;
              break;
            case 'questions':
              usageData.currentMonthQuestions = currentCount;
              break;
          }
          
          usageData.lastUpdated = new Date().toISOString();
          
          // Update the subscription with the new usage data
          console.log(`Updating usage data for subscription ${subscription.id}`);
          
          // Convert the usageData to a proper JSON string to avoid Date serialization issues
          await this.updateSubscription(subscription.id, { 
            usageData: JSON.parse(JSON.stringify(usageData)) 
          });
        } catch (updateError) {
          // Log the error but don't fail the entire operation
          console.error(`Error updating usage data for subscription ${subscription.id}:`, updateError);
          console.log("Continuing with plan limit check despite usage data update failure");
        }
      }

      return {
        isWithinLimits: currentCount < limit,
        currentUsage: currentCount,
        limit: limit,
        remainingUsage: Math.max(0, limit - currentCount),
        percentUsed: Math.min(100, Math.round((currentCount / limit) * 100)),
        planName: plan.name,
      };
    } catch (error) {
      console.error(`Error checking plan limits for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Record usage for a specific metric
   */
  async recordUsage(userId: number, metricType: string, metricValue: number) {
    try {
      const { subscription } = await this.getUserActiveSubscription(userId);
      if (!subscription) {
        console.warn(`No active subscription found for user ${userId}. Using default limits.`);
        return;
      }

      const now = new Date();
      
      // Ensure we have proper Date objects and handle potential undefined values safely
      let startDate: Date;
      let endDate: Date;
      
      // Safely handle potentially undefined start date
      if (subscription.startDate) {
        startDate = typeof subscription.startDate === 'string' 
          ? new Date(subscription.startDate)
          : subscription.startDate;
      } else {
        startDate = new Date(); // Default to current date if not available
      }
        
      // Safely handle potentially undefined end date 
      if (subscription.endDate) {
        endDate = typeof subscription.endDate === 'string' 
          ? new Date(subscription.endDate)
          : subscription.endDate;
      } else {
        // Default end date to 1 month from start date if not available
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
      }
      
      // Calculate billing period using our safe dates
      let periodStart = new Date(startDate);
      let periodEnd = new Date(endDate);

      // For date columns, we need to pass Date objects directly, not strings
      // Use camelCase naming that matches Drizzle schema interface
      await db.insert(usageMetrics).values({
        userId: userId,
        subscriptionId: subscription.id,
        metricType: metricType,
        metricValue: metricValue,
        periodStart: periodStart.toISOString().split('T')[0], // Convert Date to string for date column
        periodEnd: periodEnd.toISOString().split('T')[0], // Convert Date to string for date column
      });

      return true;
    } catch (error) {
      console.error(`Error recording usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize default subscription plans in the database
   */
  async initializeDefaultPlans() {
    try {
      // Check if plans already exist
      const existingPlans = await db.select().from(subscriptionPlans);
      if (existingPlans.length > 0) {
        console.log("Subscription plans already initialized");
        return existingPlans;
      }

      // Define the default plans based on pricing page
      const plans = [
        {
          name: "starter",
          displayName: "Starter",
          description: "Perfect for individuals and small projects",
          monthlyPrice: 900, // $9.00
          annualPrice: 700, // $7.00 per month when billed annually
          features: [
            "1 AI Agent",
            "3 Knowledge Bases",
            "100 MB Storage",
            "500 Questions/month",
            "Basic Analytics",
            "Community Support"
          ],
          agentLimit: 1,
          knowledgeBaseLimit: 3,
          storageLimit: 104857600, // 100 MB in bytes
          monthlyQuestionLimit: 500,
          includesAdvancedAnalytics: false,
          includesApiAccess: false,
          includesCustomDomains: false,
          includesWidgetEmbedding: false,
          includesSsoIntegration: false,
          includesCustomIntegrations: false,
          includesSlaGuarantee: false,
          supportLevel: "community",
          sortOrder: 1
        },
        {
          name: "professional",
          displayName: "Professional",
          description: "Ideal for small teams and growing businesses",
          monthlyPrice: 2900, // $29.00
          annualPrice: 2300, // $23.00 per month when billed annually
          features: [
            "5 AI Agents",
            "10 Knowledge Bases",
            "5 GB Storage",
            "5,000 Questions/month",
            "Advanced Analytics",
            "Priority Support",
            "Widget Embedding",
            "Custom Domains"
          ],
          agentLimit: 5,
          knowledgeBaseLimit: 10,
          storageLimit: 5368709120, // 5 GB in bytes
          monthlyQuestionLimit: 5000,
          includesAdvancedAnalytics: true,
          includesApiAccess: false,
          includesCustomDomains: true,
          includesWidgetEmbedding: true,
          includesSsoIntegration: false,
          includesCustomIntegrations: false,
          includesSlaGuarantee: false,
          supportLevel: "priority",
          sortOrder: 2
        },
        {
          name: "enterprise",
          displayName: "Enterprise",
          description: "For organizations with advanced needs",
          monthlyPrice: 9900, // $99.00
          annualPrice: 7900, // $79.00 per month when billed annually
          features: [
            "Unlimited AI Agents",
            "Unlimited Knowledge Bases",
            "50 GB Storage",
            "50,000 Questions/month",
            "Enterprise Analytics",
            "Dedicated Support",
            "API Access",
            "SSO & Advanced Security",
            "Custom Integrations",
            "SLA Guarantee"
          ],
          agentLimit: 9999, // Practically unlimited
          knowledgeBaseLimit: 9999, // Practically unlimited
          storageLimit: 53687091200, // 50 GB in bytes
          monthlyQuestionLimit: 50000,
          includesAdvancedAnalytics: true,
          includesApiAccess: true,
          includesCustomDomains: true,
          includesWidgetEmbedding: true,
          includesSsoIntegration: true,
          includesCustomIntegrations: true,
          includesSlaGuarantee: true,
          supportLevel: "dedicated",
          sortOrder: 3
        }
      ];

      // Insert default plans
      const insertedPlans = await db.insert(subscriptionPlans).values(plans).returning();
      console.log("Default subscription plans initialized");
      return insertedPlans;
    } catch (error) {
      console.error("Error initializing default subscription plans:", error);
      throw error;
    }
  }
}