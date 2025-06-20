import crypto from 'crypto';
import {
  type ApiKey,
  type InsertApiKey,
  type User,
  type InsertUser,
  type Agent,
  type InsertAgent,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type Document,
  type InsertDocument,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Widget,
  type InsertWidget,
  type WidgetUser,
  type InsertWidgetUser,
  type WidgetSession,
  type InsertWidgetSession,
  type Otp,
  type InsertOtp,
  type UnansweredQuestion,
  type InsertUnansweredQuestion,
  type AnonymousWidgetUser,
  type InsertAnonymousWidgetUser,
  type AnonymousWidgetSession,
  type InsertAnonymousWidgetSession,
  type WidgetLead,
  type InsertWidgetLead,
  type ScheduledKnowledgeUpdate,
  type InsertScheduledKnowledgeUpdate,
  type ConversationMemory,
  type InsertConversationMemory,
  // Team Management Types
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type TeamInvitation,
  type InsertTeamInvitation,
  type ActivityLog,
  type InsertActivityLog,
  // Resource Permission Types
  type ResourceType,
  type TeamResourcePermission,
  type InsertTeamResourcePermission,
  type MemberResourcePermission,
  type InsertMemberResourcePermission,
  // Integration Types
  type IntegrationProvider,
  type InsertIntegrationProvider,
  type Integration,
  type InsertIntegration,
  type IntegrationLog,
  type InsertIntegrationLog,

  // Daily Usage Metrics
  type DailyUsageMetric,
  type InsertDailyUsageMetric,
  // Visualizer Board Types
  type VisualizerBoard,
  type InsertVisualizerBoard,
  type VisualizerChatConversation,
  type InsertVisualizerChatConversation,
  // Subscription Types
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type Subscription,
  type InsertSubscription,
  type Payment,
  type InsertPayment
} from "@shared/schema";

// Import domain interfaces
import { ApiKeyStorageInterface } from './services/api-key-interface';
import { IAgentStorage } from './interfaces/agent-storage';

// Storage interface for all data operations
export interface IStorage extends ApiKeyStorageInterface, IAgentStorage {
  // User operations
  getUser(id: string | number): Promise<User | undefined>;
  getUserByAuthId(authId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string | number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string | number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string | number): Promise<boolean>;
  getUserAgents(userId: string | number): Promise<Agent[]>;
  
  // Visualizer Board operations
  getVisualizerBoard(id: number): Promise<VisualizerBoard | undefined>;
  getVisualizerBoardsByUserId(userId: number): Promise<VisualizerBoard[]>;
  createVisualizerBoard(board: InsertVisualizerBoard): Promise<VisualizerBoard>;
  updateVisualizerBoard(id: number, board: Partial<VisualizerBoard>): Promise<VisualizerBoard | undefined>;
  deleteVisualizerBoard(id: number): Promise<boolean>;
  
  // Visualizer Chat Conversation operations
  getVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<VisualizerChatConversation | undefined>;
  createVisualizerChatConversation(conversation: InsertVisualizerChatConversation): Promise<VisualizerChatConversation>;
  updateVisualizerChatConversation(boardId: number, chatNodeId: string, data: Partial<VisualizerChatConversation>): Promise<VisualizerChatConversation | undefined>;
  deleteVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<boolean>;
  
