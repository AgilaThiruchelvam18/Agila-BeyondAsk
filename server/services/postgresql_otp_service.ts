/**
 * PostgreSQL OTP (One-Time Password) Service
 * 
 * This service manages the creation, storage, and verification of one-time passwords
 * for user authentication in the embeddable widget, using PostgreSQL storage.
 */

import crypto from 'crypto';
import { storage } from '../storage';
import { Otp, InsertOtp } from '@shared/schema';

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
    console.log(`Creating new OTP for email: ${email}`);
    
    // Generate a new OTP
    const code = generateOtp();
    
    // Set expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    
    // Generate a unique ID for the OTP
    const id = crypto.randomUUID();
    
    console.log(`Generated OTP: ${code} for ${email}, expires at ${expiresAt.toISOString()}`);
    
    // Create new OTP document
    const otpData: InsertOtp & { id: string } = {
      id,
      email: email.toLowerCase(),
      code,
      expiresAt,
      verified: false
    };
    
    // Get existing OTP for this email
    const existingOtp = await storage.getOtpByEmail(email.toLowerCase());
    
    // If an existing OTP is found, mark it as verified (invalidated)
    if (existingOtp) {
      console.log(`Found existing OTP for ${email}, invalidating it: id=${existingOtp.id}, code=${existingOtp.code}`);
      await storage.updateOtp(existingOtp.id, { verified: true });
    } else {
      console.log(`No existing OTP found for ${email}`);
    }
    
    // Create the new OTP using the storage interface
    const newOtp = await storage.createOtp(otpData);
    console.log(`Created new OTP in database for ${email}: id=${newOtp.id}`);
    
    return newOtp;
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
    
    console.log(`Verifying OTP for email: ${email}`);
    
    // Get existing OTP for this email
    const existingOtp = await storage.getOtpByEmail(email.toLowerCase());
    
    if (!existingOtp) {
      console.log(`No OTP found for email: ${email}`);
      return false;
    }
    
    console.log(`Found OTP for ${email}: code=${existingOtp.code}, verified=${existingOtp.verified}, expires=${existingOtp.expiresAt.toISOString()}, now=${now.toISOString()}`);
    
    // Validate the OTP
    if (existingOtp.code !== code) {
      console.log(`OTP code mismatch for ${email}: expected=${existingOtp.code}, received=${code}`);
      return false;
    }
    
    if (existingOtp.verified) {
      console.log(`OTP for ${email} has already been verified`);
      return false;
    }
    
    if (existingOtp.expiresAt < now) {
      console.log(`OTP for ${email} has expired: expiresAt=${existingOtp.expiresAt.toISOString()}, now=${now.toISOString()}`);
      return false;
    }
    
    console.log(`OTP for ${email} is valid, marking as verified`);
    
    // Mark the OTP as verified
    await storage.updateOtp(existingOtp.id, { verified: true });
    
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
}

/**
 * Clean up expired OTPs
 * This should be called periodically to clean up the database
 * 
 * Note: This currently does not have an implementation for PostgreSQL
 * as it would require a direct query or a stored procedure.
 * Will need to be implemented as a database migration or API endpoint.
 */
export async function cleanupExpiredOtps(): Promise<void> {
  try {
    console.log('Cleanup of expired OTPs is not implemented for PostgreSQL yet');
    // Future implementation would be a database-level operation
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
  }
}