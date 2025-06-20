import { documents } from "@shared/schema";
import { db } from "../postgresql";
import { eq } from "drizzle-orm";

export class StorageService {
  /**
   * Calculate total storage used by a user in bytes
   * @param userId User ID
   * @returns Total storage used in bytes
   */
  async calculateUserStorageUsage(userId: number): Promise<number> {
    try {
      // Get all documents for this user
      const docs = await db.select({ fileSize: documents.fileSize })
        .from(documents)
        .where(eq(documents.userId, userId));
      
      // Sum up file sizes
      const totalBytes = docs.reduce((total, doc) => total + (doc.fileSize || 0), 0);
      return totalBytes;
    } catch (error) {
      console.error(`Error calculating storage usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Format bytes to human-readable format
   * @param bytes Number of bytes
   * @param decimals Number of decimal places
   * @returns Formatted string (e.g., "1.5 MB")
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Convert a human-readable size string to bytes
   * @param sizeStr Size string (e.g., "1.5 MB")
   * @returns Number of bytes
   */
  convertToBytes(sizeStr: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'bytes': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
      'tb': 1024 * 1024 * 1024 * 1024,
      'pb': 1024 * 1024 * 1024 * 1024 * 1024
    };
    
    const matches = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
    if (!matches) {
      throw new Error(`Invalid size string format: ${sizeStr}`);
    }
    
    const value = parseFloat(matches[1]);
    const unit = matches[2];
    
    if (!(unit in units)) {
      throw new Error(`Unknown unit: ${unit}`);
    }
    
    return value * units[unit];
  }

  /**
   * Calculate storage metrics for a user
   * @param userId User ID
   * @param storageLimitBytes Storage limit in bytes from subscription plan
   * @returns Storage metrics
   */
  async getUserStorageMetrics(userId: number, storageLimitBytes: number): Promise<{
    isWithinLimits: boolean;
    currentUsageBytes: number;
    limitBytes: number;
    remainingBytes: number;
    percentUsed: number;
    currentUsageFormatted: string;
    limitFormatted: string;
    remainingFormatted: string;
  }> {
    try {
      const currentUsageBytes = await this.calculateUserStorageUsage(userId);
      const remainingBytes = Math.max(0, storageLimitBytes - currentUsageBytes);
      const percentUsed = Math.min(100, Math.round((currentUsageBytes / storageLimitBytes) * 100));
      
      return {
        isWithinLimits: currentUsageBytes < storageLimitBytes,
        currentUsageBytes,
        limitBytes: storageLimitBytes,
        remainingBytes,
        percentUsed,
        currentUsageFormatted: this.formatBytes(currentUsageBytes),
        limitFormatted: this.formatBytes(storageLimitBytes),
        remainingFormatted: this.formatBytes(remainingBytes)
      };
    } catch (error) {
      console.error(`Error getting storage metrics for user ${userId}:`, error);
      throw error;
    }
  }
}