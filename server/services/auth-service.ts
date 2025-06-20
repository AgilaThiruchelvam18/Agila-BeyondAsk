import { storage } from '../storage';

/**
 * Get a user by their Auth0 ID 
 * @param authId Auth0 user ID
 * @returns User object or undefined if not found
 */
export async function getUserByAuthId(authId: string) {
  try {
    return await storage.getUserByAuthId(authId);
  } catch (error) {
    console.error('Error fetching user by auth ID:', error);
    return undefined;
  }
}