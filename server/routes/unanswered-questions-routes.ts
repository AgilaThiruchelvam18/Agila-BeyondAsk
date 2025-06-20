/**
 * Unanswered Questions Management Routes
 * Handles questions that couldn't be answered confidently by the AI system
 * Returns exact same format as legacy API for backward compatibility
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { UnansweredQuestionsService } from '../services/unanswered_questions_service';

const router = Router();

// Get all unanswered questions for the user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const questions = await UnansweredQuestionsService.getUnansweredQuestionsByUserId(userId);
    return res.json(questions);
  } catch (error) {
    console.error("Error getting unanswered questions:", error);
    return res.status(500).json({ error: "Failed to retrieve unanswered questions" });
  }
});

// Get all unanswered questions for an agent
router.get('/agent/:agentId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const agentId = parseInt(req.params.agentId);
    if (isNaN(agentId)) {
      return res.status(400).json({ error: "Invalid agent ID" });
    }

    const questions = await UnansweredQuestionsService.getUnansweredQuestionsByAgentId(agentId);
    return res.json(questions);
  } catch (error) {
    console.error("Error getting unanswered questions for agent:", error);
    return res.status(500).json({ error: "Failed to retrieve unanswered questions" });
  }
});

// Get all unanswered questions for a knowledge base
router.get('/knowledge-base/:knowledgeBaseId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const knowledgeBaseId = parseInt(req.params.knowledgeBaseId);
    if (isNaN(knowledgeBaseId)) {
      return res.status(400).json({ error: "Invalid knowledge base ID" });
    }

    const questions = await UnansweredQuestionsService.getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId);
    return res.json(questions);
  } catch (error) {
    console.error("Error getting unanswered questions for knowledge base:", error);
    return res.status(500).json({ error: "Failed to retrieve unanswered questions" });
  }
});

// Get all unanswered questions with a specific status
router.get('/status/:status', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const status = req.params.status;
    if (!status || !["pending", "addressed", "ignored"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const questions = await UnansweredQuestionsService.getUnansweredQuestionsByStatus(status);
    return res.json(questions);
  } catch (error) {
    console.error("Error getting unanswered questions by status:", error);
    return res.status(500).json({ error: "Failed to retrieve unanswered questions" });
  }
});

// Mark an unanswered question as addressed with a resolution
router.post('/:id/address', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid question ID" });
    }

    const schema = z.object({
      resolution: z.string().min(1, "Resolution is required"),
      newDocumentId: z.number().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    const updatedQuestion = await UnansweredQuestionsService.markQuestionAddressed(
      id,
      result.data.resolution,
      result.data.newDocumentId,
    );

    return res.json(updatedQuestion);
  } catch (error) {
    console.error("Error marking question as addressed:", error);
    return res.status(500).json({ error: "Failed to mark question as addressed" });
  }
});

// Mark an unanswered question as ignored
router.post('/:id/ignore', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid question ID" });
    }

    const schema = z.object({
      reason: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    const updatedQuestion = await UnansweredQuestionsService.markQuestionIgnored(
      id,
      result.data.reason,
    );

    return res.json(updatedQuestion);
  } catch (error) {
    console.error("Error marking question as ignored:", error);
    return res.status(500).json({ error: "Failed to mark question as ignored" });
  }
});

export default router;