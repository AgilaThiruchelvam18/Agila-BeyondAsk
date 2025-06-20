import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/api-key-service';
import { storage } from '../storage';
import { TokenBucket } from 'limiter';

// Extend Express Request type to include user property with all needed fields
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        authId?: string;
        email?: string;
        apiKey?: any;
      };
    }
  }
}

// Rate limiting cache - stores rate limiters for each API key
const rateLimiters = new Map<number, TokenBucket>();

/**
 * Middleware to authenticate using API keys
 * Expects the API key in the Authorization header as "Bearer <api-key>" or X-API-Key header
 */
export function apiKeyAuth(requiredScopes: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if already authenticated via session
      if (req.user) {
        return next();
      }

      // Initialize API key service with current storage context
      const apiKeyService = new ApiKeyService(storage as any);

      // Extract API key from Authorization header
      let apiKey: string | null = null;
      
      // Check Authorization header (Bearer token format)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
      
      // Check X-API-Key header as fallback
      if (!apiKey && req.headers['x-api-key']) {
        apiKey = req.headers['x-api-key'] as string;
      }
      
      // No API key provided
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }
      
      // Verify the API key
      const verifiedKey = await apiKeyService.verifyApiKey(apiKey);
      if (!verifiedKey) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      // Check if key has required scope
      if (requiredScopes.length > 0 && 
          (!verifiedKey.scopes || 
           !requiredScopes.every(scope => verifiedKey.scopes?.includes(scope)))) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          requiredScopes
        });
      }
      
      // Apply rate limiting if configured
      if (verifiedKey.rateLimit && verifiedKey.rateLimit > 0) {
        // Initialize rate limiter for this API key if it doesn't exist
        if (!rateLimiters.has(verifiedKey.id)) {
          // Create a new token bucket: X tokens per minute (X = rateLimit)
          const limiter = new TokenBucket({
            tokensPerInterval: verifiedKey.rateLimit,
            interval: 'minute',
            bucketSize: verifiedKey.rateLimit
          });
          rateLimiters.set(verifiedKey.id, limiter);
        }
        
        const limiter = rateLimiters.get(verifiedKey.id)!;
        const hasToken = limiter.tryRemoveTokens(1);
        
        if (!hasToken) {
          return res.status(429).json({ 
            error: 'Rate limit exceeded',
            rateLimit: verifiedKey.rateLimit,
            resetInMs: limiter.tokensPerInterval
          });
        }
      }
      
      // Attach API key information to the request
      req.apiKey = verifiedKey;
      
      // If API key belongs to a user, set user on the request
      if (verifiedKey.userId) {
        const user = await storage.getUser(verifiedKey.userId);
        if (user) {
          // Set the user ID in the format expected by the rest of the application
          // Convert ID to string to match the expected type in some places
          req.user = { 
            id: parseInt(user.id.toString()), // Convert to string for type compatibility
            authId: user.authId,
            email: user.email
          };
        }
      }
      
      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      apiKey?: any;
      // Note: user is already defined in routes.ts with a different type
      // We need to make sure they're compatible
    }
  }
}