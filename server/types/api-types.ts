/**
 * API Type Definitions
 * Centralized type definitions for API requests and responses
 */

// Import Json type from shared schema
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Document related types
export interface DocumentMetadata {
  title?: string;
  sourceType?: string;
  notes?: string;
  customFields?: Record<string, any>;
  providerId?: string;
  providerIdNum?: number;
  model?: string;
  autoMode?: boolean;
  lastQuery?: string;
  isYoutubeDocument?: boolean;
  youtubeContentPreserved?: boolean;
  chunk_count?: number;
  [key: string]: any;
}

export interface ProcessedDocument {
  chunks: Array<{
    content: string;
    metadata: any;
  }>;
  metadata: any;
  text?: string; // Optional text property for YouTube documents
}

// Widget related types
export interface WidgetLead {
  id: number;
  email: string;
  name: string;
  notes?: string;
  createdAt: Date;
  agentId: number;
}

// Authentication types
export interface AuthUser {
  id: number;
  authId: string;
  email: string;
  name?: string;
  profilePicture?: string;
}

// Conversation types
export interface ConversationSummary {
  id: number;
  createdAt: Date;
  userId: number | null;
  conversationId: number;
  summary: string;
  messageCount: number;
  lastUpdatedAt: Date;
  storedInPinecone: boolean | null;
  pineconeId: string | null;
  lastQuery?: string;
}

// Integration types
export interface IntegrationProvider {
  id: string;
  name: string;
  type: string;
  region?: string;
  baseUrl?: string;
  authType: 'api_key' | 'oauth' | 'basic';
  fields: IntegrationField[];
}

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Automation types
export interface AutomationJob {
  name: string;
  schedule: {
    frequency: string;
    interval: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    specificTime?: string;
    customCron?: string;
  };
  options?: {
    refreshUrls: boolean;
    refreshPdfs: boolean;
    refreshYoutubeVideos: boolean;
    onlyOutdated: boolean;
    specificTags?: string[];
    specificDocumentIds?: number[];
  };
}

// Metrics types
export interface UsageMetric {
  type: string;
  sizeKb: number;
}

// File upload types
export interface FileUploadResult {
  success: boolean;
  filename?: string;
  filepath?: string;
  error?: string;
}

// Search types
export interface SearchResult {
  id: number;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// Request/Response wrappers
export interface ApiRequest<T = any> {
  body: T;
  query: Record<string, string>;
  params: Record<string, string>;
  user?: AuthUser;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}