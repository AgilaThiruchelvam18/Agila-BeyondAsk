import { Integration, InsertIntegration } from '../../shared/schema';

/**
 * Integration Storage Interface
 * Defines all integration-related database operations with consistent signatures
 */
export interface IIntegrationStorage {
  // Core Integration CRUD operations
  getIntegration(id: string | number): Promise<Integration | undefined>;
  getIntegrationsByUserId(userId: string | number): Promise<Integration[]>;
  getIntegrationsByTeamId(teamId: string | number): Promise<Integration[]>;
  createIntegration(insertIntegration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string | number, integrationData: Partial<Integration>): Promise<Integration | undefined>;
  deleteIntegration(id: string | number): Promise<boolean>;
  
  // Integration type and provider operations
  getIntegrationsByType(type: string): Promise<Integration[]>;
  getIntegrationsByProvider(provider: string): Promise<Integration[]>;
  getActiveIntegrations(userId?: string | number): Promise<Integration[]>;
  getIntegrationByName(name: string, userId: string | number): Promise<Integration | undefined>;
  
  // Configuration and OAuth operations
  updateIntegrationConfig(id: string | number, config: any): Promise<Integration | undefined>;
  updateIntegrationOAuth(id: string | number, oauthData: any): Promise<Integration | undefined>;
  validateIntegrationConfig(id: string | number): Promise<boolean>;
  
  // Advanced integration operations
  searchIntegrations(params: {
    query?: string;
    type?: string;
    provider?: string;
    isActive?: boolean;
    userId?: number;
    teamId?: number;
    limit?: number;
    offset?: number;
  }): Promise<Integration[]>;
  
  getIntegrationStats(params: {
    userId?: number;
    teamId?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    active: number;
    byType: { type: string; count: number }[];
    byProvider: { provider: string; count: number }[];
  }>;
  
  // Integration health and monitoring
  getFailedIntegrations(userId?: string | number): Promise<Integration[]>;
  updateIntegrationStatus(id: string | number, isActive: boolean): Promise<Integration | undefined>;
}