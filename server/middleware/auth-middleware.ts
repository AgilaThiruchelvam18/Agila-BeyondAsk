/**
 * Authentication Middleware
 * JWT token validation and user extraction
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { sendUnauthorized } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { verifyToken } from '../services/auth';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Extract and verify JWT token from request headers
 */
export async function authenticateToken(
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      sendUnauthorized(res, 'Invalid token format');
      return;
    }

    // Use the same verifyToken function as legacy routes for compatibility
    let decodedToken: any;
    try {
      decodedToken = await verifyToken(token);
      
      if (!decodedToken) {
        sendUnauthorized(res, 'Token verification returned null');
        return;
      }
      
      if (!decodedToken.sub) {
        sendUnauthorized(res, 'Invalid token payload: missing subject');
        return;
      }
      
      console.log('Token verified successfully, subject:', decodedToken.sub);
    } catch (error) {
      console.error('Token verification failed:', error);
      sendUnauthorized(res, 'Token verification failed');
      return;
    }

    // Find user by Auth0 subject ID
    let user = await storage.getUserByAuthId(decodedToken.sub);

    if (!user) {
      // Try to create user if not found (same as legacy system)
      try {
        console.log('User not found for auth ID:', decodedToken.sub);
        console.log('Fetching user info from Auth0');
        
        const auth0Domain = process.env.VITE_AUTH0_DOMAIN;
        const userInfoResponse = await fetch(`https://${auth0Domain}/userinfo`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          console.log('Retrieved user info from Auth0:', JSON.stringify(userInfo));
          
          const newUser = await storage.createUser({
            authId: decodedToken.sub,
            email: userInfo.email || `user-${decodedToken.sub}@example.com`,
            name: userInfo.name || `User ${decodedToken.sub.slice(-6)}`,
            picture: userInfo.picture,
          });
          
          console.log('New user created with ID:', newUser.id);
          user = newUser;
        } else {
          throw new Error(`Failed to fetch user info: ${userInfoResponse.statusText}`);
        }
      } catch (createError) {
        console.error('Failed to create user:', createError);
        sendUnauthorized(res, 'User not found');
        return;
      }
    }

    console.log('Found existing user with ID:', user.id);

    // Attach user to request
    req.user = {
      id: Number(user.id),
      authId: user.authId,
      email: user.email || '',
      name: user.name || undefined,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', getErrorMessage(error));
    sendUnauthorized(res, 'Authentication failed');
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      next();
      return;
    }

    // Try to authenticate, but don't fail if it doesn't work
    await authenticateToken(req, res, (error?: any) => {
      if (error) {
        // Authentication failed, but continue without user
        req.user = undefined;
      }
      next();
    });
  } catch (error) {
    // Authentication failed, but continue without user
    req.user = undefined;
    next();
  }
}

/**
 * Admin authentication middleware
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authenticateToken(req, res, (error?: any) => {
      if (error || !req.user) {
        return;
      }

      // Check if user is admin (implement your admin logic here)
      // For now, just check if user ID is 1 (example)
      if (req.user.id !== 1) {
        sendUnauthorized(res, 'Admin access required');
        return;
      }

      next();
    });
  } catch (error) {
    sendUnauthorized(res, 'Admin authentication failed');
  }
}

// Export alias for backward compatibility
export const verifyUser = authenticateToken;