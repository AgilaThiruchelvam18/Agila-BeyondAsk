import { db } from '../postgresql';

/**
 * Base Adapter Class
 * Provides common utilities and patterns for all domain adapters
 */
export abstract class BaseAdapter {
  protected db = db;

  /**
   * Convert string or number ID to numeric ID
   */
  protected toNumericId(id: string | number): number {
    return typeof id === 'string' ? parseInt(id, 10) : id;
  }

  /**
   * Validate numeric ID
   */
  protected validateId(id: string | number): number {
    const numericId = this.toNumericId(id);
    if (isNaN(numericId) || numericId <= 0) {
      throw new Error(`Invalid ID: ${id}`);
    }
    return numericId;
  }

  /**
   * Log operation with consistent format
   */
  protected log(operation: string, details: any = {}) {
    console.log(`[${this.constructor.name}] ${operation}:`, details);
  }

  /**
   * Handle errors with consistent logging and re-throwing
   */
  protected handleError(operation: string, error: any, context: any = {}): never {
    console.error(`[${this.constructor.name}] ${operation} failed:`, {
      error: error.message || error,
      context,
      stack: error.stack
    });
    throw error;
  }

  /**
   * Execute query with error handling and logging
   */
  protected async executeQuery<T>(
    operation: string,
    queryFn: () => Promise<T>,
    context: any = {}
  ): Promise<T> {
    try {
      this.log(operation, context);
      const result = await queryFn();
      this.log(`${operation} completed`, { resultCount: Array.isArray(result) ? result.length : 'single' });
      return result;
    } catch (error) {
      this.handleError(operation, error, context);
    }
  }
}