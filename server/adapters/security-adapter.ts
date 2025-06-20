import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from '../postgresql';
import crypto from 'crypto';
import {
  Otp,
  InsertOtp,
  // Database tables
  otps,
} from '../../shared/schema';

/**
 * SecurityAdapter - Specialized adapter for security operations
 * Handles OTP operations, authentication tokens, and security logging
 */
export class SecurityAdapter {
  
  /**
   * Get OTP by ID
   */
  async getOtp(id: string): Promise<Otp | undefined> {
    const results = await db.select().from(otps).where(eq(otps.id, id)).limit(1);
    return results[0];
  }
  
  /**
   * Get most recent OTP by email
   */
  async getOtpByEmail(email: string): Promise<Otp | undefined> {
    // Return the most recent OTP for this email
    // Order by createdAt descending to get the newest OTP
    const results = await db.select()
      .from(otps)
      .where(eq(otps.email, email))
      .orderBy(desc(otps.createdAt))
      .limit(1);
    
    return results[0];
  }
  
  /**
   * Create new OTP
   */
  async createOtp(insertOtp: InsertOtp): Promise<Otp> {
    try {
      const otpData = {
        ...insertOtp,
        verified: false
      };
      
      const results = await db.insert(otps).values(otpData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw error;
    }
  }
  
  /**
   * Update OTP
   */
  async updateOtp(id: string, otpData: Partial<Otp>): Promise<Otp | undefined> {
    const results = await db.update(otps)
      .set(otpData)
      .where(eq(otps.id, id))
      .returning();
    return results[0];
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(email: string, code: string): Promise<{ success: boolean; otp?: Otp }> {
    try {
      const otp = await this.getOtpByEmail(email);
      
      if (!otp) {
        return { success: false };
      }

      // Check if OTP is expired (typically 10 minutes)
      const expirationTime = new Date(otp.createdAt.getTime() + 10 * 60 * 1000);
      if (new Date() > expirationTime) {
        return { success: false };
      }

      // Check if OTP code matches
      if (otp.code !== code) {
        return { success: false };
      }

      // Mark as verified
      const verifiedOtp = await this.updateOtp(otp.id, { verified: true });
      
      return { success: true, otp: verifiedOtp };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false };
    }
  }

  /**
   * Clean expired OTPs
   */
  async cleanExpiredOtps(): Promise<number> {
    try {
      // Delete OTPs older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const deletedOtps = await db.delete(otps)
        .where(lt(otps.createdAt, oneHourAgo))
        .returning();
      
      console.log(`Cleaned ${deletedOtps.length} expired OTPs`);
      return deletedOtps.length;
    } catch (error) {
      console.error('Error cleaning expired OTPs:', error);
      return 0;
    }
  }

  /**
   * Get OTP statistics
   */
  async getOtpStats(): Promise<{
    total: number;
    verified: number;
    pending: number;
    expired: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [totalResult, verifiedResult, pendingResult, expiredResult] = await Promise.all([
        db.select({ count: count() }).from(otps),
        db.select({ count: count() }).from(otps).where(eq(otps.verified, true)),
        db.select({ count: count() }).from(otps).where(
          and(eq(otps.verified, false), gt(otps.createdAt, oneHourAgo))
        ),
        db.select({ count: count() }).from(otps).where(
          and(eq(otps.verified, false), lt(otps.createdAt, oneHourAgo))
        )
      ]);

      return {
        total: totalResult[0]?.count || 0,
        verified: verifiedResult[0]?.count || 0,
        pending: pendingResult[0]?.count || 0,
        expired: expiredResult[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting OTP stats:', error);
      return { total: 0, verified: 0, pending: 0, expired: 0 };
    }
  }

  /**
   * Get recent OTPs for monitoring
   */
  async getRecentOtps(limit: number = 50): Promise<Otp[]> {
    try {
      const results = await db.select()
        .from(otps)
        .orderBy(desc(otps.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting recent OTPs:', error);
      return [];
    }
  }

  /**
   * Check if email has pending OTP
   */
  async hasPendingOtp(email: string): Promise<boolean> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const result = await db.select({ count: count() })
        .from(otps)
        .where(
          and(
            eq(otps.email, email),
            eq(otps.verified, false),
            gt(otps.createdAt, tenMinutesAgo)
          )
        );
      
      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('Error checking pending OTP:', error);
      return false;
    }
  }

  /**
   * Generate secure OTP code
   */
  generateOtpCode(length: number = 6): string {
    const digits = '0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    
    return result;
  }

  /**
   * Generate OTP with email rate limiting
   */
  async generateOtpForEmail(email: string): Promise<{ success: boolean; otp?: Otp; message?: string }> {
    try {
      // Check if email already has a pending OTP
      const hasPending = await this.hasPendingOtp(email);
      
      if (hasPending) {
        return { 
          success: false, 
          message: 'An OTP was already sent to this email. Please wait before requesting another.' 
        };
      }

      // Generate new OTP
      const code = this.generateOtpCode();
      const newOtp = await this.createOtp({
        id: crypto.randomUUID(),
        email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

      return { success: true, otp: newOtp };
    } catch (error) {
      console.error('Error generating OTP for email:', error);
      return { success: false, message: 'Failed to generate OTP' };
    }
  }
}