/**
 * OTP (One-Time Password) Service
 * 
 * This service manages the creation, storage, and verification of one-time passwords
 * for user authentication in the embeddable widget.
 */

import crypto from 'crypto';
import { Otp, InsertOtp, otps } from '@shared/schema';
import { db } from '../postgresql';
import { eq, and, lt, or, gt } from 'drizzle-orm';

// OTP length
const OTP_LENGTH = 6;

// OTP expiration time in minutes
const OTP_EXPIRY_MINUTES = 15;

/**
 * Generate a random numeric OTP
 * @returns Random OTP string
 */
function generateOtp(): string {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a new OTP for the given email
 * @param email - User email
 * @returns The generated OTP
 */
export async function createOtp(email: string): Promise<Otp> {
  try {
    // Generate a new OTP
    const code = generateOtp();
    
    // Set expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    
    // Create new OTP document
    const otpData: InsertOtp = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      code,
      expiresAt,
      verified: false
    };
    
    // Find existing OTP for this email and invalidate it
    await db.update(otps)
      .set({ verified: true })
      .where(eq(otps.email, email.toLowerCase()));
    
    // Insert the new OTP
    const result = await db.insert(otps).values(otpData).returning();
    
    // Return the created OTP
    return result[0];
  } catch (error) {
    console.error('Error creating OTP:', error);
    throw error;
  }
}

/**
 * Verify an OTP for the given email
 * @param email - User email
 * @param code - OTP code to verify
 * @returns Boolean indicating if the OTP is valid
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  try {
    // Get current time
    const now = new Date();
    
    // Find the OTP
    const otpResults = await db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.email, email.toLowerCase()),
          eq(otps.code, code),
          gt(otps.expiresAt, now),
          eq(otps.verified, false)
        )
      )
      .limit(1);
    
    if (otpResults.length === 0) {
      return false;
    }
    
    const otp = otpResults[0];
    
    // Mark the OTP as verified
    await db
      .update(otps)
      .set({ verified: true })
      .where(eq(otps.id, otp.id));
    
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
}

/**
 * Clean up expired OTPs
 * This should be called periodically to clean up the database
 */
export async function cleanupExpiredOtps(): Promise<void> {
  try {
    // Get current time
    const now = new Date();
    
    // Delete expired OTPs
    await db.delete(otps).where(
      or(
        lt(otps.expiresAt, now),
        eq(otps.verified, true)
      )
    );
    
    console.log('Cleaned up expired OTPs');
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
  }
}