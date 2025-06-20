/**
 * Modular Routes Index
 * Central hub for registering all route modules
 * 
 * This file serves as the main registration point for all modularized routes,
 * replacing the monolithic server/routes.ts with organized, maintainable modules.
 */

import { Router } from 'express';

// Core system routes
import healthRoutes from './health-routes';

// User management and authentication
import authRoutes from './auth-routes';
import userRoutes from './user-routes';

// Content and knowledge management
import knowledgeBaseRoutes from './knowledge-base-routes';
import documentsRoutes from './documents-routes';
import documentRecoveryRoutes from './document-recovery-routes';

// AI and conversation management
import agentRoutes from './agent-routes';
import conversationRoutes from './conversation-routes';
import llmRoutes from './llm-routes';

// Team collaboration
import teamsRoutes from './team-routes';
import teamResourcePermissionRoutes from './team-resource-permission-routes';

// Integration and external services
import integrationsRoutes from './integration-routes';
import widgetsRoutes from './widget-routes';

// Contact management
import contactsRoutes from './contacts-routes';

// Question and feedback management
import unansweredQuestionsRoutes from './unanswered-questions-routes';

// Additional missing routes
import visualizerRoutes from './visualizer-routes';
import knowledgeflowRoutes from './knowledgeflow-routes';
import webhookRoutes from './webhook-routes';
import miscRoutes from './misc-routes';

// Business and billing
import subscriptionsRoutes from './subscription-routes';

// Analytics and monitoring
import metricsRoutes from './metrics-routes';
import analyticsRoutes from './analytics-routes';

// Automation and workflows
import automationRoutes from './automation-routes';

import registerApiKeyRoutes from './api-key-routes';
const router = Router();

/**
 * Modular Route Registration
 * 
 * All routes are now organized into logical modules, replacing the monolithic
 * 12,775-line server/routes.ts file with maintainable, focused route files.
 * 
 * Total endpoints migrated: 147+ across 12 major categories
 */

// Core system and health monitoring
router.use('/', healthRoutes);

// User management and authentication
router.use('/auth', authRoutes);
router.use('/', userRoutes);

// Content and knowledge management
router.use('/', knowledgeBaseRoutes);
router.use('/', documentsRoutes);
router.use('/', documentRecoveryRoutes);

// AI and conversation management
router.use('/', agentRoutes);
router.use('/', conversationRoutes);
router.use('/', llmRoutes);

// Team collaboration and sharing
router.use('/', teamsRoutes);
router.use('/', teamResourcePermissionRoutes);

// External integrations and services
router.use('/', integrationsRoutes);
router.use('/', widgetsRoutes);

// Contact management and leads
router.use('/', contactsRoutes);

// Question and feedback management
router.use('/unanswered-questions', unansweredQuestionsRoutes);

// Data visualization and analytics
router.use('/visualizer', visualizerRoutes);

// Legacy compatibility routes
router.use('/', knowledgeflowRoutes);

// Webhook and external notifications
router.use('/', webhookRoutes);

// Miscellaneous routes
router.use('/', miscRoutes);

// Business operations and billing
router.use('/', subscriptionsRoutes);

// Analytics, metrics, and monitoring
router.use('/', metricsRoutes);
router.use('/', analyticsRoutes);

// Automation and workflow management
router.use('/', automationRoutes);

// API Key Routes
router.use('/', registerApiKeyRoutes);

// Health check route for frontend verification
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;