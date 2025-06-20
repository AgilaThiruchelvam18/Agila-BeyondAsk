import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from './postgresql';
import { IStorage } from './storage';
import crypto from 'crypto';
import {
  User,
  InsertUser,
  Agent,
  InsertAgent,
  KnowledgeBase,
  InsertKnowledgeBase,
  Document,
  InsertDocument,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  Widget,
  InsertWidget,
  WidgetUser,
  InsertWidgetUser,
  WidgetSession,
  InsertWidgetSession,
  AnonymousWidgetUser,
  InsertAnonymousWidgetUser,
  AnonymousWidgetSession,
  InsertAnonymousWidgetSession,
  Otp,
  InsertOtp,
  UnansweredQuestion,
  InsertUnansweredQuestion,
  DailyUsageMetric, 
  InsertDailyUsageMetric,
  WidgetLead,
  InsertWidgetLead,
  ScheduledKnowledgeUpdate,
  InsertScheduledKnowledgeUpdate,
  ConversationMemory,
  InsertConversationMemory,
  // Visualizer types
  VisualizerBoard,
  InsertVisualizerBoard,
  VisualizerChatConversation,
  InsertVisualizerChatConversation,
  // Subscription types
  SubscriptionPlan,
  InsertSubscriptionPlan,
  Subscription,
  InsertSubscription,
  Payment,
  InsertPayment,
  // Team Management types
  Team, 
  InsertTeam,
  TeamMember,
  InsertTeamMember,
  TeamInvitation,
  InsertTeamInvitation,
  ActivityLog,
  InsertActivityLog,
  // Resource Permission types
  ResourceType,
  TeamResourcePermission,
  // API Key types
  ApiKey,
  InsertApiKey,
  InsertTeamResourcePermission,
  MemberResourcePermission,
  InsertMemberResourcePermission,
  // Integration types
  IntegrationProvider,
  InsertIntegrationProvider,
  Integration,
  InsertIntegration,
  IntegrationLog,
  InsertIntegrationLog,
  // Visualizer Board types
  // Database tables
  users,
  agents,
  knowledgeBases,
  documents,
  conversations,
  messages,
  widgets,
  widgetUsers,
  widgetSessions,
  anonymousWidgetUsers,
  anonymousWidgetSessions,
  otps,
  unansweredQuestions,
  widgetLeads,
  scheduledKnowledgeUpdates,
  conversationMemories,
  visualizerBoards,
  visualizerChatConversations,
  // Team Management tables
  teams,
  teamMembers,
  teamInvitations,
  activityLogs,
  // Resource Permission tables
  teamResourcePermissions,
  memberResourcePermissions,
  // Integration tables
  integrationProviders,
  integrations,
  integrationLogs,
  // Usage Metrics tables
  dailyUsageMetrics,
  // Subscription tables
  subscriptionPlans,
  userSubscriptions,
  subscriptionPayments
} from '../shared/schema';

/**
 * PostgreSQL Adapter to connect Drizzle to our storage interface
 */
// Import API key adapter methods
import { postgresqlApiKeyMethods } from './postgresql-api-key-adapter';
// Import domain adapters
import { UserAdapter } from './adapters/user-adapter';
import { AgentAdapter } from './adapters/agent-adapter';
import { KnowledgeBaseAdapter } from './adapters/knowledge-base-adapter';
import { DocumentAdapter } from './adapters/document-adapter';
import { ConversationAdapter } from './adapters/conversation-adapter';
import { MessageAdapter } from './adapters/message-adapter';
import { TeamAdapter } from './adapters/team-adapter';
import { IntegrationAdapter } from './adapters/integration-adapter';
import { UsageMetricsAdapter } from './adapters/usage-metrics-adapter';

export class PostgresqlAdapter implements IStorage {
  // API Key operations
  getApiKey = postgresqlApiKeyMethods.getApiKey;
  getApiKeyByPrefix = postgresqlApiKeyMethods.getApiKeyByPrefix;
  getApiKeysByUserId = postgresqlApiKeyMethods.getApiKeysByUserId;
  createApiKey = postgresqlApiKeyMethods.createApiKey;
  updateApiKey = postgresqlApiKeyMethods.updateApiKey;
  updateApiKeyLastUsed = postgresqlApiKeyMethods.updateApiKeyLastUsed;
  revokeApiKey = postgresqlApiKeyMethods.revokeApiKey;

  // User operations - delegate to optimized UserAdapter
  private userAdapter = new UserAdapter();
  
  // Direct delegation to UserAdapter methods
  getUser = this.userAdapter.getUser.bind(this.userAdapter);
  getUserByAuthId = this.userAdapter.getUserByAuthId.bind(this.userAdapter);
  getUserByEmail = this.userAdapter.getUserByEmail.bind(this.userAdapter);
  createUser = this.userAdapter.createUser.bind(this.userAdapter);
  updateUser = this.userAdapter.updateUser.bind(this.userAdapter);
  getUserById = this.userAdapter.getUserById.bind(this.userAdapter);

  // Agent operations - delegate to optimized AgentAdapter
  private agentAdapter = new AgentAdapter();
  
  // Direct delegation to AgentAdapter methods
  getAgent = this.agentAdapter.getAgent.bind(this.agentAdapter);
  getAgentsByUserId = this.agentAdapter.getAgentsByUserId.bind(this.agentAdapter);
  getPredefinedAgents = this.agentAdapter.getPredefinedAgents.bind(this.agentAdapter);
  createAgent = this.agentAdapter.createAgent.bind(this.agentAdapter);
  updateAgent = this.agentAdapter.updateAgent.bind(this.agentAdapter);
  deleteAgent = this.agentAdapter.deleteAgent.bind(this.agentAdapter);
  getAgentKnowledgeBases = this.agentAdapter.getAgentKnowledgeBases.bind(this.agentAdapter);
  getAgentConversationCount = this.agentAdapter.getAgentConversationCount.bind(this.agentAdapter);
  getAgentRecentConversations = this.agentAdapter.getAgentRecentConversations.bind(this.agentAdapter);
  getAgentDependencies = this.agentAdapter.getAgentDependencies.bind(this.agentAdapter);
  archiveAgentConversations = this.agentAdapter.archiveAgentConversations.bind(this.agentAdapter);
  deleteAgentKnowledgeBaseAssociations = this.agentAdapter.deleteAgentKnowledgeBaseAssociations.bind(this.agentAdapter);
  deleteAgentActivities = this.agentAdapter.deleteAgentActivities.bind(this.agentAdapter);
  deleteAgentShares = this.agentAdapter.deleteAgentShares.bind(this.agentAdapter);
  deleteAgentUnansweredQuestions = this.agentAdapter.deleteAgentUnansweredQuestions.bind(this.agentAdapter);
  deleteAgentWidgets = this.agentAdapter.deleteAgentWidgets.bind(this.agentAdapter);
  cascadeDeleteAgent = this.agentAdapter.cascadeDeleteAgent.bind(this.agentAdapter);
  checkAgentAccess = this.agentAdapter.checkAgentAccess.bind(this.agentAdapter);

  // Knowledge Base operations - delegate to optimized KnowledgeBaseAdapter
  private knowledgeBaseAdapter = new KnowledgeBaseAdapter();
  
  // Direct delegation to KnowledgeBaseAdapter methods
  getKnowledgeBase = this.knowledgeBaseAdapter.getKnowledgeBase.bind(this.knowledgeBaseAdapter);
  getKnowledgeBasesByUserId = this.knowledgeBaseAdapter.getKnowledgeBasesByUserId.bind(this.knowledgeBaseAdapter);
  createKnowledgeBase = this.knowledgeBaseAdapter.createKnowledgeBase.bind(this.knowledgeBaseAdapter);
  updateKnowledgeBase = this.knowledgeBaseAdapter.updateKnowledgeBase.bind(this.knowledgeBaseAdapter);
  deleteKnowledgeBase = this.knowledgeBaseAdapter.deleteKnowledgeBase.bind(this.knowledgeBaseAdapter);
  getKnowledgeBaseDependencies = this.knowledgeBaseAdapter.getKnowledgeBaseDependencies.bind(this.knowledgeBaseAdapter);
  cascadeDeleteKnowledgeBase = this.knowledgeBaseAdapter.cascadeDeleteKnowledgeBase.bind(this.knowledgeBaseAdapter);
  getKnowledgeBaseDocumentCount = this.knowledgeBaseAdapter.getKnowledgeBaseDocumentCount.bind(this.knowledgeBaseAdapter);

  // Document operations - delegate to optimized DocumentAdapter
  private documentAdapter = new DocumentAdapter();
  
  // Direct delegation to DocumentAdapter methods
  getDocument = this.documentAdapter.getDocument.bind(this.documentAdapter);
  getDocumentsByKnowledgeBaseId = this.documentAdapter.getDocumentsByKnowledgeBaseId.bind(this.documentAdapter);
  createDocument = this.documentAdapter.createDocument.bind(this.documentAdapter);
  updateDocument = this.documentAdapter.updateDocument.bind(this.documentAdapter);
  deleteDocument = this.documentAdapter.deleteDocument.bind(this.documentAdapter);
  getDocumentsByIds = this.documentAdapter.getDocumentsByIds.bind(this.documentAdapter);
  updateDocumentProcessingStatus = this.documentAdapter.updateDocumentProcessingStatus.bind(this.documentAdapter);
  searchDocuments = this.documentAdapter.searchDocuments.bind(this.documentAdapter);
  getDocumentsByType = this.documentAdapter.getDocumentsByType.bind(this.documentAdapter);
  getDocumentProcessingStats = this.documentAdapter.getDocumentProcessingStats.bind(this.documentAdapter);
  updateDocumentContent = this.documentAdapter.updateDocumentContent.bind(this.documentAdapter);
  getRecentDocuments = this.documentAdapter.getRecentDocuments.bind(this.documentAdapter);

  // Conversation operations - delegate to optimized ConversationAdapter
  private conversationAdapter = new ConversationAdapter();
  
  // Direct delegation to ConversationAdapter methods
  getConversation = this.conversationAdapter.getConversation.bind(this.conversationAdapter);
  getConversationsByUserId = this.conversationAdapter.getConversationsByUserId.bind(this.conversationAdapter);
  getConversationsByAgentId = this.conversationAdapter.getConversationsByAgentId.bind(this.conversationAdapter);
  createConversation = this.conversationAdapter.createConversation.bind(this.conversationAdapter);
  updateConversation = this.conversationAdapter.updateConversation.bind(this.conversationAdapter);
  deleteConversation = this.conversationAdapter.deleteConversation.bind(this.conversationAdapter);
  searchConversations = this.conversationAdapter.searchConversations.bind(this.conversationAdapter);
  getConversationStats = this.conversationAdapter.getConversationStats.bind(this.conversationAdapter);
  getRecentConversations = this.conversationAdapter.getRecentConversations.bind(this.conversationAdapter);
  getActiveConversations = this.conversationAdapter.getActiveConversations.bind(this.conversationAdapter);
  archiveConversation = this.conversationAdapter.archiveConversation.bind(this.conversationAdapter);
  restoreConversation = this.conversationAdapter.restoreConversation.bind(this.conversationAdapter);
  getArchivedConversations = this.conversationAdapter.getArchivedConversations.bind(this.conversationAdapter);

  // Message operations - delegate to optimized MessageAdapter
  private messageAdapter = new MessageAdapter();
  
  // Direct delegation to MessageAdapter methods
  getMessage = this.messageAdapter.getMessage.bind(this.messageAdapter);
  getMessagesByConversationId = this.messageAdapter.getMessagesByConversationId.bind(this.messageAdapter);
  createMessage = this.messageAdapter.createMessage.bind(this.messageAdapter);
  updateMessage = this.messageAdapter.updateMessage.bind(this.messageAdapter);
  deleteMessage = this.messageAdapter.deleteMessage.bind(this.messageAdapter);
  getConversationMessages = this.messageAdapter.getConversationMessages.bind(this.messageAdapter);
  searchMessages = this.messageAdapter.searchMessages.bind(this.messageAdapter);
  getMessageStats = this.messageAdapter.getMessageStats.bind(this.messageAdapter);
  createMessages = this.messageAdapter.createMessages.bind(this.messageAdapter);
  deleteMessagesByConversationId = this.messageAdapter.deleteMessagesByConversationId.bind(this.messageAdapter);
  getRecentMessages = this.messageAdapter.getRecentMessages.bind(this.messageAdapter);
  getMessagesByRole = this.messageAdapter.getMessagesByRole.bind(this.messageAdapter);
  getConversationMessageCount = this.messageAdapter.getConversationMessageCount.bind(this.messageAdapter);

  // Team operations - delegate to optimized TeamAdapter
  private teamAdapter = new TeamAdapter();
  
