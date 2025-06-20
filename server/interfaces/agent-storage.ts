import { Agent, InsertAgent } from '@shared/schema';

/**
 * Agent Storage Interface
 * Defines the contract for agent domain operations
 */
export interface IAgentStorage {
  // Core CRUD operations
  getAgent(id: string | number): Promise<Agent | undefined>;
  getAgentsByUserId(userId: string | number): Promise<Agent[]>;
  getPredefinedAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string | number, agent: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string | number): Promise<boolean>;

  // Relationship operations
  getAgentKnowledgeBases(agentId: string | number): Promise<any[]>;
  getAgentConversationCount(agentId: string | number): Promise<number>;
  getAgentRecentConversations(agentId: string | number, limit?: number): Promise<any[]>;
  
  // Dependency management
  getAgentDependencies(id: string | number): Promise<{ 
    conversations: number;
    widgets: number;
    unansweredQuestions: number;
  }>;
  
  // Cascade operations
  archiveAgentConversations(agentId: string | number): Promise<boolean>;
  deleteAgentKnowledgeBaseAssociations(agentId: string | number): Promise<boolean>;
  deleteAgentActivities(agentId: string | number): Promise<boolean>;
  deleteAgentShares(agentId: string | number): Promise<boolean>;
  deleteAgentUnansweredQuestions(agentId: string | number): Promise<boolean>;
  deleteAgentWidgets(agentId: string | number): Promise<boolean>;
  cascadeDeleteAgent(id: string | number): Promise<boolean>;
  
  // Access control
  checkAgentAccess(agentId: number, userId: number): Promise<boolean>;
}