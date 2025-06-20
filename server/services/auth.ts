import { storage } from "../storage";

// JWT token verification interface
interface DecodedToken {
  sub: string;         // Auth0 user ID
  email: string;
  name: string;
  picture?: string;
  exp: number;         // Expiration timestamp
  iat: number;         // Issued at timestamp
  iss: string;         // Issuer
  aud: string;         // Audience
}

/**
 * Verify JWT token from Auth0
 * This is a placeholder for actual JWT verification
 * In a real implementation, you would use a library like jsonwebtoken or jose
 * @param {string} token - JWT token to verify
 * @returns {Promise<DecodedToken>} Decoded token payload
 */
export async function verifyToken(token: string): Promise<DecodedToken> {
  try {
    // In a real implementation, you would verify the JWT signature
    // For now, we'll simply decode the token
    console.log("token===>",token)
    // Extract the payload (second part of the JWT)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format: token does not have 3 parts');
      throw new Error('Invalid token format');
    }
    
    // Decode base64
    let payload;
    try {
      // Handle base64url format (JWT uses base64url, not standard base64)
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      
      payload = JSON.parse(
        Buffer.from(paddedBase64, 'base64').toString()
      );
      
      console.log('Decoded payload:', JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to decode token payload:', e);
      throw new Error('Invalid token payload');
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log(`Token expired: expired at ${new Date(payload.exp * 1000).toISOString()}, current time is ${new Date().toISOString()}`);
      throw new Error('Token expired');
    }
    
    // Check required fields
    if (!payload.sub) {
      console.error('Missing subject in token payload:', payload);
      throw new Error('Missing subject in token');
    }
    
    return payload as DecodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid token');
  }
}

/**
 * Get or create user from Auth0 token
 * @param {DecodedToken} decodedToken - Decoded Auth0 token
 * @returns {Promise<number>} User ID in the system
 */
export async function getOrCreateUserFromToken(decodedToken: DecodedToken): Promise<number> {
  try {
    // Try to find existing user by Auth0 ID
    const existingUser = await storage.getUserByAuthId(decodedToken.sub);
    
    if (existingUser) {
      return existingUser.id;
    }
    
    // Create new user if not found
    const newUser = await storage.createUser({
      authId: decodedToken.sub,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    });
    
    return newUser.id;
  } catch (error) {
    console.error('Error getting or creating user:', error);
    throw new Error('Failed to process user authentication');
  }
}
