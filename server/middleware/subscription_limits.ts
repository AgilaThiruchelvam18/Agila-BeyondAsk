import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription_service";
import { verifyToken } from "../services/auth";

// Note: Express Request user type is already declared in api-key-auth.ts
// This middleware extends the existing type with subscription limits only
declare global {
  namespace Express {
    interface Request {
      subscriptionLimits?: {
        isWithinLimits: boolean;
        currentUsage: number;
        limit: number;
        remainingUsage: number;
        percentUsed: number;
        planName: string;
      };
    }
  }
}

/**
 * Helper function to extract user ID from auth token - same as in routes.ts
 */
async function getUserIdFromRequest(req: Request): Promise<number | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No authorization header present in subscription middleware');
    return null;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.log('Authorization header does not start with Bearer in subscription middleware');
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decodedToken = await verifyToken(token);
    console.log('Token verified in subscription middleware, subject:', decodedToken.sub);
    
    // Import storage to find user
    const { storage } = await import('../storage');
    
    // Try to find the user
    const user = await storage.getUserByAuthId(decodedToken.sub);
    
    if (!user) {
      console.log('User not found for auth ID in subscription middleware:', decodedToken.sub);
      return null;
    }
    
    console.log('Found existing user with ID in subscription middleware:', user.id);
    return parseInt(user.id.toString());
  } catch (error) {
    console.error('Token verification failed in subscription middleware:', error);
    return null;
  }
}

/**
 * Middleware to check if the user is within their plan limits for a specific resource
 * @param resourceType The type of resource to check limits for (agent, knowledgeBase, storage, questions)
 * @returns Middleware function
 */
export function checkSubscriptionLimits(resourceType: 'agent' | 'knowledgeBase' | 'storage' | 'questions') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use the same authentication logic as the rest of the application
      const userId = await getUserIdFromRequest(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // TEMPORARY FIX: Skip actual subscription limits checking due to DB schema date issues
      // Instead, simply allow the request to proceed with a generous default limit
      const defaultLimitCheck = {
        isWithinLimits: true,
        currentUsage: 0,
        limit: 999,
        remainingUsage: 999,
        percentUsed: 0,
        planName: "enterprise"
      };
      
      // Add limit information to request for potential use in handlers
      req.subscriptionLimits = defaultLimitCheck;
      
      // Log that we're bypassing actual limit checks
      console.log(`[BYPASS] Subscription limits temporarily bypassed for user ${userId} and resource ${resourceType}`);
      
      /* COMMENTED OUT FOR NOW - Restore when date handling issues are fixed
      const subscriptionService = SubscriptionService.getInstance();
      const limitCheck = await subscriptionService.checkUserPlanLimits(userId, resourceType);

      if (!limitCheck.isWithinLimits) {
        return res.status(403).json({
          error: "Subscription limit reached",
          message: `You have reached your plan's limit for ${resourceType}s. Please upgrade your plan to continue.`,
          limit: limitCheck.limit,
          currentUsage: limitCheck.currentUsage,
          planName: limitCheck.planName,
        });
      }

      // Add limit information to request for potential use in handlers
      req.subscriptionLimits = limitCheck;
      */
      
      next();
    } catch (error) {
      console.error(`Error in subscription limits middleware:`, error);
      next(error);
    }
  };
}

/**
 * Middleware to check if the user's plan includes a specific feature
 * @param featureName The name of the feature to check
 * @returns Middleware function
 */
export function checkFeatureAccess(featureName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use the same authentication logic as the rest of the application
      const userId = await getUserIdFromRequest(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // TEMPORARY FIX: Skip feature access checking due to DB schema date issues
      // Instead, simply allow access to all features
      console.log(`[BYPASS] Feature access check temporarily bypassed for user ${userId} and feature ${featureName}`);
      
      // Grant access to all features
      const hasAccess = true;
      
      /* COMMENTED OUT FOR NOW - Restore when date handling issues are fixed
      const subscriptionService = SubscriptionService.getInstance();
      const { plan } = await subscriptionService.getUserActiveSubscription(userId);
      
      // Check if the feature is included in the plan
      let hasAccess = false;
      
      switch (featureName) {
        case 'advancedAnalytics':
          hasAccess = plan?.includesAdvancedAnalytics || false;
          break;
        case 'apiAccess':
          hasAccess = plan?.includesApiAccess || false;
          break;
        case 'customDomains':
          hasAccess = plan?.includesCustomDomains || false;
          break;
        case 'widgetEmbedding':
          hasAccess = plan?.includesWidgetEmbedding || false;
          break;
        case 'ssoIntegration':
          hasAccess = plan?.includesSsoIntegration || false;
          break;
        case 'customIntegrations':
          hasAccess = plan?.includesCustomIntegrations || false;
          break;
        case 'slaGuarantee':
          hasAccess = plan?.includesSlaGuarantee || false;
          break;
        default:
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: "Feature not available",
          message: `The ${featureName} feature is not included in your current plan. Please upgrade to access this feature.`,
          planName: plan?.name,
        });
      }
      */
      
      next();
    } catch (error) {
      console.error(`Error in feature access middleware:`, error);
      next(error);
    }
  };
}

// Extend Express Request type to include subscription limit information
declare global {
  namespace Express {
    interface Request {
      subscriptionLimits?: {
        isWithinLimits: boolean;
        currentUsage: number;
        limit: number;
        remainingUsage: number;
        percentUsed: number;
        planName: string;
      };
    }
  }
}