  // Agent operations
  getAgent(id: string | number): Promise<Agent | undefined>;
  getAgentsByUserId(userId: string | number): Promise<Agent[]>;
  getPredefinedAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string | number, agent: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string | number): Promise<boolean>;
  getAgentKnowledgeBases(agentId: string | number): Promise<KnowledgeBase[]>;
  getAgentConversationCount(agentId: string | number): Promise<number>;
  getAgentRecentConversations(agentId: string | number, limit?: number): Promise<Conversation[]>;
  archiveAgentConversations(agentId: string | number): Promise<boolean>;
  deleteAgentKnowledgeBaseAssociations(agentId: string | number): Promise<boolean>;
  deleteAgentActivities(agentId: string | number): Promise<boolean>;
  deleteAgentShares(agentId: string | number): Promise<boolean>;
  deleteAgentUnansweredQuestions(agentId: string | number): Promise<boolean>;
  deleteAgentWidgets(agentId: string | number): Promise<boolean>;
  getAgentDependencies(id: string | number): Promise<{ 
    conversations: number;
    widgets: number;
    unansweredQuestions: number;
  }>;
  cascadeDeleteAgent(id: string | number): Promise<boolean>;
  checkAgentAccess(agentId: number, userId: number): Promise<boolean>;
  updateAgentKnowledgeBases(agentId: string | number, knowledgeBaseIds: number[]): Promise<boolean>;
  createAgentActivity(activity: any): Promise<any>;
  validateKnowledgeBaseAccess(userId: number, knowledgeBaseIds: number[]): Promise<boolean>;
  associateAgentKnowledgeBases(agentId: string | number, knowledgeBaseIds: number[]): Promise<boolean>;
  getAgentConversationMetrics(agentId: string | number): Promise<any>;
  getAgentResponseMetrics(agentId: string | number): Promise<any>;
  getAgentUsageMetrics(agentId: string | number): Promise<any>;
  getAgentErrorMetrics(agentId: string | number): Promise<any>;
  getAgentTemplate(templateId: string | number): Promise<Agent | undefined>;
  
  // Knowledge Base operations
  getKnowledgeBase(id: string | number): Promise<KnowledgeBase | undefined>;
  getKnowledgeBasesByUserId(userId: string | number): Promise<KnowledgeBase[]>;
  createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBase(id: string | number, kb: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined>;
  getKnowledgeBaseDependencies(id: string | number): Promise<{ 
    documents: number;
    agents: number;
    unansweredQuestions: number;
  }>;
  cascadeDeleteKnowledgeBase(id: string | number): Promise<boolean>;
  deleteKnowledgeBase(id: string | number): Promise<boolean>;
  getKnowledgeBaseDocumentCount(kbId: string | number): Promise<number>;
  getKnowledgeBaseAgentCount(kbId: string | number): Promise<number>;
  getKnowledgeBaseRecentDocuments(kbId: string | number, limit?: number): Promise<Document[]>;
  checkKnowledgeBaseAccess(kbId: string | number, userId: string | number): Promise<boolean>;
  
  // Document operations
  getDocument(id: string | number): Promise<Document | undefined>;
  getDocumentsByKnowledgeBaseId(kbId: string | number): Promise<Document[]>;
  getDocumentsByStatus(status: string): Promise<Document[]>;
  getDocuments(kbId: string | number, options?: {
    limit?: number;
    offset?: number;
    filters?: {
      search?: string;
      status?: string;
      type?: string;
    };
  }): Promise<Document[]>;
  getDocumentCount(kbId: string | number, filters?: {
    search?: string;
    status?: string;
    type?: string;
  }): Promise<number>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string | number, document: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string | number): Promise<boolean>;
  deleteKnowledgeBaseDocuments(kbId: string | number): Promise<boolean>;
  deleteKnowledgeBaseActivities(kbId: string | number): Promise<boolean>;
  deleteKnowledgeBaseShares(kbId: string | number): Promise<boolean>;
  
  // Knowledge Base Sharing operations
  getKnowledgeBaseShare(id: string | number): Promise<any>;
  createKnowledgeBaseShare(share: any): Promise<any>;
  getKnowledgeBaseShares(kbId: string | number): Promise<any[]>;
  getKnowledgeBaseShareById(id: string | number): Promise<any>;
  deleteKnowledgeBaseShare(id: string | number): Promise<boolean>;
  
  searchDocuments(options: {
    query: string;
    knowledgeBaseId?: number;
    userId: number;
    limit?: number;
    offset?: number;
  }): Promise<Document[]>;
  
  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByUserId(userId: number): Promise<Conversation[]>;
  getConversationsByAgentId(agentId: number, userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, conversation: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<boolean>;
  getConversationSummary(conversationId: number): Promise<string | null>;
  
  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  getConversationMessages(conversationId: number, options?: {
    limit?: number;
    offset?: number;
    filters?: {
      beforeId?: number;
      afterId?: number;
    };
  }): Promise<Message[]>;
  deleteConversationMessages(conversationId: number): Promise<boolean>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<boolean>;
  
  // Widget operations
  getWidget(id: string | number): Promise<Widget | undefined>;
  getWidgetByPublicKey(publicKey: string): Promise<Widget | undefined>;
  getWidgetsByUserId(userId: number): Promise<Widget[]>;
  createWidget(widget: InsertWidget): Promise<Widget>;
  updateWidget(id: string | number, widget: Partial<Widget>): Promise<Widget | undefined>;
  deleteWidget(id: string | number): Promise<boolean>;
  
  // Widget User operations
  getWidgetUser(id: string): Promise<WidgetUser | undefined>;
  getWidgetUserByEmail(email: string): Promise<WidgetUser | undefined>;
  createWidgetUser(user: InsertWidgetUser): Promise<WidgetUser>;
  updateWidgetUser(id: string, user: Partial<WidgetUser>): Promise<WidgetUser | undefined>;
  
  // Anonymous Widget User operations
  getAnonymousWidgetUser(id: number): Promise<AnonymousWidgetUser | undefined>;
  getAnonymousWidgetUserByUuid(uuid: string): Promise<AnonymousWidgetUser | undefined>;
  createAnonymousWidgetUser(user: InsertAnonymousWidgetUser): Promise<AnonymousWidgetUser>;
  updateAnonymousWidgetUser(id: number, user: Partial<AnonymousWidgetUser>): Promise<AnonymousWidgetUser | undefined>;
  
  // Widget Session operations
  getWidgetSession(id: string): Promise<WidgetSession | undefined>;
  getWidgetSessionByToken(token: string): Promise<WidgetSession | undefined>;
  createWidgetSession(session: InsertWidgetSession): Promise<WidgetSession>;
  
  // Anonymous Widget Session operations
  getAnonymousWidgetSession(id: number): Promise<AnonymousWidgetSession | undefined>;
  getAnonymousWidgetSessionByToken(token: string): Promise<AnonymousWidgetSession | undefined>;
  createAnonymousWidgetSession(session: InsertAnonymousWidgetSession): Promise<AnonymousWidgetSession>;
  updateAnonymousWidgetSession(id: number, session: Partial<AnonymousWidgetSession>): Promise<AnonymousWidgetSession | undefined>;
  
  // OTP operations
  getOtp(id: string): Promise<Otp | undefined>;
  getOtpByEmail(email: string): Promise<Otp | undefined>;
  createOtp(otp: InsertOtp): Promise<Otp>;
  updateOtp(id: string, otp: Partial<Otp>): Promise<Otp | undefined>;
  
  // Unanswered Questions operations
  getUnansweredQuestion(id: number): Promise<UnansweredQuestion | undefined>;
  getUnansweredQuestionsByUserId(userId: number): Promise<UnansweredQuestion[]>;
  getUnansweredQuestionsByAgentId(agentId: number): Promise<UnansweredQuestion[]>;
  getUnansweredQuestionsByKnowledgeBaseId(knowledgeBaseId: number): Promise<UnansweredQuestion[]>;
  getUnansweredQuestionsByStatus(status: string): Promise<UnansweredQuestion[]>;
  createUnansweredQuestion(question: InsertUnansweredQuestion): Promise<UnansweredQuestion>;
  updateUnansweredQuestion(id: number, question: Partial<UnansweredQuestion>): Promise<UnansweredQuestion | undefined>;
  
  // Widget Lead operations
  getWidgetLead(id: number): Promise<WidgetLead | undefined>;
  getWidgetLeadsByWidgetId(widgetId: number): Promise<WidgetLead[]>;
  getWidgetLeadsByAnonymousUserId(anonymousUserId: number): Promise<WidgetLead[]>;
  createWidgetLead(lead: InsertWidgetLead): Promise<WidgetLead>;
  updateWidgetLead(id: number, lead: Partial<WidgetLead>): Promise<WidgetLead | undefined>;
  
  // Scheduled Knowledge Update operations
  getScheduledKnowledgeUpdate(id: number): Promise<ScheduledKnowledgeUpdate | undefined>;
  getScheduledKnowledgeUpdatesByUserId(userId: number): Promise<ScheduledKnowledgeUpdate[]>;
  getScheduledKnowledgeUpdatesByAgentId(agentId: number): Promise<ScheduledKnowledgeUpdate[]>;
  getScheduledKnowledgeUpdatesDue(): Promise<ScheduledKnowledgeUpdate[]>;
  createScheduledKnowledgeUpdate(update: InsertScheduledKnowledgeUpdate): Promise<ScheduledKnowledgeUpdate>;
  updateScheduledKnowledgeUpdate(id: number, update: Partial<ScheduledKnowledgeUpdate>): Promise<ScheduledKnowledgeUpdate | undefined>;
  deleteScheduledKnowledgeUpdate(id: number): Promise<boolean>;
  runScheduledKnowledgeUpdateNow(id: number): Promise<{ success: boolean; message: string; }>;
  
  // Conversation Memory operations
  getConversationMemory(id: number): Promise<ConversationMemory | undefined>;
  getConversationMemoryByConversationId(conversationId: number): Promise<ConversationMemory | undefined>;
  createConversationMemory(memory: InsertConversationMemory): Promise<ConversationMemory>;
  updateConversationMemory(id: number, memory: Partial<ConversationMemory>): Promise<ConversationMemory | undefined>;
  deleteConversationMemory(id: number): Promise<boolean>;
  
  // Usage Metrics operations
  trackDailyUsageMetric(
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
  ): Promise<DailyUsageMetric>;
  
  getDailyUsageMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      metricType?: string | string[],
      groupBy?: string
    }
  ): Promise<DailyUsageMetric[]>;
  
  getUsageSummary(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      currentPeriodOnly?: boolean
    }
  ): Promise<Record<string, { current: number, lifetime: number }>>;

  getDailyMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      granularity?: string
    }
  ): Promise<DailyUsageMetric[]>;

  getRegionalMetrics(
    userId: number, 
    params: {
      teamId?: number,
      startDate?: string,
      endDate?: string,
      limit?: number
    }
  ): Promise<{ region: string, value: number }[]>;
  
  getStorageUtilization(
    userId: number, 
    params: {
      teamId?: number
    }
  ): Promise<{ type: string, sizeKb: number }[]>;

  // Additional metrics methods for complete interface compatibility
  getResponseTimeMetrics(userId: number, params?: any): Promise<any>;
  getSentimentAnalysis(userId: number, params?: any): Promise<any>;
  getTopQueries(userId: number, params?: any): Promise<any>;
  getKnowledgeBasePerformanceMetrics(userId: number, params?: any): Promise<any>;
  getKnowledgeBaseQueryAnalytics(userId: number, params?: any): Promise<any>;
  getLLMCostMetrics(userId: number, params?: any): Promise<any>;
  getLLMPerformanceMetrics(userId: number, params?: any): Promise<any>;
  getLLMErrorMetrics(userId: number, params?: any): Promise<any>;
  generateUserActivityReport(userId: number, params?: any): Promise<any>;
  generateAgentPerformanceReport(userId: number, params?: any): Promise<any>;
  generateKnowledgeBaseReport(userId: number, params?: any): Promise<any>;
  generateCostAnalysisReport(userId: number, params?: any): Promise<any>;
  generateSystemHealthReport(userId: number, params?: any): Promise<any>;
  saveGeneratedReport(report: any): Promise<any>;
  getUserReports(userId: number, params?: any): Promise<any>;
  getRealtimeStats(userId: number, params?: any): Promise<any>;
  getRecentActivity(userId: number, params?: any): Promise<any>;
  getMetricAlerts(userId: number, params?: any): Promise<any>;
  getQuickMetrics(userId: number, params?: any): Promise<any>;
  getUsageRecords(userId: number, params?: any): Promise<any>;
  getWidgetAnalytics(widgetId: string, params?: any): Promise<any>;
  
  // Additional missing storage methods
  getConversationTrends(userId: number, params?: any): Promise<any>;
  getKnowledgeBaseUsageMetrics(userId: number, params?: any): Promise<any>;
  getKnowledgeBaseDocumentMetrics(userId: number, params?: any): Promise<any>;
  getLLMUsageMetrics(userId: number, params?: any): Promise<any>;
  
  // Visualizer Board operations
  getVisualizerBoard(id: number): Promise<any>;
  getVisualizerBoardsByUserId(userId: number): Promise<any[]>;
  createVisualizerBoard(board: any): Promise<any>;
  updateVisualizerBoard(id: number, board: any): Promise<any>;
  deleteVisualizerBoard(id: number): Promise<boolean>;
  
  // Visualizer Chat Conversation operations
  getVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<any>;
  createVisualizerChatConversation(conversation: any): Promise<any>;
  updateVisualizerChatConversation(boardId: number, chatNodeId: string, data: any): Promise<any>;
  deleteVisualizerChatConversation(boardId: number, chatNodeId: string): Promise<boolean>;
  
  // Additional required methods for complete interface compatibility
  getTeamKnowledgeBaseCounts(teamId: number): Promise<{ shared: number; total: number }>;
  getTeamAgentCounts(teamId: number): Promise<{ shared: number; total: number }>;
  getVisualizerBoardConversations(boardId: number): Promise<any[]>;
  createVisualizerBoardConversation(conversation: any): Promise<any>;
  updateVisualizerBoardConversation(id: number, conversation: any): Promise<any>;
  deleteVisualizerBoardConversation(id: number): Promise<boolean>;
  getVisualizerNodeConnections(nodeId: number): Promise<any[]>;
  createVisualizerNodeConnection(connection: any): Promise<any>;
  updateVisualizerNodeConnection(id: number, connection: any): Promise<any>;
  deleteVisualizerNodeConnection(id: number): Promise<boolean>;
  getWorkflowTemplates(userId?: number): Promise<any[]>;
  createWorkflowTemplate(template: any): Promise<any>;
  updateWorkflowTemplate(id: number, template: any): Promise<any>;
  deleteWorkflowTemplate(id: number): Promise<boolean>;
  getAutomationRules(userId: number): Promise<any[]>;
  createAutomationRule(rule: any): Promise<any>;
  updateAutomationRule(id: number, rule: any): Promise<any>;
  deleteAutomationRule(id: number): Promise<boolean>;
  getScheduledTasks(userId?: number): Promise<any[]>;
  createScheduledTask(task: any): Promise<any>;
  updateScheduledTask(id: number, task: any): Promise<any>;
  deleteScheduledTask(id: number): Promise<boolean>;
  
  // Team operations
  getTeam(id: number): Promise<Team | undefined>;
  getTeamById(id: number): Promise<Team | undefined>;
  getUserTeams(userId: number, options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<Team[]>;
  getUserTeamsCount(userId: number, filters?: {
    search?: string;
  }): Promise<number>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<Team>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  getTeamsByOwnerId(ownerId: number): Promise<Team[]>;
  
  // LLM API Key operations
  getLLMApiKeys(userId: number): Promise<ApiKey[]>;
  
  // Team membership verification
  isTeamMember(userId: number, teamId: number): Promise<boolean>;
  hasTeamPermission(userId: number, teamId: number, permission: string): Promise<boolean>;
  
  // Team Member operations
  getTeamMember(teamId: number, userId: number): Promise<TeamMember | undefined>;
  getTeamMemberById(id: number): Promise<TeamMember | undefined>;
  getTeamMembers(teamId: number): Promise<TeamMember[]>;
  getTeamMembersByTeamId(teamId: number): Promise<TeamMember[]>;
  getTeamMembershipsByUserId(userId: number): Promise<TeamMember[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(teamId: string | number, userId: string | number, memberData: any): Promise<any>;
  removeTeamMember(teamId: string | number, userId: string | number): Promise<any>;
  deleteTeamMember(teamId: number, userId: number): Promise<boolean>;
  
  // Team Invitation operations
  getTeamInvitation(id: number): Promise<TeamInvitation | undefined>;
  getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined>;
  getTeamInvitations(teamId: number): Promise<TeamInvitation[]>;
  getTeamInvitationsByTeamId(teamId: number): Promise<TeamInvitation[]>;
  getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]>;
  createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation>;
  updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined>;
  deleteTeamInvitation(id: number): Promise<boolean>;
  
  // Advanced team invitation operations
  resendTeamInvitation(invitationId: number, userId: number): Promise<boolean>;
  acceptTeamInvitation(token: string, userId: number): Promise<TeamMember | null>;
  verifyTeamInvitationToken(token: string): Promise<{ invitation: TeamInvitation; teamName: string } | null>;
  hasTeamAccess(teamId: number, userId: number): Promise<boolean>;
  
  // Activity Log operations
  getActivityLog(id: number): Promise<ActivityLog | undefined>;
  getActivityLogsByTeamId(teamId: number): Promise<ActivityLog[]>;
  getTeamActivityLogs(teamId: number, page?: number, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // Team Resource Permission operations
  getTeamResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<TeamResourcePermission | undefined>;
  getTeamResourcePermissionsByTeamId(teamId: number, resourceType?: ResourceType): Promise<TeamResourcePermission[]>;
  getTeamResourcePermissionsByResourceTypeAndId(resourceType: ResourceType, resourceId: number): Promise<TeamResourcePermission[]>;
  createTeamResourcePermission(permission: InsertTeamResourcePermission): Promise<TeamResourcePermission>;
  updateTeamResourcePermission(id: number, permission: Partial<TeamResourcePermission>): Promise<TeamResourcePermission | undefined>;
  deleteTeamResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<boolean>;
  
  // Integration operations for teams
  getIntegrationsByTeamId(teamId: number): Promise<Integration[]>;
  
  // Member Resource Permission operations
  getMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<MemberResourcePermission | undefined>;
  getMemberResourcePermissionsByTeamAndUser(teamId: number, userId: number, resourceType?: ResourceType): Promise<MemberResourcePermission[]>;
  getMemberResourcePermissionsByResource(resourceType: ResourceType, resourceId: number): Promise<MemberResourcePermission[]>;
  createMemberResourcePermission(permission: InsertMemberResourcePermission): Promise<MemberResourcePermission>;
  deleteMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean>;
  
  // Resource Access Verification
  canAccessResource(userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean>;
  getUserResourceAccess(userId: number, resourceType: ResourceType): Promise<{ resourceId: number, teamId?: number, accessType: 'direct' | 'team' | 'member' }[]>;
  
  // OPTIMIZED METHODS for permission lookups (fixes 1000ms+ response times)
  getUserTeamResourcePermissions(userId: number, resourceType: ResourceType): Promise<TeamResourcePermission[]>;
  getUserMemberResourcePermissions(userId: number, resourceType: ResourceType): Promise<MemberResourcePermission[]>;
  
  // Integration Provider operations
  getIntegrationProvider(id: number): Promise<IntegrationProvider | undefined>;
  getIntegrationProviderByType(type: string): Promise<IntegrationProvider | undefined>;
  getAllIntegrationProviders(): Promise<IntegrationProvider[]>;
  createIntegrationProvider(provider: InsertIntegrationProvider): Promise<IntegrationProvider>;
  updateIntegrationProvider(id: number, provider: Partial<IntegrationProvider>): Promise<IntegrationProvider | undefined>;
  
  // Integration operations
  getIntegration(id: number): Promise<Integration | undefined>;
  getIntegrationsByUserId(userId: number): Promise<Integration[]>;
  getIntegrationsByTeamId(teamId: number): Promise<Integration[]>;
  getIntegrationsByProviderId(providerId: number): Promise<Integration[]>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: number, integration: Partial<Integration>): Promise<Integration | undefined>;
  deleteIntegration(id: number): Promise<boolean>;
  
  // Integration Log operations
  getIntegrationLog(id: number): Promise<IntegrationLog | undefined>;
  getIntegrationLogs(integrationId: number, page?: number, limit?: number): Promise<IntegrationLog[]>;
  getIntegrationLogsByIntegrationId(integrationId: number): Promise<IntegrationLog[]>;
  createIntegrationLog(log: InsertIntegrationLog): Promise<IntegrationLog>;

  // Knowledge base analytics methods
  getKnowledgeBaseTotalQueries(knowledgeBaseId: number): Promise<number>;
  getKnowledgeBaseStorageUsed(knowledgeBaseId: number): Promise<number>;
  getKnowledgeBaseDocumentsByType(knowledgeBaseId: number): Promise<Record<string, number>>;
  getKnowledgeBaseRecentActivity(knowledgeBaseId: number, limit?: number): Promise<any[]>;
  getKnowledgeBaseProcessingStatus(knowledgeBaseId: number): Promise<Record<string, number>>;

  // Subscription Plan operations
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlans(includeInactive?: boolean): Promise<SubscriptionPlan[]>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, plan: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  // Subscription operations
  getSubscription(id: number): Promise<Subscription | undefined>;
  getUserSubscription(userId: number): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, subscription: Partial<Subscription>): Promise<Subscription | undefined>;

  // Payment operations
  getPayment(id: number): Promise<Payment | undefined>;
  getSubscriptionPayments(subscriptionId: number, page?: number, limit?: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;

  // User Domain operations
  getUserKnowledgeBasesCount(userId: number): Promise<number>;
  getUserAgentsCount(userId: number): Promise<number>;
  getUserDocumentsCount(userId: number): Promise<number>;
  getUserConversationsCount(userId: number): Promise<number>;
  getUserActivityLog(userId: number, options?: {
    limit?: number;
    offset?: number;
    filters?: {
      type?: string;
      startDate?: Date;
      endDate?: Date;
    };
  }): Promise<any[]>;
  deleteUser(userId: number): Promise<boolean>;
  getUserKnowledgeBases(userId: number): Promise<any[]>;
  getUserAgents(userId: number): Promise<any[]>;
  getUserDocuments(userId: number): Promise<any[]>;
  getUserConversations(userId: number): Promise<any[]>;
}

// Storage instance - using PostgreSQL adapter in production
import { PostgresqlAdapter } from './postgresql-adapter';

export const storage = new PostgresqlAdapter();
