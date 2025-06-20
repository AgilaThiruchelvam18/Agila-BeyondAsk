import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Cache for file modification times to avoid repeated file system calls
const fileStatsCache = new Map<string, { mtime: number, etag: string, content?: string }>();

/**
 * Generate ETag for content-based caching
 */
function generateETag(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Enhanced route filter for better API/frontend separation
 */
export function shouldServeReactApp(url: string): boolean {
  // Skip API routes and static assets
  if (url.startsWith('/api/') || 
      url.startsWith('/health') || 
      url.startsWith('/swagger') ||
      url.startsWith('/_vite/') ||
      url.startsWith('/node_modules/') ||
      url.includes('.js') ||
      url.includes('.css') ||
      url.includes('.ico') ||
      url.includes('.png') ||
      url.includes('.jpg') ||
      url.includes('.svg') ||
      url.includes('.woff') ||
      url.includes('.map')) {
    return false;
  }
  
  return true;
}

/**
 * Enhanced cache busting using file modification time
 */
export async function getTemplateWithCacheBusting(
  templatePath: string,
  isProduction: boolean = false
): Promise<{ template: string; etag: string; version: string }> {
  const fileStats = await fs.promises.stat(templatePath);
  const currentMtime = fileStats.mtime.getTime();
  
  // Check cache first
  let cachedStats = fileStatsCache.get(templatePath);
  let template: string;
  let etag: string;
  
  if (cachedStats && cachedStats.mtime === currentMtime && isProduction && cachedStats.content) {
    // Use cached content in production
    template = cachedStats.content;
    etag = cachedStats.etag;
  } else {
    // Read file and generate new ETag
    template = await fs.promises.readFile(templatePath, "utf-8");
    etag = generateETag(template);
    
    // Cache the stats and content
    fileStatsCache.set(templatePath, { 
      mtime: currentMtime, 
      etag,
      content: isProduction ? template : undefined // Only cache content in production
    });
  }

  // Use file modification time for cache busting instead of random ID
  const version = isProduction ? currentMtime.toString() : Date.now().toString();
  
  return { template, etag, version };
}

/**
 * Set appropriate caching headers based on environment
 */
export function setCachingHeaders(res: Response, etag: string, isProduction: boolean): void {
  res.set({
    'Content-Type': 'text/html',
    'ETag': etag,
    'Cache-Control': isProduction 
      ? 'public, max-age=300, must-revalidate' // 5 minutes in production
      : 'no-cache', // No cache in development
    'X-Content-Type-Options': 'nosniff', // Security header
    'X-Frame-Options': 'DENY', // Security header
    'X-XSS-Protection': '1; mode=block' // Security header
  });
}

/**
 * Check if client has current version using ETag
 */
export function checkClientCache(req: Request, etag: string): boolean {
  return req.headers['if-none-match'] === etag;
}

/**
 * Enhanced error logging with better context
 */
export function logViteError(error: Error, context: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.error(`[Vite Enhancement Error] ${context}:`, {
    message: error.message,
    stack: isProduction ? 'Stack trace hidden in production' : error.stack,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(reason: string): Promise<void> {
  console.error(`[Vite Enhancement] Initiating graceful shutdown: ${reason}`);
  
  // Clear file cache
  fileStatsCache.clear();
  
  // Give ongoing requests time to complete
  const shutdownTimeout = setTimeout(() => {
    console.error('[Vite Enhancement] Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
  
  // Clean up timeout if we exit gracefully
  clearTimeout(shutdownTimeout);
  process.exit(1);
}

/**
 * Enhanced Vite middleware wrapper
 */
export function createEnhancedViteMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const url = req.originalUrl;

    // Use enhanced route filtering
    if (!shouldServeReactApp(url)) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "index.html",
      );

      // Enhanced cache busting and ETag handling
      const { template, etag, version } = await getTemplateWithCacheBusting(clientTemplate, isProduction);
      
      // Check if client has current version
      if (checkClientCache(req, etag)) {
        res.status(304).end();
        return;
      }

      // Apply cache busting to the template
      const enhancedTemplate = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${version}`
      );
      
      // Set enhanced caching headers
      setCachingHeaders(res, etag, isProduction);
      
      res.status(200).end(enhancedTemplate);
    } catch (error) {
      logViteError(error as Error, 'Enhanced Vite middleware');
      next(error);
    }
  };
}

/**
 * Production-ready static file serving with security headers
 */
export function createSecureStaticMiddleware(distPath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Add security headers for static files
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'public, max-age=31536000, immutable' // 1 year for static assets
    });
    
    next();
  };
}

/**
 * Clean up file cache periodically to prevent memory leaks
 */
export function startCacheCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    fileStatsCache.forEach((stats, path) => {
      if (now - stats.mtime > maxAge) {
        fileStatsCache.delete(path);
      }
    });
  }, 60000); // Clean every minute
}