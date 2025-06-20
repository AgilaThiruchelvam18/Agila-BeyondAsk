import { eq } from 'drizzle-orm';
import { BaseAdapter } from './base-adapter';
import { IUserStorage } from '../interfaces/user-storage';
import { users } from '../../shared/schema';
import { User, InsertUser } from '../../shared/schema';

/**
 * User Domain Adapter
 * Optimized user operations with proper error handling and validation
 */
export class UserAdapter extends BaseAdapter implements IUserStorage {

  async getUser(id: string | number): Promise<User | undefined> {
    return this.executeQuery(
      'getUser',
      async () => {
        const numericId = this.validateId(id);
        const results = await this.db.select().from(users).where(eq(users.id, numericId)).limit(1);
        return results[0];
      },
      { id }
    );
  }

  async getUserByAuthId(authId: string): Promise<User | undefined> {
    return this.executeQuery(
      'getUserByAuthId',
      async () => {
        if (!authId || typeof authId !== 'string') {
          throw new Error('Invalid authId provided');
        }
        const results = await this.db.select().from(users).where(eq(users.authId, authId)).limit(1);
        return results[0];
      },
      { authId }
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.executeQuery(
      'getUserByEmail',
      async () => {
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          throw new Error('Invalid email provided');
        }
        const results = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
        return results[0];
      },
      { email }
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.executeQuery(
      'createUser',
      async () => {
        // Validate required fields
        if (!insertUser.authId || !insertUser.email || !insertUser.name) {
          throw new Error('Missing required user fields: authId, email, and name are required');
        }

        // Check if user already exists
        const existingUser = await this.getUserByEmail(insertUser.email);
        if (existingUser) {
          throw new Error(`User with email ${insertUser.email} already exists`);
        }

        const userValues = {
          authId: insertUser.authId,
          email: insertUser.email,
          name: insertUser.name,
          picture: insertUser.picture || null,
        };

        const results = await this.db.insert(users).values(userValues).returning();
        return results[0];
      },
      { email: insertUser.email, name: insertUser.name }
    );
  }

  async updateUser(id: string | number, userData: Partial<User>): Promise<User | undefined> {
    return this.executeQuery(
      'updateUser',
      async () => {
        const numericId = this.validateId(id);
        
        // Check if user exists
        const existingUser = await this.getUser(numericId);
        if (!existingUser) {
          throw new Error(`User with ID ${numericId} not found`);
        }

        // If email is being updated, check for conflicts
        if (userData.email && userData.email !== existingUser.email) {
          const conflictingUser = await this.getUserByEmail(userData.email);
          if (conflictingUser && conflictingUser.id !== numericId) {
            throw new Error(`Email ${userData.email} is already in use by another user`);
          }
        }

        const results = await this.db.update(users)
          .set(userData)
          .where(eq(users.id, numericId))
          .returning();
        
        return results[0];
      },
      { id, updateFields: Object.keys(userData) }
    );
  }

  /**
   * Additional optimized user operations
   */
  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }
}