  // Direct delegation to TeamAdapter methods
  getTeam = this.teamAdapter.getTeam.bind(this.teamAdapter);
  getTeamsByUserId = this.teamAdapter.getTeamsByUserId.bind(this.teamAdapter);
  createTeam = this.teamAdapter.createTeam.bind(this.teamAdapter);
  updateTeam = this.teamAdapter.updateTeam.bind(this.teamAdapter);
  deleteTeam = this.teamAdapter.deleteTeam.bind(this.teamAdapter);
  getTeamMembers = this.teamAdapter.getTeamMembers.bind(this.teamAdapter);
  getTeamMember = this.teamAdapter.getTeamMember.bind(this.teamAdapter);
  addTeamMember = this.teamAdapter.addTeamMember.bind(this.teamAdapter);
  updateTeamMember = this.teamAdapter.updateTeamMember.bind(this.teamAdapter);
  removeTeamMember = this.teamAdapter.removeTeamMember.bind(this.teamAdapter);
  isTeamMember = this.teamAdapter.isTeamMember.bind(this.teamAdapter);
  getTeamInvitations = this.teamAdapter.getTeamInvitations.bind(this.teamAdapter);
  getTeamInvitation = this.teamAdapter.getTeamInvitation.bind(this.teamAdapter);
  getTeamInvitationByToken = this.teamAdapter.getTeamInvitationByToken.bind(this.teamAdapter);
  createTeamInvitation = this.teamAdapter.createTeamInvitation.bind(this.teamAdapter);
  updateTeamInvitation = this.teamAdapter.updateTeamInvitation.bind(this.teamAdapter);
  deleteTeamInvitation = this.teamAdapter.deleteTeamInvitation.bind(this.teamAdapter);
  searchTeams = this.teamAdapter.searchTeams.bind(this.teamAdapter);
  getTeamStats = this.teamAdapter.getTeamStats.bind(this.teamAdapter);
  getUserTeamRole = this.teamAdapter.getUserTeamRole.bind(this.teamAdapter);
  getTeamsByRole = this.teamAdapter.getTeamsByRole.bind(this.teamAdapter);

  // Integration operations - delegate to optimized IntegrationAdapter
  private integrationAdapter = new IntegrationAdapter();
  
  // Direct delegation to IntegrationAdapter methods
  getIntegration = this.integrationAdapter.getIntegration.bind(this.integrationAdapter);
  getIntegrationsByUserId = this.integrationAdapter.getIntegrationsByUserId.bind(this.integrationAdapter);
  getIntegrationsByTeamId = this.integrationAdapter.getIntegrationsByTeamId.bind(this.integrationAdapter);
  createIntegration = this.integrationAdapter.createIntegration.bind(this.integrationAdapter);
  updateIntegration = this.integrationAdapter.updateIntegration.bind(this.integrationAdapter);
  deleteIntegration = this.integrationAdapter.deleteIntegration.bind(this.integrationAdapter);
  getIntegrationsByType = this.integrationAdapter.getIntegrationsByType.bind(this.integrationAdapter);
  getIntegrationsByProvider = this.integrationAdapter.getIntegrationsByProvider.bind(this.integrationAdapter);
  getActiveIntegrations = this.integrationAdapter.getActiveIntegrations.bind(this.integrationAdapter);
  getIntegrationByName = this.integrationAdapter.getIntegrationByName.bind(this.integrationAdapter);
  updateIntegrationConfig = this.integrationAdapter.updateIntegrationConfig.bind(this.integrationAdapter);
  updateIntegrationOAuth = this.integrationAdapter.updateIntegrationOAuth.bind(this.integrationAdapter);
  validateIntegrationConfig = this.integrationAdapter.validateIntegrationConfig.bind(this.integrationAdapter);
  searchIntegrations = this.integrationAdapter.searchIntegrations.bind(this.integrationAdapter);
  getIntegrationStats = this.integrationAdapter.getIntegrationStats.bind(this.integrationAdapter);
  getFailedIntegrations = this.integrationAdapter.getFailedIntegrations.bind(this.integrationAdapter);
  updateIntegrationStatus = this.integrationAdapter.updateIntegrationStatus.bind(this.integrationAdapter);
  
  // Usage Metrics operations - delegate to optimized UsageMetricsAdapter
  private usageMetricsAdapter = new UsageMetricsAdapter();
  
  // Direct delegation to UsageMetricsAdapter methods
  trackDailyUsageMetric = this.usageMetricsAdapter.trackDailyUsageMetric.bind(this.usageMetricsAdapter);
  getDailyUsageMetrics = this.usageMetricsAdapter.getDailyUsageMetrics.bind(this.usageMetricsAdapter);
  getUsageSummary = this.usageMetricsAdapter.getUsageSummary.bind(this.usageMetricsAdapter);
  getRegionalMetrics = this.usageMetricsAdapter.getRegionalMetrics.bind(this.usageMetricsAdapter);
  getStorageUtilization = this.usageMetricsAdapter.getStorageUtilization.bind(this.usageMetricsAdapter);
  getDailyMetrics = this.usageMetricsAdapter.getDailyMetrics.bind(this.usageMetricsAdapter);
  getMetricsBySource = this.usageMetricsAdapter.getMetricsBySource.bind(this.usageMetricsAdapter);
  getMetricTrends = this.usageMetricsAdapter.getMetricTrends.bind(this.usageMetricsAdapter);
  getTeamUsageMetrics = this.usageMetricsAdapter.getTeamUsageMetrics.bind(this.usageMetricsAdapter);
  getTeamMemberUsage = this.usageMetricsAdapter.getTeamMemberUsage.bind(this.usageMetricsAdapter);
  getTopMetrics = this.usageMetricsAdapter.getTopMetrics.bind(this.usageMetricsAdapter);
  getUsageQuota = this.usageMetricsAdapter.getUsageQuota.bind(this.usageMetricsAdapter);
  cleanupOldMetrics = this.usageMetricsAdapter.cleanupOldMetrics.bind(this.usageMetricsAdapter);
  
  // Visualizer Board operations
  async getVisualizerBoard(id: number): Promise<VisualizerBoard | undefined> {
    try {
      const results = await db.select().from(visualizerBoards).where(eq(visualizerBoards.id, id)).limit(1);
      return results[0];
    } catch (error) {
      console.error('Error fetching visualizer board:', error);
      throw error;
    }
  }
  
