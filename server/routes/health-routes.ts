/**
 * Health Check Routes
 * Simple endpoints for monitoring server status
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/health', (req: Request, res: Response): Response => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
  };

  return res.json(healthStatus);
});

/**
 * Detailed system status
 */
router.get('/status', (req: Request, res: Response): Response => {
  const systemStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    },
    version: process.version,
  };

  return res.json(systemStatus);
});

export default router;