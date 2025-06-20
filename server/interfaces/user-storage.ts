import {
  type User,
  type InsertUser
} from "@shared/schema";

/**
 * User Storage Interface
 * Defines all user-related database operations
 */
export interface IUserStorage {
  // User operations
  getUser(id: string | number): Promise<User | undefined>;
  getUserByAuthId(authId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string | number, user: Partial<User>): Promise<User | undefined>;
}