  // Visualizer Chat Conversation operations
  async getVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<VisualizerChatConversation | undefined> {
    try {
      const results = await db.select()
        .from(visualizerChatConversations)
        .where(and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        ))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error fetching visualizer chat conversation:', error);
      throw error;
    }
  }
  
  // Get document count for a knowledge base (used in chat simulation)
  async getDocumentCountByKnowledgeBaseId(kbId: number): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(documents).where(eq(documents.knowledgeBaseId, kbId));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting document count for KB:', error);
      return 0;
    }
  }

  async createVisualizerChatConversation(conversation: InsertVisualizerChatConversation): Promise<VisualizerChatConversation> {
    try {
      console.log('Creating visualizer chat conversation with data:', {
        boardId: conversation.boardId,
        chatNodeId: conversation.chatNodeId,
        messagesCount: Array.isArray(conversation.messages) ? conversation.messages.length : 0
      });
      
      const now = new Date();
      
      // Prepare conversation data with timestamps
      const conversationData = {
        ...conversation,
        createdAt: now,
        updatedAt: now
      };
      
      // Debug the actual insert operation
      try {
        const results = await db.insert(visualizerChatConversations).values(conversationData).returning();
        console.log('Successfully created visualizer chat conversation:', {
          id: results[0]?.id,
          boardId: results[0]?.boardId,
          chatNodeId: results[0]?.chatNodeId
        });
        return results[0];
      } catch (insertError) {
        console.error('Database error during chat conversation insert:', insertError);
        throw insertError;
      }
    } catch (error) {
      console.error('Error creating visualizer chat conversation:', error);
      throw error;
    }
  }
  
  async updateVisualizerChatConversation(boardId: number, chatNodeId: string, data: Partial<VisualizerChatConversation>): Promise<VisualizerChatConversation | undefined> {
    try {
      // Always update the updatedAt timestamp
      const dataWithTimestamp = {
        ...data,
        updatedAt: new Date()
      };
      
      const results = await db.update(visualizerChatConversations)
        .set(dataWithTimestamp)
        .where(and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        ))
        .returning();
      
      return results[0];
    } catch (error) {
      console.error('Error updating visualizer chat conversation:', error);
      throw error;
    }
  }
  
  async deleteVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<boolean> {
    try {
      const result = await db.delete(visualizerChatConversations)
        .where(and(
          eq(visualizerChatConversations.boardId, boardId),
          eq(visualizerChatConversations.chatNodeId, chatNodeId)
        ))
        .returning({ id: visualizerChatConversations.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting visualizer chat conversation:', error);
      throw error;
    }
  }
  
  async getVisualizerBoardsByUserId(userId: number): Promise<VisualizerBoard[]> {
    try {
      return await db.select().from(visualizerBoards).where(eq(visualizerBoards.userId, userId));
    } catch (error) {
      console.error('Error fetching visualizer boards by user ID:', error);
      throw error;
    }
  }
  
  async createVisualizerBoard(board: InsertVisualizerBoard): Promise<VisualizerBoard> {
    try {
      const now = new Date();
      
      // Prepare board data with timestamps
      const boardData = {
        ...board,
        createdAt: now,
        updatedAt: now
      };
      
      const results = await db.insert(visualizerBoards).values(boardData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating visualizer board:', error);
      throw error;
    }
  }
  
  async updateVisualizerBoard(id: number, boardData: Partial<VisualizerBoard>): Promise<VisualizerBoard | undefined> {
    try {
      // Always update the updatedAt timestamp
      const dataWithTimestamp = {
        ...boardData,
        updatedAt: new Date()
      };
      
      const results = await db.update(visualizerBoards)
        .set(dataWithTimestamp)
        .where(eq(visualizerBoards.id, id))
        .returning();
      
      return results[0];
    } catch (error) {
      console.error('Error updating visualizer board:', error);
      throw error;
    }
  }
  
  async deleteVisualizerBoard(id: number): Promise<boolean> {
    try {
      const result = await db.delete(visualizerBoards)
        .where(eq(visualizerBoards.id, id))
        .returning({ id: visualizerBoards.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting visualizer board:', error);
      throw error;
    }
  }
  
  // Widget Lead operations
  async getWidgetLead(id: number): Promise<WidgetLead | undefined> {
    const results = await db.select().from(widgetLeads).where(eq(widgetLeads.id, id)).limit(1);
    return results[0];
  }

  async getWidgetLeadsByWidgetId(widgetId: number): Promise<WidgetLead[]> {
    return await db.select().from(widgetLeads).where(eq(widgetLeads.widgetId, widgetId));
  }

  async getWidgetLeadsByAnonymousUserId(anonymousUserId: number): Promise<WidgetLead[]> {
    return await db.select().from(widgetLeads).where(eq(widgetLeads.anonymousUserId, anonymousUserId));
  }

  async createWidgetLead(insertLead: InsertWidgetLead): Promise<WidgetLead> {
    try {
      const now = new Date();
      // Prepare lead data
      const leadData = {
        email: insertLead.email,
        name: insertLead.name,
        status: insertLead.status || 'new',
        metadata: insertLead.metadata || {},
        phone: insertLead.phone || null,
        widgetId: insertLead.widgetId,
        ipAddress: insertLead.ipAddress || null,
        userAgent: insertLead.userAgent || null,
        anonymousUserId: insertLead.anonymousUserId,
        company: insertLead.company || null,
        updatedAt: now
      };
      
      const results = await db.insert(widgetLeads).values(leadData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating widget lead:', error);
      throw error;
    }
  }

  async updateWidgetLead(id: number, leadData: Partial<WidgetLead>): Promise<WidgetLead | undefined> {
    // Always update the updatedAt timestamp
    const dataWithTimestamp = {
      ...leadData,
      updatedAt: new Date()
    };
    
    const results = await db.update(widgetLeads)
      .set(dataWithTimestamp)
      .where(eq(widgetLeads.id, id))
      .returning();
    return results[0];
  }

  // User operations





  
















  // Knowledge Base operations


  async getKnowledgeBasesByIds(ids: number[]): Promise<KnowledgeBase[]> {
    if (ids.length === 0) return [];
    console.log(`[PERF] getKnowledgeBasesByIds: Batch fetching ${ids.length} knowledge bases`);
    const startTime = Date.now();
    
    const results = await db.select().from(knowledgeBases).where(inArray(knowledgeBases.id, ids));
    
    const endTime = Date.now();
    console.log(`[PERF] getKnowledgeBasesByIds: Completed in ${endTime - startTime}ms, found ${results.length} knowledge bases`);
    
    return results;
  }






  

  




  async getKnowledgeBaseAgentCount(kbId: string | number): Promise<number> {
    const numericId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const result = await db.select({ count: count() })
        .from(agents)
        .where(sql`${agents.knowledgeBaseIds} @> ${JSON.stringify([numericId])}`);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base agent count:', error);
      return 0;
    }
  }

  async getKnowledgeBaseRecentDocuments(kbId: string | number, limit: number = 5): Promise<Document[]> {
    const numericId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.select()
        .from(documents)
        .where(eq(documents.knowledgeBaseId, numericId))
        .orderBy(desc(documents.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting knowledge base recent documents:', error);
      return [];
    }
  }

  async checkKnowledgeBaseAccess(kbId: string | number, userId: string | number): Promise<boolean> {
    const numericKbId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    try {
      const kb = await this.getKnowledgeBase(numericKbId);
      if (!kb) return false;
      
      // Owner has access
      if (kb.userId === numericUserId) return true;
      
      // Public knowledge bases are accessible
      if (kb.isPublic) return true;
      
      // TODO: Check team-based permissions when implemented
      return false;
    } catch (error) {
      console.error('Error checking knowledge base access:', error);
      return false;
    }
  }







  async deleteKnowledgeBaseDocuments(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(documents).where(eq(documents.knowledgeBaseId, knowledgeBaseId)).returning();
      console.log(`Deleted ${results.length} documents from knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base documents:', error);
      return false;
    }
  }

  async deleteKnowledgeBaseActivities(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(activityLogs)
        .where(
          and(
            eq(activityLogs.entityType, 'knowledge_base'),
            eq(activityLogs.entityId, knowledgeBaseId.toString())
          )
        )
        .returning();
      console.log(`Deleted ${results.length} activity logs for knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base activities:', error);
      return false;
    }
  }

  async deleteKnowledgeBaseShares(kbId: string | number): Promise<boolean> {
    const knowledgeBaseId = typeof kbId === 'string' ? parseInt(kbId) : kbId;
    try {
      const results = await db.delete(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.resourceType, 'knowledge_base'),
            eq(teamResourcePermissions.resourceId, knowledgeBaseId)
          )
        )
        .returning();
      console.log(`Deleted ${results.length} shares for knowledge base ${knowledgeBaseId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge base shares:', error);
      return false;
    }
  }







  async getConversationSummary(conversationId: number): Promise<string | null> {
    try {
      // Check if conversation memory exists
      const memory = await db.select()
        .from(conversationMemories)
        .where(eq(conversationMemories.conversationId, conversationId))
        .limit(1);
      
      if (memory.length > 0 && memory[0].summary) {
        return memory[0].summary;
      }
      
      // If no memory exists, return null
      return null;
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return null;
    }
  }

  async deleteConversationMessages(conversationId: number): Promise<boolean> {
    try {
      await db.delete(messages).where(eq(messages.conversationId, conversationId));
      return true;
    } catch (error) {
      console.error('Error deleting conversation messages:', error);
      return false;
    }
  }
  
  // Widget operations
  async getWidget(id: string | number): Promise<Widget | undefined> {
    console.log("PostgreSQL getting widget with ID:", id);
    
    // Try to find by ID first
    const results = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1);
    
    // Note: widgetIdentifier property was removed from schema, using ID only
    
    return results[0];
  }
  
  async getWidgetByPublicKey(publicKey: string): Promise<Widget | undefined> {
    console.log("PostgreSQL getting widget by public key:", publicKey);
    
    // First try to find by public key
    let results = await db.select().from(widgets).where(eq(widgets.publicKey, publicKey)).limit(1);
    
    // If not found, maybe the widget ID was incorrectly passed as the public key
    // This often happens when the front-end doesn't understand the distinction
    if (results.length === 0 && publicKey.startsWith('widget_')) {
      console.log("Widget not found by public key, trying by id:", publicKey);
      results = await db.select().from(widgets).where(eq(widgets.id, publicKey)).limit(1);
    }
    
    console.log("PostgreSQL widget search results:", results.length > 0 ? "Found" : "Not found");
    return results[0];
  }
  
  async getWidgetsByUserId(userId: number): Promise<Widget[]> {
    return await db.select().from(widgets).where(eq(widgets.userId, userId));
  }
  
  async createWidget(insertWidget: InsertWidget): Promise<Widget> {
    try {
      // Generate a UUID for identifier purposes if not provided
      const uuid = Math.random().toString(36).substring(2, 15);
      const publicKey = `pk_${uuid}`;
      const secretKey = `sk_${uuid}`;
      
      // Generate widget ID based on agent ID
      const widgetId = `widget_${insertWidget.agentId}_${uuid.substring(0, 8)}`;
      
      // Ensure all required fields are present
      const widgetData = {
        id: widgetId,
        name: insertWidget.name,
        userId: insertWidget.userId,
        agentId: insertWidget.agentId,
        publicKey,
        secretKey,
        active: true,
        config: insertWidget.config || {
          theme: {
            primaryColor: "#3b82f6",
            textColor: "#ffffff",
            backgroundColor: "#ffffff"
          },
          position: "bottom-right" as const,
          size: "medium" as const,
          welcomeMessage: "How can I help you today?",
          widgetTitle: "AI Assistant"
        },
        allowAnonymous: insertWidget.allowAnonymous || false
      };
      
      console.log("PostgreSQL creating widget with ID:", widgetId);
      const results = await db.insert(widgets).values([widgetData]).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating widget:', error);
      throw error;
    }
  }
  
  async updateWidget(id: string | number, widgetData: Partial<Widget>): Promise<Widget | undefined> {
    console.log("PostgreSQL updating widget with ID:", id);
    
    // Try to find the widget first to see if we need to use widget_identifier
    const widget = await this.getWidget(id);
    if (!widget) {
      console.log("Widget not found for updating with ID:", id);
      return undefined;
    }
    
    // We found the widget, so use its actual ID for the update
    const results = await db.update(widgets)
      .set(widgetData)
      .where(eq(widgets.id, widget.id))
      .returning();
      
    return results[0];
  }
  
  async deleteWidget(id: string | number): Promise<boolean> {
    console.log("PostgreSQL deleting widget with ID:", id);
    
    // Try to find the widget first to see if we need to use widget_identifier
    const widget = await this.getWidget(id);
    if (!widget) {
      console.log("Widget not found for deletion with ID:", id);
      return false;
    }
    
    // We found the widget, so use its actual ID for the deletion
    const results = await db.delete(widgets)
      .where(eq(widgets.id, widget.id))
      .returning();
      
    return results.length > 0;
  }
  
  // Widget User operations
  async getWidgetUser(id: string): Promise<WidgetUser | undefined> {
    try {
      console.log('PostgreSQL: Getting widget user with ID:', id);
      
      const results = await db.select().from(widgetUsers).where(eq(widgetUsers.id, id)).limit(1);
      
      if (results && results.length > 0) {
        console.log('PostgreSQL: Found widget user with ID:', id);
      } else {
        console.log('PostgreSQL: No widget user found with ID:', id);
      }
      
      return results[0];
    } catch (error) {
      console.error('PostgreSQL: Error getting widget user:', error);
      throw error;
    }
  }
  
  async getWidgetUserByEmail(email: string): Promise<WidgetUser | undefined> {
    const results = await db.select().from(widgetUsers).where(eq(widgetUsers.email, email)).limit(1);
    return results[0];
  }
  
  async createWidgetUser(insertWidgetUser: InsertWidgetUser): Promise<WidgetUser> {
    try {
      console.log('PostgreSQL: Creating widget user with data:', insertWidgetUser);
      
      // Generate a UUID for the ID field (since it's a TEXT type in the database)
      // We'll use a combination of 'wu_' prefix and a random UUID
      const userId = `wu_${crypto.randomUUID()}`;
      
      console.log('PostgreSQL: Generated widget user ID:', userId);
      
      // Include all necessary fields, including the manually generated ID
      const userData = {
        id: userId, // Explicitly provide the ID as TEXT
        email: insertWidgetUser.email.toLowerCase(),
        name: insertWidgetUser.name || null,
        verified: false,
        lastLoginAt: null
      };
      
      console.log('PostgreSQL: Full widget user data for insertion:', userData);
      
      // Insert the user with our manually generated ID
      const results = await db.insert(widgetUsers).values(userData).returning();
      
      if (!results || results.length === 0) {
        throw new Error('Failed to create widget user - no results returned');
      }
      
      console.log('PostgreSQL: Widget user created successfully with ID:', results[0].id);
      return results[0];
    } catch (error) {
      console.error('PostgreSQL: Error creating widget user:', error);
      throw error;
    }
  }
  
  async updateWidgetUser(id: string, userData: Partial<WidgetUser>): Promise<WidgetUser | undefined> {
    try {
      console.log('PostgreSQL: Updating widget user with ID:', id, 'with data:', userData);
      
      const results = await db.update(widgetUsers)
        .set(userData)
        .where(eq(widgetUsers.id, id))
        .returning();
      
      if (!results || results.length === 0) {
        console.warn('PostgreSQL: No widget user found to update with ID:', id);
        return undefined;
      }
      
      console.log('PostgreSQL: Widget user updated successfully, returned data:', results[0]);
      return results[0];
    } catch (error) {
      console.error('PostgreSQL: Error updating widget user:', error);
      throw error; 
    }
  }
  
  // Anonymous Widget User operations
  async getAnonymousWidgetUser(id: number): Promise<AnonymousWidgetUser | undefined> {
    const results = await db.select().from(anonymousWidgetUsers).where(eq(anonymousWidgetUsers.id, id)).limit(1);
    return results[0];
  }
  
  async getAnonymousWidgetUserByUuid(uuid: string): Promise<AnonymousWidgetUser | undefined> {
    const results = await db.select().from(anonymousWidgetUsers).where(eq(anonymousWidgetUsers.uuid, uuid)).limit(1);
    return results[0];
  }
  
  async createAnonymousWidgetUser(insertAnonymousWidgetUser: InsertAnonymousWidgetUser): Promise<AnonymousWidgetUser> {
    try {
      const userValues = {
        uuid: insertAnonymousWidgetUser.uuid,
        widgetId: insertAnonymousWidgetUser.widgetId,
        email: insertAnonymousWidgetUser.email || null,
        name: insertAnonymousWidgetUser.name || null,
        phone: insertAnonymousWidgetUser.phone || null,
        ipAddress: insertAnonymousWidgetUser.ipAddress || null,
        userAgent: insertAnonymousWidgetUser.userAgent || null,
        metadata: insertAnonymousWidgetUser.metadata || {},
      };
      
      const results = await db.insert(anonymousWidgetUsers).values(userValues).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating anonymous widget user:', error);
      throw error;
    }
  }
  
  async updateAnonymousWidgetUser(id: number, userData: Partial<AnonymousWidgetUser>): Promise<AnonymousWidgetUser | undefined> {
    const results = await db.update(anonymousWidgetUsers)
      .set({
        ...userData,
        updatedAt: new Date(), // Always update the updatedAt timestamp
      })
      .where(eq(anonymousWidgetUsers.id, id))
      .returning();
    return results[0];
  }
  
  // Widget Session operations
  async getWidgetSession(id: string): Promise<WidgetSession | undefined> {
    const results = await db.select().from(widgetSessions).where(eq(widgetSessions.id, id)).limit(1);
    return results[0];
  }
  
  async getWidgetSessionByToken(token: string): Promise<WidgetSession | undefined> {
    const results = await db.select().from(widgetSessions).where(eq(widgetSessions.token, token)).limit(1);
    return results[0];
  }
  
  async createWidgetSession(insertWidgetSession: InsertWidgetSession): Promise<WidgetSession> {
    try {
      console.log('PostgreSQL: Creating widget session with data:', insertWidgetSession);
      
      // Ensure widgetUserId is a string (it should be from our updated schema)
      if (typeof insertWidgetSession.widgetUserId !== 'string') {
        console.warn('PostgreSQL: widgetUserId is not a string:', insertWidgetSession.widgetUserId);
        // Convert to string if it's not already
        insertWidgetSession.widgetUserId = String(insertWidgetSession.widgetUserId);
        console.log('PostgreSQL: Converted widgetUserId to string:', insertWidgetSession.widgetUserId);
      }
      
      // Generate a unique ID for the session (similar to how we do for widgetUsers)
      // Format: ws_uuid
      const uuid = crypto.randomUUID();
      const sessionId = `ws_${uuid}`;
      
      // Create a session object with all necessary fields including the generated ID
      const sessionData = {
        id: sessionId, // Use the generated ID
        widgetUserId: insertWidgetSession.widgetUserId,
        token: insertWidgetSession.token,
        expiresAt: insertWidgetSession.expiresAt
      };
      
      console.log('PostgreSQL: Full widget session data for insertion:', sessionData);
      
      const results = await db.insert(widgetSessions).values(sessionData).returning();
      
      if (!results || results.length === 0) {
        throw new Error('Failed to create widget session - no results returned');
      }
      
      console.log('PostgreSQL: Widget session created successfully with ID:', results[0].id);
      return results[0];
    } catch (error) {
      console.error('PostgreSQL: Error creating widget session:', error);
      throw error;
    }
  }
  
  // Anonymous Widget Session operations
  async getAnonymousWidgetSession(id: number): Promise<AnonymousWidgetSession | undefined> {
    const results = await db.select().from(anonymousWidgetSessions).where(eq(anonymousWidgetSessions.id, id)).limit(1);
    return results[0];
  }
  
  async getAnonymousWidgetSessionByToken(token: string): Promise<AnonymousWidgetSession | undefined> {
    const results = await db.select().from(anonymousWidgetSessions).where(eq(anonymousWidgetSessions.token, token)).limit(1);
    return results[0];
  }
  
  async createAnonymousWidgetSession(insertAnonymousWidgetSession: InsertAnonymousWidgetSession): Promise<AnonymousWidgetSession> {
    try {
      const sessionValues = {
        uuid: insertAnonymousWidgetSession.uuid,
        token: insertAnonymousWidgetSession.token,
        widgetId: insertAnonymousWidgetSession.widgetId,
        anonymousUserId: insertAnonymousWidgetSession.anonymousUserId,
        lastActive: new Date(), // Set initial lastActive time
      };
      
      const results = await db.insert(anonymousWidgetSessions).values(sessionValues).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating anonymous widget session:', error);
      throw error;
    }
  }
  
  async updateAnonymousWidgetSession(id: number, sessionData: Partial<AnonymousWidgetSession>): Promise<AnonymousWidgetSession | undefined> {
    // Always update lastActive when updating a session
    const dataWithLastActive = {
      ...sessionData,
      lastActive: new Date()
    };
    
    const results = await db.update(anonymousWidgetSessions)
      .set(dataWithLastActive)
      .where(eq(anonymousWidgetSessions.id, id))
      .returning();
    return results[0];
  }
  
  // OTP operations
  async getOtp(id: string): Promise<Otp | undefined> {
    const results = await db.select().from(otps).where(eq(otps.id, id)).limit(1);
    return results[0];
  }
  
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
  
  async createOtp(insertOtp: InsertOtp): Promise<Otp> {
    try {
      const otpData = {
        ...insertOtp,
        verified: false
      };
      
      const results = await db.insert(otps).values([otpData]).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw error;
    }
  }
  
  async updateOtp(id: string, otpData: Partial<Otp>): Promise<Otp | undefined> {
    const results = await db.update(otps)
      .set(otpData)
      .where(eq(otps.id, id))
      .returning();
    return results[0];
  }

  // Unanswered Questions operations
  async getUnansweredQuestion(id: number): Promise<UnansweredQuestion | undefined> {
    const results = await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.id, id)).limit(1);
    return results[0];
  }

  async getUnansweredQuestionsByUserId(userId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.userId, userId));
  }

  async getUnansweredQuestionsByAgentId(agentId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.agentId, agentId));
  }

  async getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId: number): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.knowledgeBaseId, knowledgeBaseId));
  }

  async getUnansweredQuestionsByStatus(status: string): Promise<UnansweredQuestion[]> {
    return await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.status, status));
  }

  async createUnansweredQuestion(insertQuestion: InsertUnansweredQuestion): Promise<UnansweredQuestion> {
    try {
      const now = new Date();
      
      // Helper function to recursively sanitize objects and remove null bytes
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj.replace(/\0/g, '');
        }
        if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
          }
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        return obj;
      };
      
      // Ensure all required fields are present and sanitize text fields
      const questionData = {
        question: insertQuestion.question ? insertQuestion.question.replace(/\0/g, '') : '',
        agentId: insertQuestion.agentId,
        userId: insertQuestion.userId || null,
        knowledgeBaseId: insertQuestion.knowledgeBaseId || null,
        conversationId: insertQuestion.conversationId || null,
        messageId: insertQuestion.messageId || null,
        context: insertQuestion.context ? insertQuestion.context.replace(/\0/g, '') : null,
        confidenceScore: insertQuestion.confidenceScore || null,
        status: insertQuestion.status ? insertQuestion.status.replace(/\0/g, '') : 'pending',
        resolution: insertQuestion.resolution ? insertQuestion.resolution.replace(/\0/g, '') : null,
        newDocumentId: insertQuestion.newDocumentId || null,
        source: insertQuestion.source ? insertQuestion.source.replace(/\0/g, '') : 'chat',
        metadata: sanitizeObject(insertQuestion.metadata || {}),
        updatedAt: now
      };
      
      const results = await db.insert(unansweredQuestions).values([questionData]).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating unanswered question:', error);
      throw error;
    }
  }

  async updateUnansweredQuestion(id: number, questionData: Partial<UnansweredQuestion>): Promise<UnansweredQuestion | undefined> {
    const dataWithUpdatedTimestamp = {
      ...questionData,
      updatedAt: new Date()
    };
    
    const results = await db.update(unansweredQuestions)
      .set(dataWithUpdatedTimestamp)
      .where(eq(unansweredQuestions.id, id))
      .returning();
    return results[0];
  }

  // Scheduled Knowledge Update operations
  async getScheduledKnowledgeUpdate(id: number): Promise<ScheduledKnowledgeUpdate | undefined> {
    const results = await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.id, id)).limit(1);
    return results[0];
  }

  async getScheduledKnowledgeUpdatesByUserId(userId: number): Promise<ScheduledKnowledgeUpdate[]> {
    return await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.userId, userId));
  }

  async getScheduledKnowledgeUpdatesByAgentId(agentId: number): Promise<ScheduledKnowledgeUpdate[]> {
    return await db.select().from(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.agentId, agentId));
  }

  async getScheduledKnowledgeUpdatesDue(): Promise<ScheduledKnowledgeUpdate[]> {
    const now = new Date();
    return await db.select()
      .from(scheduledKnowledgeUpdates)
      .where(
        and(
          eq(scheduledKnowledgeUpdates.isActive, true),
          sql`${scheduledKnowledgeUpdates.nextRun} IS NOT NULL AND ${scheduledKnowledgeUpdates.nextRun} <= ${now}`
        )
      );
  }

  async createScheduledKnowledgeUpdate(insertUpdate: InsertScheduledKnowledgeUpdate): Promise<ScheduledKnowledgeUpdate> {
    try {
      const now = new Date();
      
      // Calculate the initial nextRun time based on the schedule
      let nextRun: Date | null = null;
      const schedule = insertUpdate.schedule;
      
      if (schedule) {
        nextRun = new Date(now);
        
        switch (schedule.frequency) {
          case 'hourly':
            nextRun.setHours(nextRun.getHours() + schedule.interval);
            break;
            
          case 'daily':
            nextRun.setDate(nextRun.getDate() + schedule.interval);
            
            // Set specific time if provided
            if (schedule.specificTime && typeof schedule.specificTime === 'string') {
              const [hours, minutes] = schedule.specificTime.split(':').map(Number);
              nextRun.setHours(hours, minutes, 0, 0);
              
              // If the calculated time is in the past, move to the next day
              if (nextRun < now) {
                nextRun.setDate(nextRun.getDate() + 1);
              }
            }
            break;
            
          case 'weekly':
            // Move to the specified day of week
            if (typeof schedule.dayOfWeek === 'number') {
              const currentDay = nextRun.getDay();
              const daysToAdd = (schedule.dayOfWeek - currentDay + 7) % 7;
              
              nextRun.setDate(nextRun.getDate() + daysToAdd);
            } else {
              // Default to 7 days if no specific day is set
              nextRun.setDate(nextRun.getDate() + 7 * schedule.interval);
            }
            
            // Set specific time if provided
            if (schedule.specificTime && typeof schedule.specificTime === 'string') {
              const [hours, minutes] = schedule.specificTime.split(':').map(Number);
              nextRun.setHours(hours, minutes, 0, 0);
              
              // If the calculated time is in the past, move to the next week
              if (nextRun < now) {
                nextRun.setDate(nextRun.getDate() + 7);
              }
            }
            break;
            
          case 'monthly':
            // Move to the specified day of month
            if (typeof schedule.dayOfMonth === 'number') {
              nextRun.setDate(Math.min(schedule.dayOfMonth, this.getDaysInMonth(nextRun.getFullYear(), nextRun.getMonth() + 1)));
              nextRun.setMonth(nextRun.getMonth() + schedule.interval);
            } else {
              // Default to next month on same day
              nextRun.setMonth(nextRun.getMonth() + schedule.interval);
            }
            
            // Set specific time if provided
            if (schedule.specificTime && typeof schedule.specificTime === 'string') {
              const [hours, minutes] = schedule.specificTime.split(':').map(Number);
              nextRun.setHours(hours, minutes, 0, 0);
              
              // If the calculated time is in the past, move to the next month
              if (nextRun < now) {
                nextRun.setMonth(nextRun.getMonth() + 1);
              }
            }
            break;
            
          case 'custom':
            // For custom cron expressions, we'd need a cron parser library
            // For now, just set it to run 1 day from now as a placeholder
            nextRun.setDate(nextRun.getDate() + 1);
            break;
        }
      }
      console.log('knowledgeBaseIds ===========', insertUpdate.knowledgeBaseIds);
      console.log('type ===========', typeof insertUpdate.knowledgeBaseIds);

      // Ensure knowledgeBaseIds is an array
      const knowledgeBaseIdsArray = Array.isArray(insertUpdate.knowledgeBaseIds) 
        ? insertUpdate.knowledgeBaseIds 
        : (insertUpdate.knowledgeBaseIds ? [insertUpdate.knowledgeBaseIds] : []);
      
      // Prepare update data
      const updateData = {
        userId: insertUpdate.userId,
        agentId: insertUpdate.agentId || null, // Handle null agentId
        knowledgeBaseIds: JSON.stringify(knowledgeBaseIdsArray), // Store as JSON
        name: insertUpdate.name,
        schedule: insertUpdate.schedule,
        isActive: insertUpdate.isActive ?? true,
        options: {
          refreshUrls: insertUpdate.options?.refreshUrls ?? true,
          refreshPdfs: insertUpdate.options?.refreshPdfs ?? true,
          refreshYoutubeVideos: insertUpdate.options?.refreshYoutubeVideos ?? true,
          onlyOutdated: insertUpdate.options?.onlyOutdated ?? false,
          specificTags: insertUpdate.options?.specificTags || [],
          specificDocumentIds: insertUpdate.options?.specificDocumentIds || []
        },
        lastRun: null,
        nextRun,
        runHistory: JSON.stringify([]), // empty array as JSON string
        createdAt: now,
        updatedAt: now
      };
      console.log("Insert payload=========:", updateData);

      const results = await db.insert(scheduledKnowledgeUpdates).values(updateData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating scheduled knowledge update:', error);
      throw error;
    }
  }

  async updateScheduledKnowledgeUpdate(id: number, updateData: Partial<ScheduledKnowledgeUpdate>): Promise<ScheduledKnowledgeUpdate | undefined> {
    try {
      const now = new Date();
      const existingUpdate = await this.getScheduledKnowledgeUpdate(id);
      
      if (!existingUpdate) {
        return undefined;
      }
      
      const dataWithTimestamp = {
        ...updateData,
        updatedAt: now
      };
      
      // Handle knowledgeBaseIds properly
      if (updateData.knowledgeBaseIds) {
        // Ensure knowledgeBaseIds is an array
        const knowledgeBaseIdsArray = Array.isArray(updateData.knowledgeBaseIds) 
          ? updateData.knowledgeBaseIds 
          : [updateData.knowledgeBaseIds];
        
        dataWithTimestamp.knowledgeBaseIds = JSON.stringify(knowledgeBaseIdsArray);
      }
      
      // Handle options properly
      if (updateData.options) {
        const options = {
          refreshUrls: updateData.options.refreshUrls ?? existingUpdate.options.refreshUrls,
          refreshPdfs: updateData.options.refreshPdfs ?? existingUpdate.options.refreshPdfs,
          refreshYoutubeVideos: updateData.options.refreshYoutubeVideos ?? existingUpdate.options.refreshYoutubeVideos,
          onlyOutdated: updateData.options.onlyOutdated ?? existingUpdate.options.onlyOutdated,
          specificTags: updateData.options.specificTags || [],
          specificDocumentIds: updateData.options.specificDocumentIds || []
        };
        
        dataWithTimestamp.options = options;
      }
      
      // If the schedule was changed, recalculate the nextRun time
      if (updateData.schedule && 
          JSON.stringify(existingUpdate.schedule) !== JSON.stringify(updateData.schedule)) {
        
        // Create a temporary object to calculate new nextRun
        // Parse the knowledgeBaseIds from JSON string back to an array
        let knowledgeBaseIds = [];
        try {
          const knowledgeBaseIdsString = existingUpdate.knowledgeBaseIds as string;
          knowledgeBaseIds = JSON.parse(knowledgeBaseIdsString);
        } catch (error) {
          console.error('Error parsing knowledgeBaseIds:', error);
          knowledgeBaseIds = [];
        }
        
        const newSchedule = {
          userId: existingUpdate.userId,
          agentId: existingUpdate.agentId,
          knowledgeBaseIds: knowledgeBaseIds,
          name: existingUpdate.name,
          schedule: updateData.schedule,
          isActive: existingUpdate.isActive,
          options: existingUpdate.options
        };
        
        // Reuse the logic from createScheduledKnowledgeUpdate
        const tmpUpdate = await this.createScheduledKnowledgeUpdate(newSchedule);
        
        // Update the nextRun date using the calculated value
        dataWithTimestamp.nextRun = tmpUpdate.nextRun;
        
        // Delete the temporary entry
        await db.delete(scheduledKnowledgeUpdates).where(eq(scheduledKnowledgeUpdates.id, tmpUpdate.id));
      }
      
      const results = await db.update(scheduledKnowledgeUpdates)
        .set(dataWithTimestamp)
        .where(eq(scheduledKnowledgeUpdates.id, id))
        .returning();
      
      return results[0];
    } catch (error) {
      console.error('Error updating scheduled knowledge update:', error);
      throw error;
    }
  }

  async deleteScheduledKnowledgeUpdate(id: number): Promise<boolean> {
    const results = await db.delete(scheduledKnowledgeUpdates)
      .where(eq(scheduledKnowledgeUpdates.id, id))
      .returning();
    return results.length > 0;
  }

  async runScheduledKnowledgeUpdateNow(id: number): Promise<{ success: boolean; message: string; documentsProcessed?: number }> {
    try {
      const scheduledUpdate = await this.getScheduledKnowledgeUpdate(id);
      if (!scheduledUpdate) {
        return { success: false, message: 'Scheduled update not found' };
      }

      const now = new Date();
      let documentsProcessed = 0;

      // Parse knowledgeBaseIds from JSON string
      let knowledgeBaseIds: number[] = [];
      try {
        if (typeof scheduledUpdate.knowledgeBaseIds === 'string') {
          knowledgeBaseIds = JSON.parse(scheduledUpdate.knowledgeBaseIds);
        } else if (Array.isArray(scheduledUpdate.knowledgeBaseIds)) {
          knowledgeBaseIds = scheduledUpdate.knowledgeBaseIds;
        }
      } catch (error) {
        console.error('Error parsing knowledgeBaseIds:', error);
        knowledgeBaseIds = [];
      }

      // Process each knowledge base
      for (const kbId of knowledgeBaseIds) {
        try {
          const knowledgeBase = await this.getKnowledgeBase(kbId);
          if (!knowledgeBase) {
            console.warn(`Knowledge base ${kbId} not found, skipping`);
            continue;
          }

          // Get documents in this knowledge base
          const documents = await this.getDocumentsByKnowledgeBaseId(kbId);
          
          // Apply filtering based on options
          const options = scheduledUpdate.options;
          let documentsToProcess = documents;

          if (options.onlyOutdated) {
            // Filter to only outdated documents (simplified logic)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7); // Consider documents older than 7 days as outdated
            documentsToProcess = documents.filter(doc => 
              doc.updatedAt && new Date(doc.updatedAt) < cutoffDate
            );
          }

          if (options.specificTags && options.specificTags.length > 0) {
            documentsToProcess = documentsToProcess.filter(doc => {
              if (!doc.tags) return false;
              const docTags = Array.isArray(doc.tags) ? doc.tags : [];
              return options.specificTags!.some(tag => docTags.includes(tag));
            });
          }

          if (options.specificDocumentIds && options.specificDocumentIds.length > 0) {
            documentsToProcess = documentsToProcess.filter(doc => 
              options.specificDocumentIds!.includes(doc.id)
            );
          }

          // Process documents based on type
          for (const document of documentsToProcess) {
            try {
              const shouldProcess = (
                (options.refreshUrls && document.sourceType === 'url') ||
                (options.refreshPdfs && document.sourceType === 'pdf') ||
                (options.refreshYoutubeVideos && document.sourceType === 'youtube') ||
                (!options.refreshUrls && !options.refreshPdfs && !options.refreshYoutubeVideos) // Process all if none specified
              );

              if (shouldProcess) {
                // Update document's lastProcessed timestamp
                await this.updateDocument(document.id, {
                  updatedAt: now
                });
                documentsProcessed++;
              }
            } catch (docError) {
              console.error(`Error processing document ${document.id}:`, docError);
            }
          }
        } catch (kbError) {
          console.error(`Error processing knowledge base ${kbId}:`, kbError);
        }
      }

      // Update the scheduled update's run history
      let runHistory: any[] = [];
      try {
        if (typeof scheduledUpdate.runHistory === 'string') {
          runHistory = JSON.parse(scheduledUpdate.runHistory);
        } else if (Array.isArray(scheduledUpdate.runHistory)) {
          runHistory = scheduledUpdate.runHistory;
        }
      } catch (error) {
        console.error('Error parsing run history:', error);
        runHistory = [];
      }

      // Add this run to history
      runHistory.push({
        timestamp: now,
        documentsProcessed,
        success: true,
        triggeredManually: true
      });

      // Keep only the last 10 runs
      if (runHistory.length > 10) {
        runHistory = runHistory.slice(-10);
      }

      // Update the scheduled update record
      await this.updateScheduledKnowledgeUpdate(id, {
        lastRun: now,
        runHistory: JSON.stringify(runHistory)
      });

      return {
        success: true,
        message: `Successfully processed ${documentsProcessed} documents`,
        documentsProcessed
      };
    } catch (error) {
      console.error('Error running scheduled knowledge update:', error);
      return {
        success: false,
        message: `Failed to run update: ${error.message || 'Unknown error'}`
      };
    }
  }

  // Helper method to get the number of days in a month
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }
  
  // Conversation Memory operations
  async getConversationMemory(id: number): Promise<ConversationMemory | undefined> {
    try {
      const [memory] = await db.select().from(conversationMemories).where(eq(conversationMemories.id, id));
      return memory;
    } catch (error) {
      console.error('Error getting conversation memory:', error);
      return undefined;
    }
  }
  
  async getConversationMemoryByConversationId(conversationId: number): Promise<ConversationMemory | undefined> {
    try {
      const [memory] = await db.select().from(conversationMemories).where(eq(conversationMemories.conversationId, conversationId));
      return memory;
    } catch (error) {
      console.error('Error getting conversation memory by conversation ID:', error);
      return undefined;
    }
  }
  
  async createConversationMemory(memory: InsertConversationMemory): Promise<ConversationMemory> {
    try {
      const [newMemory] = await db.insert(conversationMemories).values(memory).returning();
      return newMemory;
    } catch (error) {
      console.error('Error creating conversation memory:', error);
      throw error;
    }
  }
  
  async updateConversationMemory(id: number, memoryData: Partial<ConversationMemory>): Promise<ConversationMemory | undefined> {
    try {
      // Always update the lastUpdatedAt timestamp
      const now = new Date();
      const [updatedMemory] = await db
        .update(conversationMemories)
        .set({ ...memoryData, lastUpdatedAt: now })
        .where(eq(conversationMemories.id, id))
        .returning();
      
      return updatedMemory;
    } catch (error) {
      console.error('Error updating conversation memory:', error);
      return undefined;
    }
  }
  
  async deleteConversationMemory(id: number): Promise<boolean> {
    try {
      await db.delete(conversationMemories).where(eq(conversationMemories.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting conversation memory:', error);
      return false;
    }
  }

  // Legacy team methods removed - using optimized TeamAdapter instead
  async getTeamById(id: number): Promise<Team | undefined> {
    try {
      console.log(`PostgresqlAdapter.getTeamById: Fetching team with ID ${id}`);
      const results = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
      const team = results[0];
      console.log(`PostgresqlAdapter.getTeamById: Team ${id} data:`, team);
      return team;
    } catch (error) {
      console.error(`PostgresqlAdapter.getTeamById: Error getting team ${id}:`, error);
      return undefined;
    }
  }
  
  async getTeamsByOwnerId(ownerId: number): Promise<Team[]> {
    try {
      return await db.select().from(teams).where(eq(teams.ownerId, ownerId));
    } catch (error) {
      console.error('Error getting teams by owner ID:', error);
      return [];
    }
  }
  
  // Legacy team member methods removed - using optimized TeamAdapter instead

  async getTeamMembersByTeamId(teamId: number): Promise<TeamMember[]> {
    try {
      return await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));
    } catch (error) {
      console.error('Error getting team members by team ID:', error);
      return [];
    }
  }
  
  async getTeamMembershipsByUserId(userId: number): Promise<TeamMember[]> {
    try {
      return await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId));
    } catch (error) {
      console.error('Error getting team memberships by user ID:', error);
      return [];
    }
  }

  async checkTeamAccess(teamId: number, userId: number): Promise<boolean> {
    try {
      // Check if user is team owner
      const team = await this.getTeamById(teamId);
      if (team && team.ownerId === userId) {
        return true;
      }

      // Check if user is team member
      return await this.isTeamMember(userId, teamId);
    } catch (error) {
      console.error('Error checking team access:', error);
      return false;
    }
  }

  // getUserTeamRole moved to TeamAdapter

  async getTeamMemberCount(teamId: number): Promise<number> {
    try {
      const results = await db
        .select({ count: count() })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.status, 'active')
        ));

      return results[0]?.count || 0;
    } catch (error) {
      console.error('Error getting team member count:', error);
      return 0;
    }
  }

  async getTeamRecentActivity(teamId: number, limit: number = 10): Promise<ActivityLog[]> {
    try {
      return await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.teamId, teamId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting team recent activity:', error);
      return [];
    }
  }

  async getTeamSharedResources(teamId: number): Promise<{
    knowledgeBases: any[];
    agents: any[];
    conversations: any[];
  }> {
    try {
      // Get team resource permissions
      const permissions = await db
        .select()
        .from(teamResourcePermissions)
        .where(eq(teamResourcePermissions.teamId, teamId));

      // Group by resource type
      const knowledgeBaseIds = permissions
        .filter(p => p.resourceType === 'knowledgeBase')
        .map(p => p.resourceId);
      
      const agentIds = permissions
        .filter(p => p.resourceType === 'agent')
        .map(p => p.resourceId);

      // Fetch actual resources (simplified for now)
      const knowledgeBases = knowledgeBaseIds.length > 0 
        ? await db.select().from(knowledgeBases).where(inArray(knowledgeBases.id, knowledgeBaseIds))
        : [];

      const agents = agentIds.length > 0
        ? await db.select().from(agents).where(inArray(agents.id, agentIds))
        : [];

      return {
        knowledgeBases,
        agents,
        conversations: [] // TODO: Implement conversation sharing
      };
    } catch (error) {
      console.error('Error getting team shared resources:', error);
      return { knowledgeBases: [], agents: [], conversations: [] };
    }
  }

  // getTeamStats moved to TeamAdapter

  // updateTeam moved to TeamAdapter
  
  // createTeamMember moved to TeamAdapter
  
  // updateTeamMember moved to TeamAdapter
  
  // deleteTeamMember moved to TeamAdapter
  
  // Team invitation methods moved to TeamAdapter

  // Advanced team invitation operations
  async resendTeamInvitation(invitationId: number, userId: number): Promise<boolean> {
    try {
      // Get the invitation
      const invitation = await this.getTeamInvitation(invitationId);
      if (!invitation) {
        return false;
      }

      // Update the invitation with new expiry
      const newExpiry = new Date();
      newExpiry.setHours(newExpiry.getHours() + 48); // 48 hours from now

      await this.updateTeamInvitation(invitationId, {
        expiresAt: newExpiry,
        status: 'pending'
      });

      // Here we would send the email notification
      // This will be handled by the service layer
      return true;
    } catch (error) {
      console.error('Error resending team invitation:', error);
      return false;
    }
  }

  async acceptTeamInvitation(token: string, userId: number): Promise<TeamMember | null> {
    try {
      // Get invitation by token
      const invitation = await this.getTeamInvitationByToken(token);
      if (!invitation) {
        return null;
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        return null;
      }

      // Create team member
      const teamMember = await this.addTeamMember({
        teamId: invitation.teamId,
        userId: userId,
        role: invitation.role || 'member',
        permissions: invitation.permissions || [],
        invitedBy: invitation.invitedByUserId
      });

      // Update invitation status
      await this.updateTeamInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedByUserId: userId
      });

      return teamMember;
    } catch (error) {
      console.error('Error accepting team invitation:', error);
      return null;
    }
  }

  async verifyTeamInvitationToken(token: string): Promise<{ invitation: TeamInvitation; teamName: string } | null> {
    try {
      // Get invitation by token
      const invitation = await this.getTeamInvitationByToken(token);
      if (!invitation) {
        return null;
      }

      // Check if invitation is valid
      if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        return null;
      }

      // Get team name
      const team = await this.getTeam(invitation.teamId);
      if (!team) {
        return null;
      }

      return {
        invitation,
        teamName: team.name
      };
    } catch (error) {
      console.error('Error verifying team invitation token:', error);
      return null;
    }
  }

  // isTeamMember moved to TeamAdapter

  async hasTeamAccess(teamId: number, userId: number): Promise<boolean> {
    try {
      return await this.isTeamMember(userId, teamId);
    } catch (error) {
      console.error('Error checking team access:', error);
      return false;
    }
  }

  async hasTeamPermission(userId: number, teamId: number, permission: string): Promise<boolean> {
    try {
      console.log(`PostgresqlAdapter.hasTeamPermission: Checking permission '${permission}' for user ${userId} in team ${teamId}`);
      
      // FIRST: Check team owner permissions (team owners have all permissions, regardless of membership status)
      const team = await this.getTeamById(teamId);
      console.log(`PostgresqlAdapter.hasTeamPermission: Team ${teamId} data:`, team);
      if (team && team.ownerId === userId) {
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} is owner of team ${teamId}, granting permission '${permission}'`);
        return true;
      } else {
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} is NOT owner of team ${teamId}. Team owner: ${team?.ownerId}, Required user: ${userId}`);
      }
      
      // SECOND: Check if user is a team member
      const member = await this.getTeamMember(teamId, userId);
      if (!member || member.status !== 'active') {
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} is not an active member of team ${teamId} and not the owner`);
        return false;
      }
      
      // THIRD: Check admin role permissions
      if (member.role === 'admin') {
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} has admin role in team ${teamId}, granting permission '${permission}'`);
        return true;
      }
      
      // FOURTH: Check if user has the specific permission in their permissions array
      if (member.permissions && Array.isArray(member.permissions)) {
        const hasPermission = member.permissions.includes(permission);
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} ${hasPermission ? 'has' : 'does not have'} permission '${permission}' in team ${teamId}`);
        return hasPermission;
      }
      
      // FIFTH: For member role, check basic permissions
      if (member.role === 'member') {
        const basicPermissions = ['read', 'view'];
        const hasBasicPermission = basicPermissions.includes(permission);
        console.log(`PostgresqlAdapter.hasTeamPermission: User ${userId} has member role, ${hasBasicPermission ? 'granting' : 'denying'} permission '${permission}'`);
        return hasBasicPermission;
      }
      
      console.log(`PostgresqlAdapter.hasTeamPermission: No matching permission found for user ${userId} in team ${teamId} for permission '${permission}'`);
      return false;
    } catch (error) {
      console.error(`PostgresqlAdapter.hasTeamPermission: Error checking team permission for user ${userId} in team ${teamId}:`, error);
      return false;
    }
  }
  
  // Activity Log operations
  async getActivityLog(id: number): Promise<ActivityLog | undefined> {
    try {
      const results = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.id, id))
        .limit(1);
        
      return results[0];
    } catch (error) {
      console.error('Error getting activity log:', error);
      return undefined;
    }
  }
  
  async getActivityLogsByTeamId(teamId: number): Promise<ActivityLog[]> {
    try {
      // First get the basic activity logs
      const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.teamId, teamId))
        .orderBy(sql`${activityLogs.createdAt} DESC`);

      // For each log, get the user's name and attach it
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const user = await this.getUser(log.userId);
        return {
          ...log,
          userName: user ? user.name : 'Unknown User' // Add userName property
        };
      }));

      return enrichedLogs;
    } catch (error) {
      console.error('Error getting activity logs by team ID:', error);
      return [];
    }
  }
  
  async getTeamActivityLogs(teamId: number, page?: number, limit?: number): Promise<ActivityLog[]> {
    try {
      const offset = ((page || 1) - 1) * (limit || 50);
      const limitValue = limit || 50;
      
      const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.teamId, teamId))
        .orderBy(sql`${activityLogs.createdAt} DESC`)
        .limit(limitValue)
        .offset(offset);

      // Enrich logs with user names
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const user = await this.getUser(log.userId);
        return {
          ...log,
          userName: user ? user.name : 'Unknown User'
        };
      }));

      return enrichedLogs;
    } catch (error) {
      console.error('Error getting team activity logs:', error);
      return [];
    }
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    try {
      const activityData = {
        teamId: log.teamId || null,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details || {},
        ipAddress: log.ipAddress || null,
        userAgent: log.userAgent || null
      };
      
      const results = await db.insert(activityLogs).values(activityData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  // Integration Provider operations
  async getIntegrationProvider(id: number): Promise<IntegrationProvider | undefined> {
    try {
      const results = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting integration provider:', error);
      return undefined;
    }
  }

  async getIntegrationProviderByType(type: string): Promise<IntegrationProvider | undefined> {
    try {
      const results = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.type, type))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting integration provider by type:', error);
      return undefined;
    }
  }

  async getAllIntegrationProviders(): Promise<IntegrationProvider[]> {
    try {
      return await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.isActive, true))
        .orderBy(integrationProviders.name);
    } catch (error) {
      console.error('Error getting all integration providers:', error);
      return [];
    }
  }

  async createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider> {
    try {
      const now = new Date();
      const providerData = {
        name: provider.name,
        type: provider.type,
        description: provider.description || null,
        logoUrl: provider.logoUrl || null,
        isActive: provider.isActive !== undefined ? provider.isActive : true,
        oauthEnabled: provider.oauthEnabled !== undefined ? provider.oauthEnabled : false,
        oauthConfig: provider.oauthConfig || null,
        configSchema: provider.configSchema || null,
        updatedAt: now
      };
      
      const results = await db.insert(integrationProviders).values(providerData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating integration provider:', error);
      throw error;
    }
  }

  async updateIntegrationProvider(id: number, providerData: Partial<IntegrationProvider>): Promise<IntegrationProvider | undefined> {
    try {
      // Always update the updatedAt timestamp
      const dataWithTimestamp = {
        ...providerData,
        updatedAt: new Date()
      };
      
      const results = await db.update(integrationProviders)
        .set(dataWithTimestamp)
        .where(eq(integrationProviders.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error updating integration provider:', error);
      throw error;
    }
  }

  // Integration operations
  async getIntegration(id: number): Promise<Integration | undefined> {
    try {
      const results = await db
        .select()
        .from(integrations)
        .where(eq(integrations.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting integration:', error);
      return undefined;
    }
  }

  async getIntegrationsByUserId(userId: number): Promise<Integration[]> {
    try {
      return await db
        .select()
        .from(integrations)
        .where(eq(integrations.userId, userId))
        .orderBy(integrations.name);
    } catch (error) {
      console.error('Error getting integrations by user ID:', error);
      return [];
    }
  }

  async getIntegrationsByTeamId(teamId: number): Promise<Integration[]> {
    try {
      return await db
        .select()
        .from(integrations)
        .where(eq(integrations.teamId, teamId))
        .orderBy(integrations.name);
    } catch (error) {
      console.error('Error getting integrations by team ID:', error);
      return [];
    }
  }

  async getIntegrationsByProviderId(providerId: number): Promise<Integration[]> {
    try {
      return await db
        .select()
        .from(integrations)
        .where(eq(integrations.providerId, providerId))
        .orderBy(integrations.name);
    } catch (error) {
      console.error('Error getting integrations by provider ID:', error);
      return [];
    }
  }

  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    try {
      const now = new Date();
      const integrationData = {
        name: integration.name,
        providerId: integration.providerId,
        userId: integration.userId,
        teamId: integration.teamId,
        status: integration.status || 'inactive',
        description: integration.description || null,
        config: integration.config || {},
        credentials: integration.credentials || {},
        lastSyncedAt: null,
        lastErrorMessage: null,
        updatedAt: now
      };
      
      const results = await db.insert(integrations).values(integrationData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating integration:', error);
      throw error;
    }
  }

  async updateIntegration(id: number, integrationData: Partial<Integration>): Promise<Integration | undefined> {
    try {
      // Always update the updatedAt timestamp
      const dataWithTimestamp = {
        ...integrationData,
        updatedAt: new Date()
      };
      
      const results = await db.update(integrations)
        .set(dataWithTimestamp)
        .where(eq(integrations.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error updating integration:', error);
      throw error;
    }
  }

  async deleteIntegration(id: number): Promise<boolean> {
    try {
      // Use a transaction to delete the integration and related logs
      return await db.transaction(async (tx) => {
        // Delete any associated logs first
        await tx.delete(integrationLogs)
          .where(eq(integrationLogs.integrationId, id));
        
        // Then delete the integration itself
        const results = await tx.delete(integrations)
          .where(eq(integrations.id, id))
          .returning();
        
        return results.length > 0;
      });
    } catch (error) {
      console.error('Error deleting integration:', error);
      throw error;
    }
  }

  // Integration Log operations
  async getIntegrationLog(id: number): Promise<IntegrationLog | undefined> {
    try {
      const results = await db
        .select()
        .from(integrationLogs)
        .where(eq(integrationLogs.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting integration log:', error);
      return undefined;
    }
  }

  async getIntegrationLogsByIntegrationId(integrationId: number): Promise<IntegrationLog[]> {
    try {
      return await db
        .select()
        .from(integrationLogs)
        .where(eq(integrationLogs.integrationId, integrationId))
        .orderBy(sql`${integrationLogs.createdAt} DESC`);
    } catch (error) {
      console.error('Error getting integration logs by integration ID:', error);
      return [];
    }
  }

  async createIntegrationLog(log: InsertIntegrationLog): Promise<IntegrationLog> {
    try {
      const logData = {
        integrationId: log.integrationId,
        message: log.message,
        eventType: log.eventType,
        details: log.details || {}
      };
      
      const results = await db.insert(integrationLogs).values(logData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating integration log:', error);
      throw error;
    }
  }

  // Usage Metrics operations
  async trackDailyUsageMetric(
    userId: number,
    metricType: string,
    metricValue: number,
    options?: {
      teamId?: number,
      region?: string,
      storageType?: string,
      source?: string,
      metadata?: any
    }
  ): Promise<DailyUsageMetric> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      // First check if there's an existing metric for today with the same type
      const existingMetrics = await db.select()
        .from(dailyUsageMetrics)
        .where(
          and(
            eq(dailyUsageMetrics.userId, userId),
            eq(dailyUsageMetrics.metricType, metricType),
            eq(dailyUsageMetrics.date, today),
            options?.teamId ? eq(dailyUsageMetrics.teamId, options.teamId) : sql`true`,
            options?.region ? eq(dailyUsageMetrics.region, options.region) : sql`true`,
            options?.storageType ? eq(dailyUsageMetrics.storageType, options.storageType) : sql`true`,
            options?.source ? eq(dailyUsageMetrics.source, options.source) : sql`true`
          )
        );

      // If metric exists for today, update it by incrementing the value
      if (existingMetrics.length > 0) {
        const existingMetric = existingMetrics[0];
        const updatedMetric = await db.update(dailyUsageMetrics)
          .set({
            metricValue: existingMetric.metricValue + metricValue,
            updatedAt: new Date()
          })
          .where(eq(dailyUsageMetrics.id, existingMetric.id))
          .returning();
        
        return updatedMetric[0];
      }
      
      // Otherwise, create a new metric
      const newMetric = {
        userId,
        metricType,
        metricValue,
        date: today,
        teamId: options?.teamId || null,
        region: options?.region || null,
        storageType: options?.storageType || null,
        source: options?.source || null,
        metadata: options?.metadata || {}
      };
      
      const results = await db.insert(dailyUsageMetrics).values(newMetric).returning();
      return results[0];
    } catch (error) {
      console.error('Error tracking daily usage metric:', error);
      throw error;
    }
  }
  
  async getDailyUsageMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      metricType?: string | string[],
      groupBy?: string
    }
  ): Promise<DailyUsageMetric[]> {
    try {
      // Default to last 30 days if no date range provided
      const now = new Date();
      const endDate = params.endDate || now.toISOString().split('T')[0];
      
      let startDate: string;
      if (params.startDate) {
        startDate = params.startDate;
      } else {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
      }
      
      // Build query conditions
      let query = db.select()
        .from(dailyUsageMetrics)
        .where(
          and(
            eq(dailyUsageMetrics.userId, userId),
            sql`${dailyUsageMetrics.date} >= ${startDate}`,
            sql`${dailyUsageMetrics.date} <= ${endDate}`
          )
        );
      
      // Add team filter if provided
      if (params.teamId) {
        query = query.where(eq(dailyUsageMetrics.teamId, params.teamId));
      }
      
      // Add metric type filter if provided
      if (params.metricType) {
        if (Array.isArray(params.metricType)) {
          query = query.where(inArray(dailyUsageMetrics.metricType, params.metricType));
        } else {
          query = query.where(eq(dailyUsageMetrics.metricType, params.metricType));
        }
      }
      
      // Execute the query and return results
      return await query;
    } catch (error) {
      console.error('Error getting daily usage metrics:', error);
      throw error;
    }
  }
  
  async getUsageSummary(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      currentPeriodOnly?: boolean
    }
  ): Promise<Record<string, { current: number, lifetime: number }>> {
    try {
      // Calculate current period (e.g., this month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      // For lifetime metrics, use all data or custom date range if provided
      const lifetimeStart = params.startDate || '2020-01-01'; // Arbitrary past date
      const lifetimeEnd = params.endDate || now.toISOString().split('T')[0];
      
      // Query for current period metrics
      const currentPeriodMetrics = await db.select({
        metricType: dailyUsageMetrics.metricType,
        total: sql<number>`sum(${dailyUsageMetrics.metricValue})`
      })
      .from(dailyUsageMetrics)
      .where(
        and(
          eq(dailyUsageMetrics.userId, userId),
          sql`${dailyUsageMetrics.date} >= ${firstDayOfMonth}`,
          sql`${dailyUsageMetrics.date} <= ${lastDayOfMonth}`,
          params.teamId ? eq(dailyUsageMetrics.teamId, params.teamId) : sql`true`
        )
      )
      .groupBy(dailyUsageMetrics.metricType);
      
      // If only current period is requested, return early
      if (params.currentPeriodOnly) {
        const summary: Record<string, { current: number, lifetime: number }> = {};
        
        for (const metric of currentPeriodMetrics) {
          summary[metric.metricType] = {
            current: metric.total || 0,
            lifetime: metric.total || 0
          };
        }
        
        return summary;
      }
      
      // Query for lifetime metrics
      const lifetimeMetrics = await db.select({
        metricType: dailyUsageMetrics.metricType,
        total: sql<number>`sum(${dailyUsageMetrics.metricValue})`
      })
      .from(dailyUsageMetrics)
      .where(
        and(
          eq(dailyUsageMetrics.userId, userId),
          sql`${dailyUsageMetrics.date} >= ${lifetimeStart}`,
          sql`${dailyUsageMetrics.date} <= ${lifetimeEnd}`,
          params.teamId ? eq(dailyUsageMetrics.teamId, params.teamId) : sql`true`
        )
      )
      .groupBy(dailyUsageMetrics.metricType);
      
      // Combine results
      const summary: Record<string, { current: number, lifetime: number }> = {};
      
      // Add current period metrics
      for (const metric of currentPeriodMetrics) {
        summary[metric.metricType] = {
          current: metric.total || 0,
          lifetime: 0 // Will be updated from lifetime metrics
        };
      }
      
      // Add/update lifetime metrics
      for (const metric of lifetimeMetrics) {
        if (summary[metric.metricType]) {
          summary[metric.metricType].lifetime = metric.total || 0;
        } else {
          summary[metric.metricType] = {
            current: 0,
            lifetime: metric.total || 0
          };
        }
      }
      
      return summary;
    } catch (error) {
      console.error('Error getting usage summary:', error);
      throw error;
    }
  }

  async getDailyMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      granularity?: string
    }
  ): Promise<DailyUsageMetric[]> {
    try {
      // Default to last 30 days if no date range provided
      const now = new Date();
      const endDate = params.endDate || now.toISOString().split('T')[0];
      
      let startDate: string;
      if (params.startDate) {
        startDate = params.startDate;
      } else {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
      }
      
      // Build query conditions
      const conditions = [
        eq(dailyUsageMetrics.userId, userId),
        sql`${dailyUsageMetrics.date} >= ${startDate}`,
        sql`${dailyUsageMetrics.date} <= ${endDate}`
      ];
      
      // Add team filter if provided
      if (params.teamId) {
        conditions.push(eq(dailyUsageMetrics.teamId, params.teamId));
      }
      
      // Execute the query and return results ordered by date
      const results = await db.select()
        .from(dailyUsageMetrics)
        .where(and(...conditions))
        .orderBy(dailyUsageMetrics.date, dailyUsageMetrics.metricType);
      
      return results;
    } catch (error) {
      console.error('Error getting daily metrics:', error);
      throw error;
    }
  }
  
  async getRegionalMetrics(
    userId: number,
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ region: string, value: number }[]> {
    try {
      // Set default date range to last 30 days if not provided
      const now = new Date();
      const endDate = params.endDate || now.toISOString().split('T')[0];
      
      let startDate: string;
      if (params.startDate) {
        startDate = params.startDate;
      } else {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
      }
      
      // Use raw SQL to avoid column name conflicts
      const query = sql`
        SELECT 
          region, 
          SUM(metric_value) AS total_value
        FROM daily_usage_metrics
        WHERE 
          user_id = ${userId}
          AND date >= ${startDate}
          AND date <= ${endDate}
          AND region IS NOT NULL
          ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
        GROUP BY region
        ORDER BY total_value DESC
        LIMIT ${params.limit || 10}
      `;
      
      const regionalMetrics = await db.execute(query);
      
      return regionalMetrics.map(item => ({
        region: item.region || 'unknown',
        value: Number(item.total_value) || 0
      }));
    } catch (error) {
      console.error('Error getting regional metrics:', error);
      throw error;
    }
  }
  
  async getStorageUtilization(
    userId: number,
    params: {
      teamId?: number
    }
  ): Promise<{ type: string, sizeKb: number }[]> {
    try {
      // Use raw SQL to avoid column name conflicts
      const query = sql`
        SELECT 
          storage_type AS type, 
          SUM(metric_value) AS total_size
        FROM daily_usage_metrics
        WHERE 
          user_id = ${userId}
          AND storage_type IS NOT NULL
          AND metric_type = 'storage_usage'
          ${params.teamId ? sql`AND team_id = ${params.teamId}` : sql``}
        GROUP BY storage_type
        ORDER BY total_size DESC
      `;
      
      const storageMetrics = await db.execute(query);
      
      return storageMetrics.map(item => ({
        type: item.type || 'unknown',
        sizeKb: Number(item.total_size) || 0
      }));
    } catch (error) {
      console.error('Error getting storage utilization:', error);
      throw error;
    }
  }

  // Team Resource Permission operations
  async getTeamResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<TeamResourcePermission | undefined> {
    try {
      const results = await db.select()
        .from(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.teamId, teamId),
            eq(teamResourcePermissions.resourceType, resourceType),
            eq(teamResourcePermissions.resourceId, resourceId)
          )
        )
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting team resource permission:', error);
      throw error;
    }
  }

  async getTeamResourcePermissionsByTeamId(teamId: number, resourceType?: ResourceType): Promise<TeamResourcePermission[]> {
    try {
      let query = db.select()
        .from(teamResourcePermissions)
        .where(eq(teamResourcePermissions.teamId, teamId));

      if (resourceType) {
        query = query.where(eq(teamResourcePermissions.resourceType, resourceType));
      }

      return await query;
    } catch (error) {
      console.error('Error getting team resource permissions by team ID:', error);
      throw error;
    }
  }

  async getTeamResourcePermissionsByResourceTypeAndId(resourceType: ResourceType, resourceId: number): Promise<TeamResourcePermission[]> {
    try {
      return await db.select()
        .from(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.resourceType, resourceType),
            eq(teamResourcePermissions.resourceId, resourceId)
          )
        );
    } catch (error) {
      console.error('Error getting team resource permissions by resource type and ID:', error);
      throw error;
    }
  }

  async createTeamResourcePermission(permission: InsertTeamResourcePermission): Promise<TeamResourcePermission> {
    try {
      const results = await db.insert(teamResourcePermissions)
        .values({
          teamId: permission.teamId,
          resourceType: permission.resourceType,
          resourceId: permission.resourceId,
          permissions: permission.permissions || [],
          grantedBy: permission.grantedBy
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error creating team resource permission:', error);
      throw error;
    }
  }

  async updateTeamResourcePermission(id: number, permission: Partial<TeamResourcePermission>): Promise<TeamResourcePermission | undefined> {
    try {
      const updateData = {
        ...permission,
        updatedAt: new Date()
      };
      
      const results = await db.update(teamResourcePermissions)
        .set(updateData)
        .where(eq(teamResourcePermissions.id, id))
        .returning();
        
      return results[0];
    } catch (error) {
      console.error('Error updating team resource permission:', error);
      return undefined;
    }
  }

  async deleteTeamResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
    try {
      const result = await db.delete(teamResourcePermissions)
        .where(
          and(
            eq(teamResourcePermissions.teamId, teamId),
            eq(teamResourcePermissions.resourceType, resourceType),
            eq(teamResourcePermissions.resourceId, resourceId)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting team resource permission:', error);
      throw error;
    }
  }

  // Member Resource Permission operations
  async getMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<MemberResourcePermission | undefined> {
    try {
      const results = await db.select()
        .from(memberResourcePermissions)
        .where(
          and(
            eq(memberResourcePermissions.teamId, teamId),
            eq(memberResourcePermissions.userId, userId),
            eq(memberResourcePermissions.resourceType, resourceType),
            eq(memberResourcePermissions.resourceId, resourceId)
          )
        )
        .limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting member resource permission:', error);
      throw error;
    }
  }

  async getMemberResourcePermissionsByTeamAndUser(teamId: number, userId: number, resourceType?: ResourceType): Promise<MemberResourcePermission[]> {
    try {
      let query = db.select()
        .from(memberResourcePermissions)
        .where(
          and(
            eq(memberResourcePermissions.teamId, teamId),
            eq(memberResourcePermissions.userId, userId)
          )
        );

      if (resourceType) {
        query = query.where(eq(memberResourcePermissions.resourceType, resourceType));
      }

      return await query;
    } catch (error) {
      console.error('Error getting member resource permissions by team and user:', error);
      throw error;
    }
  }

  async getMemberResourcePermissionsByResource(resourceType: ResourceType, resourceId: number): Promise<MemberResourcePermission[]> {
    try {
      return await db.select()
        .from(memberResourcePermissions)
        .where(
          and(
            eq(memberResourcePermissions.resourceType, resourceType),
            eq(memberResourcePermissions.resourceId, resourceId)
          )
        );
    } catch (error) {
      console.error('Error getting member resource permissions by resource:', error);
      throw error;
    }
  }

  async createMemberResourcePermission(permission: InsertMemberResourcePermission): Promise<MemberResourcePermission> {
    try {
      const results = await db.insert(memberResourcePermissions)
        .values({
          teamId: permission.teamId,
          userId: permission.userId,
          resourceType: permission.resourceType,
          resourceId: permission.resourceId
        })
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error creating member resource permission:', error);
      throw error;
    }
  }

  async deleteMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
    try {
      const result = await db.delete(memberResourcePermissions)
        .where(
          and(
            eq(memberResourcePermissions.teamId, teamId),
            eq(memberResourcePermissions.userId, userId),
            eq(memberResourcePermissions.resourceType, resourceType),
            eq(memberResourcePermissions.resourceId, resourceId)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting member resource permission:', error);
      throw error;
    }
  }

  // Resource Access Verification
  async canAccessResource(userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
    try {
      // Check if user owns the resource directly
      let hasDirectAccess = false;
      
      if (resourceType === 'agent') {
        const agent = await this.getAgent(resourceId);
        hasDirectAccess = agent?.userId === userId;
      } else if (resourceType === 'knowledgeBase') {
        const kb = await this.getKnowledgeBase(resourceId);
        hasDirectAccess = kb?.userId === userId;
      }
      
      if (hasDirectAccess) {
        return true;
      }
      
      // Check team membership and permissions
      // Get all teams the user is a member of
      const userTeamMemberships = await this.getTeamMembershipsByUserId(userId);
      
      for (const membership of userTeamMemberships) {
        // Check if the team has permission for this resource
        const teamPermission = await this.getTeamResourcePermission(
          membership.teamId, 
          resourceType, 
          resourceId
        );
        
        if (teamPermission) {
          // Check if there's a specific override for this member
          const memberPermission = await this.getMemberResourcePermission(
            membership.teamId,
            userId,
            resourceType,
            resourceId
          );
          
          // If there's no specific member permission, the team permission grants access
          if (!memberPermission) {
            return true;
          }
        }
        
        // Check if there's a specific member permission granting access
        const memberPermission = await this.getMemberResourcePermission(
          membership.teamId,
          userId,
          resourceType,
          resourceId
        );
        
        if (memberPermission) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking resource access:', error);
      throw error;
    }
  }

  async getUserResourceAccess(userId: number, resourceType: ResourceType): Promise<{ resourceId: number, teamId?: number, accessType: 'direct' | 'team' | 'member' }[]> {
    try {
      const result: { resourceId: number, teamId?: number, accessType: 'direct' | 'team' | 'member' }[] = [];
      
      // Get directly owned resources
      if (resourceType === 'agent') {
        const ownedAgents = await this.getAgentsByUserId(userId);
        ownedAgents.forEach(agent => {
          result.push({ resourceId: agent.id, accessType: 'direct' });
        });
      } else if (resourceType === 'knowledgeBase') {
        const ownedKbs = await this.getKnowledgeBasesByUserId(userId);
        ownedKbs.forEach(kb => {
          result.push({ resourceId: kb.id, accessType: 'direct' });
        });
      }
      
      // Get team memberships
      const teamMemberships = await this.getTeamMembershipsByUserId(userId);
      
      // Check access through teams
      for (const membership of teamMemberships) {
        // Team permissions
        const teamPermissions = await this.getTeamResourcePermissionsByTeamId(
          membership.teamId,
          resourceType
        );
        
        for (const permission of teamPermissions) {
          // Only add if not already in result
          if (!result.some(r => r.resourceId === permission.resourceId)) {
            result.push({
              resourceId: permission.resourceId,
              teamId: membership.teamId,
              accessType: 'team'
            });
          }
        }
        
        // Member permissions
        const memberPermissions = await this.getMemberResourcePermissionsByTeamAndUser(
          membership.teamId,
          userId,
          resourceType
        );
        
        for (const permission of memberPermissions) {
          // Replace team permission if it exists, or add new
          const existingIndex = result.findIndex(r => 
            r.resourceId === permission.resourceId && 
            r.teamId === permission.teamId
          );
          
          if (existingIndex >= 0) {
            result[existingIndex].accessType = 'member';
          } else {
            result.push({
              resourceId: permission.resourceId,
              teamId: membership.teamId,
              accessType: 'member'
            });
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting user resource access:', error);
      throw error;
    }
  }

  // OPTIMIZED METHODS - Fix for 1000ms+ response times
  async getUserTeamResourcePermissions(userId: number, resourceType: ResourceType): Promise<TeamResourcePermission[]> {
    try {
      console.log(`[PERF] getUserTeamResourcePermissions: Starting optimized lookup for user ${userId}, resource ${resourceType}`);
      const startTime = Date.now();
      
      // Single optimized query using JOIN instead of multiple round trips
      const results = await db.select({
        id: teamResourcePermissions.id,
        teamId: teamResourcePermissions.teamId,
        resourceType: teamResourcePermissions.resourceType,
        resourceId: teamResourcePermissions.resourceId,
        createdAt: teamResourcePermissions.createdAt,
        createdBy: teamResourcePermissions.createdBy
      })
      .from(teamResourcePermissions)
      .innerJoin(teamMembers, eq(teamResourcePermissions.teamId, teamMembers.teamId))
      .where(
        and(
          eq(teamMembers.userId, userId),
          eq(teamResourcePermissions.resourceType, resourceType),
          eq(teamMembers.status, 'active')
        )
      );
      
      const endTime = Date.now();
      console.log(`[PERF] getUserTeamResourcePermissions: Completed in ${endTime - startTime}ms, found ${results.length} permissions`);
      
      return results;
    } catch (error) {
      console.error('Error getting user team resource permissions:', error);
      throw error;
    }
  }

  async getUserMemberResourcePermissions(userId: number, resourceType: ResourceType): Promise<MemberResourcePermission[]> {
    try {
      console.log(`[PERF] getUserMemberResourcePermissions: Starting optimized lookup for user ${userId}, resource ${resourceType}`);
      const startTime = Date.now();
      
      // Single optimized query for member-specific permissions
      const results = await db.select()
        .from(memberResourcePermissions)
        .where(
          and(
            eq(memberResourcePermissions.userId, userId),
            eq(memberResourcePermissions.resourceType, resourceType)
          )
        );
      
      const endTime = Date.now();
      console.log(`[PERF] getUserMemberResourcePermissions: Completed in ${endTime - startTime}ms, found ${results.length} permissions`);
      
      return results;
    } catch (error) {
      console.error('Error getting user member resource permissions:', error);
      throw error;
    }
  }

  // Subscription Plan operations
  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    try {
      const results = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting subscription plan:', error);
      return undefined;
    }
  }

  async getSubscriptionPlans(includeInactive: boolean = false): Promise<SubscriptionPlan[]> {
    try {
      if (includeInactive) {
        return await db.select().from(subscriptionPlans);
      }
      return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      return [];
    }
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    try {
      const now = new Date();
      const planData = {
        ...plan,
        createdAt: now,
        updatedAt: now,
      };
      const results = await db.insert(subscriptionPlans).values(planData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  async updateSubscriptionPlan(id: number, plan: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    try {
      const updateData = {
        ...plan,
        updatedAt: new Date(),
      };
      const results = await db.update(subscriptionPlans)
        .set(updateData)
        .where(eq(subscriptionPlans.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      return undefined;
    }
  }

  // Subscription operations
  async getSubscription(id: number): Promise<Subscription | undefined> {
    try {
      const results = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, id)).limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting subscription:', error);
      return undefined;
    }
  }

  async getUserSubscription(userId: number): Promise<Subscription | undefined> {
    try {
      const results = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return undefined;
    }
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    try {
      const now = new Date();
      const subscriptionData = {
        ...subscription,
        createdAt: now,
        updatedAt: now,
      };
      const results = await db.insert(userSubscriptions).values(subscriptionData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async updateSubscription(id: number, subscription: Partial<Subscription>): Promise<Subscription | undefined> {
    try {
      const updateData = {
        ...subscription,
        updatedAt: new Date(),
      };
      const results = await db.update(userSubscriptions)
        .set(updateData)
        .where(eq(userSubscriptions.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error updating subscription:', error);
      return undefined;
    }
  }

  // Payment operations
  async getPayment(id: number): Promise<Payment | undefined> {
    try {
      const results = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, id)).limit(1);
      return results[0];
    } catch (error) {
      console.error('Error getting payment:', error);
      return undefined;
    }
  }

  async getSubscriptionPayments(subscriptionId: number, page: number = 1, limit: number = 50): Promise<Payment[]> {
    try {
      const offset = (page - 1) * limit;
      const results = await db.select()
        .from(subscriptionPayments)
        .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
        .orderBy(desc(subscriptionPayments.createdAt))
        .limit(limit)
        .offset(offset);
      return results;
    } catch (error) {
      console.error('Error getting subscription payments:', error);
      return [];
    }
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    try {
      const paymentData = {
        ...payment,
        createdAt: new Date(),
      };
      const results = await db.insert(subscriptionPayments).values(paymentData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  // Team operations that were missing
  async getUserTeams(userId: number, options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<Team[]> {
    try {
      // Get teams where user is owner
      let ownerQuery = db.select().from(teams)
        .where(eq(teams.ownerId, userId));

      // Get teams where user is an active member
      let memberQuery = db.select()
        .from(teams)
        .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
        .where(and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active')
        ));

      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        ownerQuery = ownerQuery.where(
          sql`(${teams.name} ILIKE ${searchTerm} OR ${teams.description} ILIKE ${searchTerm})`
        );
        memberQuery = memberQuery.where(
          sql`(${teams.name} ILIKE ${searchTerm} OR ${teams.description} ILIKE ${searchTerm})`
        );
      }

      const [ownedTeams, memberResults] = await Promise.all([
        ownerQuery.orderBy(desc(teams.createdAt)),
        memberQuery.orderBy(desc(teams.createdAt))
      ]);

      // Extract team data from joined results
      const memberTeams = memberResults.map(result => result.teams);

      // Combine and deduplicate results
      const allTeams = [...ownedTeams, ...memberTeams];
      const uniqueTeams = allTeams.filter((team, index, self) => 
        index === self.findIndex(t => t.id === team.id)
      );

      // Apply pagination
      const paginatedTeams = uniqueTeams
        .slice(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50));

      return paginatedTeams;
    } catch (error) {
      console.error('Error getting user teams:', error);
      return [];
    }
  }

  async getUserTeamsCount(userId: number, filters?: {
    search?: string;
  }): Promise<number> {
    try {
      // Count teams where user is owner
      let ownerCountQuery = db.select({ count: count() }).from(teams)
        .where(eq(teams.ownerId, userId));

      // Count teams where user is an active member
      let memberCountQuery = db.select({ count: count() }).from(teams)
        .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
        .where(and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active')
        ));

      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        ownerCountQuery = ownerCountQuery.where(
          sql`(${teams.name} ILIKE ${searchTerm} OR ${teams.description} ILIKE ${searchTerm})`
        );
        memberCountQuery = memberCountQuery.where(
          sql`(${teams.name} ILIKE ${searchTerm} OR ${teams.description} ILIKE ${searchTerm})`
        );
      }

      const [ownerResult, memberResult] = await Promise.all([
        ownerCountQuery,
        memberCountQuery
      ]);

      const ownerCount = ownerResult[0]?.count || 0;
      const memberCount = memberResult[0]?.count || 0;

      // Note: This might double-count if user is both owner and member of the same team
      // For accurate count, we'd need to use the same logic as getUserTeams
      return ownerCount + memberCount;
    } catch (error) {
      console.error('Error getting user teams count:', error);
      return 0;
    }
  }

  async getLLMApiKeys(userId: number): Promise<ApiKey[]> {
    try {
      return await this.getApiKeysByUserId(userId);
    } catch (error) {
      console.error('Error getting LLM API keys:', error);
      return [];
    }
  }

  async getConversations(userId: number, options?: {
    limit?: number;
    offset?: number;
    includeShared?: boolean;
    search?: string;
  }): Promise<Conversation[]> {
    try {
      let query = db.select().from(conversations).where(eq(conversations.userId, userId));

      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        query = query.where(sql`${conversations.title} ILIKE ${searchTerm}`);
      }

      const results = await query
        .orderBy(desc(conversations.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0);

      return results;
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  async getConversationsCount(userId: number, filters?: {
    search?: string;
    includeShared?: boolean;
  }): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(conversations).where(eq(conversations.userId, userId));

      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.where(sql`${conversations.title} ILIKE ${searchTerm}`);
      }

      const result = await query;
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting conversations count:', error);
      return 0;
    }
  }

  // Knowledge base analytics methods
  async getKnowledgeBaseTotalQueries(knowledgeBaseId: number): Promise<number> {
    try {
      // Count conversations associated with agents that use this knowledge base
      const result = await db.select({ count: count() })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(sql`${agents.knowledgeBaseIds} @> '[${knowledgeBaseId}]'::jsonb`);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting knowledge base total queries:', error);
      return 0;
    }
  }

  async getKnowledgeBaseStorageUsed(knowledgeBaseId: number): Promise<number> {
    try {
      // Calculate storage based on document content length
      const result = await db.select({ 
        totalSize: sql<number>`COALESCE(SUM(LENGTH(${documents.content})), 0)` 
      })
        .from(documents)
        .where(eq(documents.knowledgeBaseId, knowledgeBaseId));
      
      return result[0]?.totalSize || 0;
    } catch (error) {
      console.error('Error getting knowledge base storage used:', error);
      return 0;
    }
  }

  async getKnowledgeBaseDocumentsByType(knowledgeBaseId: number): Promise<Record<string, number>> {
    try {
      const result = await db.select({
        sourceType: documents.sourceType,
        count: count()
      })
        .from(documents)
        .where(eq(documents.knowledgeBaseId, knowledgeBaseId))
        .groupBy(documents.sourceType);
      
      const documentsByType: Record<string, number> = {};
      result.forEach(row => {
        documentsByType[row.sourceType] = row.count;
      });
      
      return documentsByType;
    } catch (error) {
      console.error('Error getting knowledge base documents by type:', error);
      return {};
    }
  }

  async getKnowledgeBaseRecentActivity(knowledgeBaseId: number, limit: number = 10): Promise<any[]> {
    try {
      // Get recent document additions/updates
      const recentDocuments = await db.select({
        type: sql<string>`'document'`,
        action: sql<string>`'created'`,
        title: documents.title,
        createdAt: documents.createdAt
      })
        .from(documents)
        .where(eq(documents.knowledgeBaseId, knowledgeBaseId))
        .orderBy(desc(documents.createdAt))
        .limit(limit);
      
      return recentDocuments;
    } catch (error) {
      console.error('Error getting knowledge base recent activity:', error);
      return [];
    }
  }

  async getKnowledgeBaseProcessingStatus(knowledgeBaseId: number): Promise<Record<string, number>> {
    try {
      const result = await db.select({
        status: documents.status,
        count: count()
      })
        .from(documents)
        .where(eq(documents.knowledgeBaseId, knowledgeBaseId))
        .groupBy(documents.status);
      
      const processingStatus: Record<string, number> = {
        processing: 0,
        completed: 0,
        failed: 0
      };
      
      result.forEach(row => {
        processingStatus[row.status || 'completed'] = row.count;
      });
      
      return processingStatus;
    } catch (error) {
      console.error('Error getting knowledge base processing status:', error);
      return { processing: 0, completed: 0, failed: 0 };
    }
  }
}