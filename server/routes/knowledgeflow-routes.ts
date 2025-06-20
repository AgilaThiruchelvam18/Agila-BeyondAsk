/**
 * Knowledge Flow Compatibility Routes
 * Legacy API compatibility for knowledgeflow endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { storage } from '../storage';
import { sendSuccess, sendError } from '../utils/response-helpers';

const router = Router();

// Get all knowledge flows for current user
router.get('/knowledgeflow/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    // Use the new visualizer board storage methods
    const boards = await storage.getVisualizerBoardsByUserId(Number(userId));
    return sendSuccess(res, boards);
  } catch (error) {
    console.error('Error fetching knowledge flows:', error);
    return sendError(res, 'Server error', 500);
  }
});

// Get a specific knowledge flow by ID
router.get('/knowledgeflow/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    
    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    if (isNaN(boardId)) {
      return sendError(res, 'Invalid board ID', 400);
    }

    const board = await storage.getVisualizerBoard(boardId);
    
    if (!board) {
      return sendError(res, 'Knowledge flow not found', 404);
    }

    // Check ownership
    if (board.userId !== Number(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, board);
  } catch (error) {
    console.error('Error fetching knowledge flow:', error);
    return sendError(res, 'Server error', 500);
  }
});

// Update a specific knowledge flow
router.put('/knowledgeflow/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    const { name, nodes, edges } = req.body;
    
    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    if (isNaN(boardId)) {
      return sendError(res, 'Invalid board ID', 400);
    }

    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return sendError(res, 'Knowledge flow not found', 404);
    }

    // Check ownership
    if (existingBoard.userId !== Number(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    const updatedBoard = await storage.updateVisualizerBoard(boardId, {
      name: name || existingBoard.name,
      nodes: nodes || existingBoard.nodes,
      edges: edges || existingBoard.edges
    });

    return sendSuccess(res, updatedBoard);
  } catch (error) {
    console.error('Error updating knowledge flow:', error);
    return sendError(res, 'Server error', 500);
  }
});

// Delete a specific knowledge flow
router.delete('/knowledgeflow/:id(\\d+)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const boardId = parseInt(req.params.id);
    
    if (!userId) {
      return sendError(res, 'User not authenticated', 401);
    }

    if (isNaN(boardId)) {
      return sendError(res, 'Invalid board ID', 400);
    }

    const existingBoard = await storage.getVisualizerBoard(boardId);
    
    if (!existingBoard) {
      return sendError(res, 'Knowledge flow not found', 404);
    }

    // Check ownership
    if (existingBoard.userId !== Number(userId)) {
      return sendError(res, 'Access denied', 403);
    }

    await storage.deleteVisualizerBoard(boardId);
    return sendSuccess(res, { message: 'Knowledge flow deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge flow:', error);
    return sendError(res, 'Server error', 500);
  }
});

export default router;