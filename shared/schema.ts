import { pgTable, text, serial, uuid, json, boolean, timestamp, integer, date, time, primaryKey, pgEnum, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Forward declare temporary type for users table 
// (this helps avoid circular reference errors during initialization)
export type UserRef = {
  id: number;
  name: string;
  email: string;
  authId: string;
};

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authId: text("auth_id").notNull().unique(), // Auth0 user ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  preferences: json("preferences"),
  timezone: text("timezone").default("UTC"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// User Profile model
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  theme: text("theme").default("system"),
  language: text("language").default("en"),
  notifications: boolean("notifications").default(true),
  preferences: json("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// LLM Provider model
export const llmProviders = pgTable("llm_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLlmProviderSchema = createInsertSchema(llmProviders).omit({
  id: true,
  createdAt: true,
});

// LLM Model (within a provider)
export const llmModels = pgTable("llm_models", {
  id: serial("id").primaryKey(),
  providerId: serial("provider_id").references(() => llmProviders.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  version: text("version"),
  capabilities: json("capabilities").notNull(),
  contextWindow: integer("context_window"),
  costPerInputToken: integer("cost_per_input_token"),
  costPerOutputToken: integer("cost_per_output_token"),
  maxOutputTokens: integer("max_output_tokens"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLlmModelSchema = createInsertSchema(llmModels).omit({
  id: true,
  createdAt: true,
});

// User API Keys
export const userApiKeys = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  providerId: serial("provider_id").references(() => llmProviders.id),
  keyName: text("key_name").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keyHash: text("key_hash").notNull(), // To check for duplicates without decrypting
  expiresAt: timestamp("expires_at"),
  isDefault: boolean("is_default").default(false),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserApiKeySchema = createInsertSchema(userApiKeys).omit({
  id: true,
  encryptedKey: true,
  keyHash: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  apiKey: z.string().min(1, "API key is required"),
});

// AI Agent model
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  modelId: serial("model_id").references(() => llmModels.id),
  providerId: serial("provider_id").references(() => llmProviders.id),
  configuration: json("configuration").notNull(),
  knowledgeBaseIds: json("knowledge_base_ids").$type<number[]>().default([]),
  promptTemplate: text("prompt_template"),
  rules: json("rules").$type<string[]>().default([]),
  confidenceThreshold: text("confidence_threshold").default("0.75"),
  fallbackMessage: text("fallback_message").default("I don't have enough information to answer that question confidently. Could you please rephrase or provide more details?"),
  allowContinuousGeneration: boolean("allow_continuous_generation").default(true), // Enable/disable continuous content generation
  enableConversationMemory: boolean("enable_conversation_memory").default(true), // Enable/disable conversation memory
  isActive: boolean("is_active").default(true).notNull(),
  isPublic: boolean("is_public").default(false), // Whether this agent is publicly accessible
  status: text("status").default("active"), // active, inactive, training, error
  settings: json("settings").$type<{
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    systemPrompt?: string;
  }>().default({}),
  isPredefined: boolean("is_predefined").default(false), // Whether this is a predefined agent template
  tags: json("tags").$type<string[]>().default([]), // Tags for categorizing predefined agents
  icon: text("icon"), // Icon or emoji for visual representation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

// Knowledge Base model
export const knowledgeBases = pgTable("knowledge_bases", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  vectorStoreId: text("vector_store_id"),
  metadata: json("metadata"),
  // Custom metadata fields that should be collected for each document
  customFields: json("custom_fields").$type<{
    id: string;
    name: string;
    description?: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    options?: string[]; // For select type fields
  }[]>().default([]),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBases).omit({
  id: true,
  createdAt: true,
});

// Documents within a knowledge base
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  knowledgeBaseId: serial("knowledge_base_id").references(() => knowledgeBases.id),
  userId: serial("user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),  // May be empty for PDF/URLs, content is stored in chunks
  status: text("status").default("pending").notNull(), // pending, processing, processed, failed, archived
  sourceType: text("source_type").notNull(), // text, pdf, url, document, youtube
  sourceUrl: text("source_url"), // For URL documents
  filePath: text("file_path"), // For uploaded files
  fileSize: integer("file_size"), // Size in bytes
  isS3: boolean("is_s3").default(false), // Whether the file is stored in S3
  metadata: json("metadata"),
  tags: json("tags").$type<string[]>().default([]), // Array of tags for document categorization
  processingInfo: json("processing_info"), // Information about the processing status
  embeddingIds: json("embedding_ids").default("[]"), // JSON array of embedding IDs
  customFields: json("custom_fields").default({}), // Custom fields for documents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Document enums
export const documentSourceTypeEnum = z.enum(['text', 'pdf', 'url', 'document', 'youtube']);
export type DocumentSourceType = z.infer<typeof documentSourceTypeEnum>;

export const documentStatusEnum = z.enum(['pending', 'processing', 'processed', 'failed', 'archived']);
export type DocumentStatus = z.infer<typeof documentStatusEnum>;

// Message role enum type
export const messageRoleEnum = z.enum(['system', 'user', 'assistant']);
export type MessageRole = z.infer<typeof messageRoleEnum>;

// Conversations model
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  agentId: serial("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  metadata: json("metadata"),
  status: text("status").default("active"), // active, archived, deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
});

// Messages within a conversation
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: serial("conversation_id").references(() => conversations.id),
  userId: serial("user_id").references(() => users.id),
  agentId: serial("agent_id").references(() => agents.id),
  role: text("role").notNull(), // 'system', 'user', or 'assistant'
  content: text("content").notNull(),
  tokens: integer("tokens"), // Token count for the message
  tokenCount: integer("token_count"), // Alternative token count field used by adapters
  metadata: json("metadata"), // Can store additional data like citations
  citations: json("citations").$type<Array<{
    id: string;
    score: number;
    content: string;
    source: string;
    document_id: string;
    chunk_index: number;
  }>>().default([]), // Source citations from RAG
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
}).extend({
  role: messageRoleEnum,
});

// Visualizer Board model
export const visualizerBoards = pgTable("visualizer_boards", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  nodes: json("nodes").notNull(),
  edges: json("edges").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Visualizer Chat Conversations model
export const visualizerChatConversations = pgTable("visualizer_chat_conversations", {
  id: serial("id").primaryKey(),
  boardId: serial("board_id").references(() => visualizerBoards.id, { onDelete: 'cascade' }),
  chatNodeId: text("chat_node_id").notNull(), // ID of the chat widget node in the board
  messages: json("messages").default([]).notNull(), // Array of message objects
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVisualizerBoardSchema = createInsertSchema(visualizerBoards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVisualizerChatConversationSchema = createInsertSchema(visualizerChatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type LlmProvider = typeof llmProviders.$inferSelect;
export type InsertLlmProvider = z.infer<typeof insertLlmProviderSchema>;

export type LlmModel = typeof llmModels.$inferSelect;
export type InsertLlmModel = z.infer<typeof insertLlmModelSchema>;

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type VisualizerBoard = typeof visualizerBoards.$inferSelect;
export type InsertVisualizerBoard = z.infer<typeof insertVisualizerBoardSchema>;

export type VisualizerChatConversation = typeof visualizerChatConversations.$inferSelect;
export type InsertVisualizerChatConversation = z.infer<typeof insertVisualizerChatConversationSchema>;

// For backward compatibility, keep these type aliases
export type KnowledgeFlow = VisualizerBoard;
export type InsertKnowledgeFlow = InsertVisualizerBoard;

// OTP (One-Time Password)
export const otps = pgTable("otps", {
  id: text("id").primaryKey(), // Changed from serial to text to match the database
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOtpSchema = createInsertSchema(otps).omit({
  createdAt: true,
});

export type Otp = typeof otps.$inferSelect;
export type InsertOtp = z.infer<typeof insertOtpSchema>;

// Widget User (for external users of embedded widgets)
export const widgetUsers = pgTable("widget_users", {
  id: serial("id").primaryKey(),
  widgetId: text("widget_id").references(() => widgets.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  verified: boolean("verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWidgetUserSchema = createInsertSchema(widgetUsers).omit({
  id: true,
  verified: true,
  lastLoginAt: true,
  createdAt: true,
});

export type WidgetUser = typeof widgetUsers.$inferSelect;
export type InsertWidgetUser = z.infer<typeof insertWidgetUserSchema>;

// Anonymous Widget User (for lead capture without authentication)
export const anonymousWidgetUsers = pgTable("anonymous_widget_users", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(), // Unique identifier stored in localStorage
  email: text("email"),
  name: text("name"),
  phone: text("phone"),
  widgetId: text("widget_id"), // Will reference widgets table (defined later to avoid circular reference)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnonymousWidgetUserSchema = createInsertSchema(anonymousWidgetUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AnonymousWidgetUser = typeof anonymousWidgetUsers.$inferSelect;
export type InsertAnonymousWidgetUser = z.infer<typeof insertAnonymousWidgetUserSchema>;

// Widget Session
export const widgetSessions = pgTable("widget_sessions", {
  id: serial("id").primaryKey(),
  widgetUserId: serial("widget_user_id").references(() => widgetUsers.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWidgetSessionSchema = createInsertSchema(widgetSessions).omit({
  id: true,
  createdAt: true,
});

export type WidgetSession = typeof widgetSessions.$inferSelect;
export type InsertWidgetSession = z.infer<typeof insertWidgetSessionSchema>;

// Anonymous Widget Session
export const anonymousWidgetSessions = pgTable("anonymous_widget_sessions", {
  id: serial("id").primaryKey(),
  anonymousUserId: serial("anonymous_user_id").references(() => anonymousWidgetUsers.id),
  widgetId: text("widget_id"), // Will reference widgets table (defined later to avoid circular reference)
  uuid: uuid("uuid").notNull(), // Same UUID as in anonymousWidgetUsers
  token: text("token").notNull().unique(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnonymousWidgetSessionSchema = createInsertSchema(anonymousWidgetSessions).omit({
  id: true,
  lastActive: true,
  createdAt: true,
});

export type AnonymousWidgetSession = typeof anonymousWidgetSessions.$inferSelect;
export type InsertAnonymousWidgetSession = z.infer<typeof insertAnonymousWidgetSessionSchema>;

// Embeddable Widget 
export const widgets = pgTable("widgets", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  agentId: text("agent_id"),
  name: text("name").notNull(),
  config: json("config").$type<{
    theme: {
      primaryColor: string;
      textColor: string;
      backgroundColor: string;
    };
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    size: 'small' | 'medium' | 'large';
    welcomeMessage: string;
    widgetTitle: string;
  }>().notNull(),
  secretKey: text("secret_key").notNull().unique(),
  publicKey: text("public_key").notNull().unique(),
  active: boolean("active").default(true),
  allowAnonymous: boolean("allow_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWidgetSchema = createInsertSchema(widgets).omit({
  id: true,
  secretKey: true,
  publicKey: true,
  createdAt: true,
});

export type Widget = typeof widgets.$inferSelect;
export type InsertWidget = z.infer<typeof insertWidgetSchema>;

// Unanswered Questions
export const unansweredQuestions = pgTable("unanswered_questions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  agentId: serial("agent_id").references(() => agents.id).notNull(),
  knowledgeBaseId: serial("knowledge_base_id").references(() => knowledgeBases.id),
  conversationId: serial("conversation_id").references(() => conversations.id),
  messageId: serial("message_id").references(() => messages.id),
  question: text("question").notNull(),
  context: text("context"), // The context in which the question was asked
  confidenceScore: decimal("confidence_score", { precision: 4, scale: 2 }), // How confident the system was in its answer (0-1)
  status: text("status").default("pending").notNull(), // pending, addressed, ignored
  resolution: text("resolution"), // Information about how the question was addressed
  newDocumentId: serial("new_document_id").references(() => documents.id), // Document created to address this question
  source: text("source").default("chat").notNull(), // chat, widget, api
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnansweredQuestionSchema = createInsertSchema(unansweredQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UnansweredQuestion = typeof unansweredQuestions.$inferSelect;
export type InsertUnansweredQuestion = z.infer<typeof insertUnansweredQuestionSchema>;

// Conversation Memories for enhanced context
export const conversationMemories = pgTable("conversation_memories", {
  id: serial("id").primaryKey().notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  storedInPinecone: boolean("stored_in_pinecone").default(false),
  pineconeId: text("pinecone_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertConversationMemorySchema = createInsertSchema(conversationMemories).omit({
  id: true,
  lastUpdatedAt: true,
  createdAt: true,
});

export type ConversationMemory = typeof conversationMemories.$inferSelect;
export type InsertConversationMemory = z.infer<typeof insertConversationMemorySchema>;

// Widget Lead Information
export const widgetLeads = pgTable("widget_leads", {
  id: serial("id").primaryKey(),
  widgetId: text("widget_id").references(() => widgets.id),
  anonymousUserId: integer("anonymous_user_id").references(() => anonymousWidgetUsers.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false),
  company: text("company"),
  phone: text("phone"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").default("new").notNull(), // new, contacted, converted, rejected
  metadata: json("metadata"),
  agent: text("agent").references(() => agents.id), // Storing agent ID (different from widgetId)
  tags: json("tags").$type<string[]>().default([]), // For categorization
  lastContactedAt: timestamp("last_contacted_at"), // Track when the lead was last contacted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  rateLimit: integer("rate_limit").default(0), // Used for rate limiting requests
  rateLimitReset: timestamp("rate_limit_reset"), // When rate limit should be reset
});

export const insertWidgetLeadSchema = createInsertSchema(widgetLeads).omit({
  id: true,
  emailVerified: true, // Always starts as false
  lastContactedAt: true,
  rateLimit: true,
  rateLimitReset: true,
  createdAt: true,
  updatedAt: true,
});

export type WidgetLead = typeof widgetLeads.$inferSelect;
export type InsertWidgetLead = z.infer<typeof insertWidgetLeadSchema>;

/// Scheduled Knowledge Updates
export const scheduledKnowledgeUpdates = pgTable("scheduled_knowledge_updates", {
  id: serial("id").primaryKey(),

  userId: serial("user_id").references(() => users.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id),

  knowledgeBaseIds: json("knowledge_base_ids").$type<number[]>().default([]).notNull(),

  name: text("name").notNull(),

  schedule: json("schedule").$type<{
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
    interval: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    specificTime?: string;
    customCron?: string;
  }>().notNull(),

  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),

  isActive: boolean("is_active").default(true).notNull(),

  options: json("options").$type<{
    refreshUrls: boolean;
    refreshPdfs: boolean;
    refreshYoutubeVideos: boolean;
    onlyOutdated: boolean;
    specificTags?: string[];
    specificDocumentIds?: number[];
  }>().default({
    refreshUrls: true,
    refreshPdfs: false,
    refreshYoutubeVideos: true,
    onlyOutdated: true,
    specificTags: [],
    specificDocumentIds: [],
  }).notNull(),

  runHistory: json("run_history").$type<any[]>().default([]).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScheduledKnowledgeUpdateSchema = createInsertSchema(scheduledKnowledgeUpdates).omit({
  id: true,
  lastRun: true,
  nextRun: true,
  runHistory: true,
  createdAt: true,
  updatedAt: true,
});

export type ScheduledKnowledgeUpdate = typeof scheduledKnowledgeUpdates.$inferSelect;
export type InsertScheduledKnowledgeUpdate = z.infer<typeof insertScheduledKnowledgeUpdateSchema>;

// Subscription Plans - Defines the different plans available in the system
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // "starter", "professional", "enterprise"
  displayName: text("display_name").notNull(), // User-friendly display name
  description: text("description").notNull(),
  monthlyPrice: integer("monthly_price").notNull(), // Price in cents
  annualPrice: integer("annual_price").notNull(), // Price in cents for annual billing
  features: json("features").$type<string[]>().default([]), // List of features included in the plan
  agentLimit: integer("agent_limit").notNull(), // Number of AI agents allowed
  knowledgeBaseLimit: integer("knowledge_base_limit").notNull(), // Number of knowledge bases allowed
  storageLimit: integer("storage_limit").notNull(), // Storage limit in bytes
  monthlyQuestionLimit: integer("monthly_question_limit").notNull(), // Monthly question limit
  includesAdvancedAnalytics: boolean("includes_advanced_analytics").default(false),
  includesApiAccess: boolean("includes_api_access").default(false),
  includesCustomDomains: boolean("includes_custom_domains").default(false),
  includesWidgetEmbedding: boolean("includes_widget_embedding").default(false),
  includesSsoIntegration: boolean("includes_sso_integration").default(false),
  includesCustomIntegrations: boolean("includes_custom_integrations").default(false),
  includesSlaGuarantee: boolean("includes_sla_guarantee").default(false),
  supportLevel: text("support_level").notNull(), // "community", "priority", "dedicated"
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0), // For ordering plans in the UI
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

// User Subscriptions - Tracks user subscriptions to plans
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  planId: serial("plan_id").references(() => subscriptionPlans.id).notNull(),
  status: text("status").notNull(), // "active", "canceled", "expired", "trial", "pastDue"
  billingPeriod: text("billing_period").notNull(), // "monthly", "annual"
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  trialEndDate: date("trial_end_date"),
  canceledAt: timestamp("canceled_at"),
  paymentProvider: text("payment_provider"), // "stripe", "paypal", etc.
  paymentProviderId: text("payment_provider_id"), // ID from the payment provider
  lastBillingDate: date("last_billing_date"),
  nextBillingDate: date("next_billing_date"),
  usageData: json("usage_data").$type<{
    currentAgentCount?: number;
    currentKbCount?: number;
    currentStorageUsed?: number;
    currentMonthQuestions?: number;
    lastUpdated?: string;
  }>().default({}),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

// Type aliases for backward compatibility
export type Subscription = UserSubscription;
export type InsertSubscription = InsertUserSubscription;

// Subscription Usage Metrics - Tracks detailed usage for billing and limits
export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  subscriptionId: serial("subscription_id").references(() => userSubscriptions.id).notNull(),
  metricType: text("metric_type").notNull(), // "agents_created", "kb_created", "storage_used", "questions_asked", etc.
  metricValue: integer("metric_value").notNull(), // The value of the metric
  periodStart: date("period_start").notNull(), // Start of the billing period
  periodEnd: date("period_end").notNull(), // End of the billing period
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUsageMetricSchema = createInsertSchema(usageMetrics).omit({
  id: true,
  createdAt: true,
});

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = z.infer<typeof insertUsageMetricSchema>;

// Subscription Payments - Tracks payment transactions for subscriptions
export const subscriptionPayments = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: serial("subscription_id").references(() => userSubscriptions.id).notNull(),
  amount: integer("amount").notNull(), // Amount in cents
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(), // "pending", "completed", "failed", "refunded"
  paymentProvider: text("payment_provider").notNull(), // "stripe", "paypal", etc.
  paymentProviderId: text("payment_provider_id"), // External payment ID
  paymentMethod: text("payment_method"), // "card", "bank_transfer", etc.
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPayments).omit({
  id: true,
  createdAt: true,
});

export type Payment = typeof subscriptionPayments.$inferSelect;
export type InsertPayment = z.infer<typeof insertSubscriptionPaymentSchema>;

// Daily usage metrics for more granular tracking and visualization
export const dailyUsageMetrics = pgTable("daily_usage_metrics", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  teamId: integer("team_id").references(() => teams.id),
  date: date("date").notNull(), // The date this metric is for
  metricType: text("metric_type").notNull(), // "api_requests", "words_used", "questions_asked", "storage_kb", "contacts_captured"
  metricValue: integer("metric_value").notNull(), // The value of the metric
  region: text("region"), // For geographic metrics (country code)
  storageType: text("storage_type"), // For storage metrics: "text", "media", "other"
  source: text("source"), // Source of the metric: "chat", "widget", "api", etc.
  metadata: json("metadata"), // Additional information
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailyUsageMetricSchema = createInsertSchema(dailyUsageMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyUsageMetric = typeof dailyUsageMetrics.$inferSelect;
export type InsertDailyUsageMetric = z.infer<typeof insertDailyUsageMetricSchema>;

// Feature Flags - Controls feature access for different subscription tiers
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  isGlobal: boolean("is_global").default(false), // If true, applies to all users
  isEnabled: boolean("is_enabled").default(true), // Global on/off switch
  allowedPlans: json("allowed_plans").$type<number[]>().default([]), // Which plan IDs have access
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Define resource type enum for permissions system
export const resourceTypeEnum = z.enum(['agent', 'knowledgeBase']);
export type ResourceType = z.infer<typeof resourceTypeEnum>;

// Team Resource Permissions table
export const teamResourcePermissions = pgTable("team_resource_permissions", {
  id: serial("id").primaryKey(),
  teamId: serial("team_id").references(() => teams.id).notNull(),
  resourceType: text("resource_type").notNull(), // 'agent' or 'knowledgeBase'
  resourceId: serial("resource_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: serial("created_by").references(() => users.id),
});

export const insertTeamResourcePermissionSchema = createInsertSchema(teamResourcePermissions).omit({
  id: true,
  createdAt: true,
});

export type TeamResourcePermission = typeof teamResourcePermissions.$inferSelect;
export type InsertTeamResourcePermission = z.infer<typeof insertTeamResourcePermissionSchema>;

// Member Resource Permissions table
export const memberResourcePermissions = pgTable("member_resource_permissions", {
  id: serial("id").primaryKey(),
  teamId: serial("team_id").references(() => teams.id).notNull(),
  userId: serial("user_id").references(() => users.id).notNull(),
  resourceType: text("resource_type").notNull(), // 'agent' or 'knowledgeBase'
  resourceId: serial("resource_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: serial("created_by").references(() => users.id),
});

export const insertMemberResourcePermissionSchema = createInsertSchema(memberResourcePermissions).omit({
  id: true,
  createdAt: true,
});

export type MemberResourcePermission = typeof memberResourcePermissions.$inferSelect;
export type InsertMemberResourcePermission = z.infer<typeof insertMemberResourcePermissionSchema>;

// Team Management System

// Teams table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: serial("owner_id").references(() => users.id).notNull(), // The creator/owner of the team
  description: text("description"),
  avatarUrl: text("avatar_url"),
  settings: json("settings"), // Team settings configuration
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// Role enum type
export const teamRoleEnum = z.enum(['admin', 'user']);
export type TeamRole = z.infer<typeof teamRoleEnum>;

// Team Members table
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: serial("team_id").references(() => teams.id).notNull(),
  userId: serial("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default('user'), // 'admin' or 'user'
  status: text("status").notNull().default('active'), // 'active', 'inactive', 'pending'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  status: true,
  joinedAt: true,
  updatedAt: true,
}).extend({
  role: teamRoleEnum,
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Team Invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: serial("team_id").references(() => teams.id).notNull(),
  invitedByUserId: serial("invited_by_user_id").references(() => users.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default('user'), // 'admin' or 'user'
  token: text("token").notNull().unique(), // Secure token for the invitation link
  status: text("status").notNull().default('pending'), // 'pending', 'accepted', 'expired', 'cancelled'
  expiresAt: timestamp("expires_at").notNull(), // 48 hours from creation by default
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"), // When the invitation was accepted
  acceptedByUserId: serial("accepted_by_user_id").references(() => users.id), // User who accepted the invitation
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true, 
  token: true, // Generated securely on the server
  status: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
  acceptedByUserId: true,
}).extend({
  role: teamRoleEnum,
});

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;

// (We already have the resource permissions defined above)

// Activity Log (Audit Trail) table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  teamId: serial("team_id").references(() => teams.id),
  userId: serial("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'invite', 'remove', etc.
  entityType: text("entity_type").notNull(), // 'team', 'user', 'invitation', 'document', 'knowledgeBase', 'agent', etc.
  entityId: text("entity_id").notNull(), // ID of the affected entity
  details: json("details"), // Additional details about the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Integration types enum
export const integrationTypeEnum = z.enum([
  'smtp',
  'slack',
  'zapier',
  'wordpress',
  'rss_feed',
  'sharepoint',
  'custom'
]);
export type IntegrationType = z.infer<typeof integrationTypeEnum>;

// Integration status enum
export const integrationStatusEnum = z.enum([
  'active',
  'inactive',
  'error',
  'pending_setup',
  'pending_auth'
]);
export type IntegrationStatus = z.infer<typeof integrationStatusEnum>;

// Integration Provider definition model
export const integrationProviders = pgTable("integration_providers", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'smtp', 'slack', 'zapier', etc.
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  oauthEnabled: boolean("oauth_enabled").default(false),
  oauthConfig: json("oauth_config").$type<{
    authorizationUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    scope?: string;
    redirectUri?: string;
  }>(),
  configSchema: json("config_schema").$type<{
    properties: Record<string, {
      type: string;
      title: string;
      description?: string;
      format?: string;
      enum?: string[];
      default?: any;
      required?: boolean;
      secret?: boolean;
    }>;
    required: string[];
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationProviderSchema = createInsertSchema(integrationProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type IntegrationProvider = typeof integrationProviders.$inferSelect;
export type InsertIntegrationProvider = z.infer<typeof insertIntegrationProviderSchema>;

// User Integration instances
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  teamId: serial("team_id").references(() => teams.id),
  providerId: serial("provider_id").references(() => integrationProviders.id).notNull(),
  type: text("type").notNull(), // Integration type (smtp, slack, etc.)
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default('pending_setup'),
  syncStatus: text("sync_status").default('idle'), // idle, syncing, error
  config: json("config").notNull(), // Configuration (encrypted sensitive values)
  credentials: json("credentials"), // OAuth tokens or other credentials (encrypted)
  oauthData: json("oauth_data"), // OAuth-specific data
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  lastErrorMessage: text("last_error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
  lastErrorMessage: true,
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

// Integration Logs for audit and troubleshooting
export const integrationLogs = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  integrationId: serial("integration_id").references(() => integrations.id).notNull(),
  eventType: text("event_type").notNull(), // 'sync', 'auth', 'error', 'info'
  message: text("message").notNull(),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntegrationLogSchema = createInsertSchema(integrationLogs).omit({
  id: true,
  createdAt: true,
});

export type IntegrationLog = typeof integrationLogs.$inferSelect;
export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;

// API Keys for Agent Access
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  teamId: integer("team_id").references(() => teams.id), // Optional: if associated with a team
  name: text("name").notNull(), // User-friendly label for the key
  keyPrefix: text("key_prefix").notNull(), // First few chars of the key for display (e.g., "beyask_")
  keyHash: text("key_hash").notNull(), // Securely hashed API key for verification
  scopes: json("scopes").$type<string[]>().default(['agent:read', 'agent:chat']), // Access scopes
  rateLimit: integer("rate_limit").default(100), // Requests per minute
  lastUsedAt: timestamp("last_used_at"), // Track last usage
  expiresAt: timestamp("expires_at"), // Optional expiration
  revoked: boolean("revoked").default(false), // Whether the key has been revoked
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  keyHash: true,
  keyPrefix: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Analytics Events for tracking user interactions
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  eventType: text("event_type").notNull(), // page_view, button_click, form_submit, etc.
  eventName: text("event_name").notNull(),
  properties: json("properties"), // Event-specific data
  metadata: json("metadata"), // Additional context
  sessionId: text("session_id"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Usage Records for tracking resource consumption
export const usageRecords = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  resourceType: text("resource_type").notNull(), // api_calls, storage_usage, bandwidth, etc.
  amount: integer("amount").notNull(),
  unit: text("unit").notNull(), // requests, bytes, tokens, etc.
  metadata: json("metadata"), // Additional context
  billingCycle: text("billing_cycle"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
});

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;