/**
 * Miscellaneous Routes
 * Handles unanswered questions, sales content, test endpoints, and widget.js
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { storage } from '../storage';

const router = Router();

// Get unanswered questions
router.get('/unanswered-questions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 0;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const questions = await storage.getUnansweredQuestionsByUserId(userId);
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unanswered questions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create sales content
router.post('/sales-content', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || '0';
    const { content, title, type } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    if (!content || !title) {
      return res.status(400).json({
        success: false,
        error: 'Content and title are required'
      });
    }

    // Sales content creation logic would go here
    const salesContent = {
      id: Date.now(), // Temporary ID generation
      title,
      content,
      type: type || 'general',
      userId,
      createdAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: salesContent
    });
  } catch (error) {
    console.error('Error creating sales content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sales content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test widget authentication
router.get('/test/widget-auth', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token parameter is required'
      });
    }

    // Widget auth test logic
    res.json({
      success: true,
      data: {
        token: token as string,
        valid: true,
        testMode: true
      }
    });
  } catch (error) {
    console.error('Error testing widget auth:', error);
    res.status(500).json({
      success: false,
      error: 'Widget auth test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test token tracking - GET
router.get('/test/token-tracking', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        endpoint: 'token-tracking-test',
        method: 'GET',
        timestamp: new Date().toISOString(),
        testMode: true
      }
    });
  } catch (error) {
    console.error('Error in token tracking test:', error);
    res.status(500).json({
      success: false,
      error: 'Token tracking test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test token tracking - POST
router.post('/test/token-tracking', async (req: Request, res: Response) => {
  try {
    const { tokens, metadata } = req.body;

    res.json({
      success: true,
      data: {
        endpoint: 'token-tracking-test',
        method: 'POST',
        tokens: tokens || [],
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        testMode: true
      }
    });
  } catch (error) {
    console.error('Error in token tracking test:', error);
    res.status(500).json({
      success: false,
      error: 'Token tracking test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Widget.js static file route
router.get('/widget.js', (_req: Request, res: Response) => {
  try {
    const widgetScript = `
// AI Assistant Widget JavaScript
(function() {
  'use strict';
  
  console.log('AI Assistant Widget loaded');
  
  // Widget initialization code would go here
  window.AIAssistantWidget = {
    init: function(config) {
      console.log('AI Assistant Widget initialized with config:', config);
    },
    version: '1.0.0'
  };
})();
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(widgetScript);
  } catch (error) {
    console.error('Error serving widget.js:', error);
    res.status(500).send('// Error loading widget');
  }
});

export default router;