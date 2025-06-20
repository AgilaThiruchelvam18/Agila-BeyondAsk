import { Express } from "express";
import { 
  shouldServeReactApp, 
  createEnhancedViteMiddleware, 
  createSecureStaticMiddleware,
  startCacheCleanup 
} from "../middleware/vite-enhancements";

/**
 * Enhanced Vite configuration for production-ready setup
 */
export class ViteConfigManager {
  private cacheCleanupInterval?: NodeJS.Timeout;
  
  /**
   * Apply enhanced Vite middleware to Express app
   */
  public applyEnhancements(app: Express): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      // Development mode: Start cache cleanup
      this.cacheCleanupInterval = startCacheCleanup();
      console.log('[Vite Enhancement] Cache cleanup started for development');
    }
    
    // Apply secure static file middleware for production
    if (isProduction) {
      app.use(createSecureStaticMiddleware(''));
    }
    
    // Apply the enhanced Vite middleware for better route handling
    app.use(createEnhancedViteMiddleware());
    
    console.log(`[Vite Enhancement] Enhanced middleware applied for ${isProduction ? 'production' : 'development'}`);
  }
  
  /**
   * Cleanup resources on shutdown
   */
  public cleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      console.log('[Vite Enhancement] Cache cleanup stopped');
    }
  }
  
  /**
   * Check if a route should serve the React app
   */
  public static shouldServeReactApp(url: string): boolean {
    return shouldServeReactApp(url);
  }
}

// Export singleton instance
export const viteConfigManager = new ViteConfigManager();

// Export cleanup function for graceful shutdown
export function cleanupViteEnhancements(): void {
  viteConfigManager.cleanup();
}