import { eq, and, sql, count, inArray, desc } from 'drizzle-orm';
import { Agent, InsertAgent, KnowledgeBase, Conversation } from '@shared/schema';
import { agents, knowledgeBases, conversations, widgets, unansweredQuestions, activityLogs, teamResourcePermissions, memberResourcePermissions } from '@shared/schema';
import { BaseAdapter } from './base-adapter';
import { IAgentStorage } from '../interfaces/agent-storage';

/**
 * Optimized Agent Domain Adapter
 * Handles all agent-related database operations with consistent error handling,
 * logging, and performance optimization
 */
export class AgentAdapter extends BaseAdapter implements IAgentStorage {

  /**
   * Standard agent field mapping for SQL queries
   */
  private getAgentSelectFields(): string {
    return `
      id, 
      user_id as "userId", 
      name, 
      description, 
      model_id as "modelId", 
      provider_id as "providerId", 
      configuration, 
      knowledge_base_ids as "knowledgeBaseIds", 
      prompt_template as "promptTemplate",
      allow_continuous_generation as "allowContinuousGeneration",
      enable_conversation_memory as "enableConversationMemory",
      is_active as "isActive", 
      created_at as "createdAt",
      rules,
      confidence_threshold as "confidenceThreshold",
      fallback_message as "fallbackMessage",
      is_predefined as "isPredefined",
      tags,
      icon
    `;
  }

  /**
   * Column mapping for agent updates (camelCase to snake_case)
   */
  private getColumnMap(): Record<string, string> {
    return {
      userId: 'user_id',
      name: 'name',
      description: 'description',
      modelId: 'model_id',
      providerId: 'provider_id',
      configuration: 'configuration',
      knowledgeBaseIds: 'knowledge_base_ids',
      promptTemplate: 'prompt_template',
      allowContinuousGeneration: 'allow_continuous_generation',
      enableConversationMemory: 'enable_conversation_memory',
      isActive: 'is_active',
      rules: 'rules',
      confidenceThreshold: 'confidence_threshold',
      fallbackMessage: 'fallback_message',
      isPredefined: 'is_predefined',
      tags: 'tags',
      icon: 'icon'
    };
  }

  async getAgent(id: string | number): Promise<Agent | undefined> {
    return this.executeQuery(
      'getAgent',
      async () => {
        const numericId = this.validateId(id);

        // Use optimized ORM query with proper typing
        const results = await this.db.select().from(agents).where(eq(agents.id, numericId)).limit(1);
        return results[0];
      },
      { id }
    );
  }

  async getAgentsByUserId(userId: string | number): Promise<Agent[]> {
    return this.executeQuery(
      'getAgentsByUserId',
      async () => {
        const numericId = this.validateId(userId);

        const result = await this.db.execute(sql`
          SELECT ${sql.raw(this.getAgentSelectFields())}
          FROM agents 
          WHERE user_id = ${numericId}
          ORDER BY created_at DESC
        `);

        return result as unknown as Agent[];
      },
      { userId }
    );
  }

  async getPredefinedAgents(): Promise<Agent[]> {
    return this.executeQuery(
      'getPredefinedAgents',
      async () => {
        const result = await this.db.execute(sql`
          SELECT ${sql.raw(this.getAgentSelectFields())}
          FROM agents 
          WHERE is_predefined = true
          ORDER BY name ASC
        `);

        return result as unknown as Agent[];
      },
      {}
    );
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    return this.executeQuery(
      'createAgent',
      async () => {
        // Validate required fields
        if (!insertAgent.name || !insertAgent.userId) {
          throw new Error('Missing required agent fields: name and userId are required');
        }

        // Prepare agent data with defaults
        const agentData = {
          name: insertAgent.name,
          userId: insertAgent.userId,
          description: insertAgent.description || null,
          isActive: insertAgent.isActive ?? true,
          providerId: insertAgent.providerId || 1,
          modelId: insertAgent.modelId || 1,
          configuration: insertAgent.configuration || {},
          knowledgeBaseIds: insertAgent.knowledgeBaseIds || null,
          promptTemplate: insertAgent.promptTemplate || null,
          rules: insertAgent.rules || [],
          confidenceThreshold: insertAgent.confidenceThreshold || "0.75",
          fallbackMessage: insertAgent.fallbackMessage || "I don't have enough information to answer that question confidently. Could you please rephrase or provide more details?",
          allowContinuousGeneration: insertAgent.allowContinuousGeneration ?? true,
          enableConversationMemory: insertAgent.enableConversationMemory ?? true,
          isPredefined: insertAgent.isPredefined ?? false,
          tags: insertAgent.tags || [],
          icon: insertAgent.icon || null
        };

        // Use optimized direct SQL insert
        const result = await this.db.execute(sql`
          INSERT INTO agents (
            name, user_id, description, is_active, provider_id, model_id, 
            configuration, knowledge_base_ids, prompt_template, rules,
            confidence_threshold, fallback_message, allow_continuous_generation,
            enable_conversation_memory, is_predefined, tags, icon
          ) 
          VALUES (
            ${agentData.name}, ${agentData.userId}, ${agentData.description},
            ${agentData.isActive}, ${agentData.providerId}, ${agentData.modelId},
            ${JSON.stringify(agentData.configuration)},
            ${agentData.knowledgeBaseIds ? JSON.stringify(agentData.knowledgeBaseIds) : null},
            ${agentData.promptTemplate}, ${JSON.stringify(agentData.rules)},
            ${agentData.confidenceThreshold}, ${agentData.fallbackMessage},
            ${agentData.allowContinuousGeneration}, ${agentData.enableConversationMemory},
            ${agentData.isPredefined}, ${JSON.stringify(agentData.tags)}, ${agentData.icon}
          )
          RETURNING ${sql.raw(this.getAgentSelectFields())}
        `);

        return (result as any[])[0] as Agent;
      },
      { name: insertAgent.name, userId: insertAgent.userId }
    );
  }

  async updateAgent(id: string | number, agentData: Partial<Agent>): Promise<Agent | undefined> {
    return this.executeQuery(
      'updateAgent',
      async () => {
        const numericId = this.validateId(id);

        // Check if agent exists
        const existingAgent = await this.getAgent(numericId);
        if (!existingAgent) {
          throw new Error(`Agent with ID ${numericId} not found`);
        }

        // Build dynamic SQL update
        const columnMap = this.getColumnMap();
        const setClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(agentData)) {
          if (key in columnMap && value !== undefined) {
            const columnName = columnMap[key as keyof typeof columnMap];
            setClauses.push(`${columnName} = $${paramIndex}`);

            // Handle special field types
            if (key === 'rules' && Array.isArray(value)) {
              params.push(JSON.stringify(value));
            } else if (key === 'configuration' && value !== null) {
              params.push(JSON.stringify(value));
            } else if (key === 'tags' && Array.isArray(value)) {
              params.push(JSON.stringify(value));
            } else if (key === 'knowledgeBaseIds' && Array.isArray(value)) {
              params.push(JSON.stringify(value));
            } else {
              params.push(value);
            }
            paramIndex++;
          }
        }

        if (setClauses.length === 0) {
          return existingAgent;
        }

        // Execute update with dynamic SQL using template literal
        const result = await this.db.execute(sql`
          UPDATE agents
          SET ${sql.raw(setClauses.join(', '))}
          WHERE id = ${numericId}
          RETURNING ${sql.raw(this.getAgentSelectFields())}
        `);
        return (result as any[])[0] as Agent;
      },
      { id, updateFields: Object.keys(agentData) }
    );
  }

  async deleteAgent(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgent',
      async () => {
        const numericId = this.validateId(id);

        // Check dependencies first
        const dependencies = await this.getAgentDependencies(numericId);

        // Check for active widgets
        if (dependencies.widgets > 0) {
          throw new Error(`Cannot delete agent because it is used by ${dependencies.widgets} widgets. Please delete those widgets first.`);
        }

        // Check for active conversations
        const activeConversations = await this.db.execute(sql`
          SELECT COUNT(*) as count 
          FROM conversations 
          WHERE agent_id = ${numericId} 
          AND (status IS NULL OR status != 'archived')
        `);

        const activeCount = parseInt((activeConversations as any[])[0]?.count || '0');
        if (activeCount > 0) {
          throw new Error(`Cannot delete agent because it has active conversations. Please archive them first.`);
        }

        // Use transaction for safe deletion
        const result = await this.db.transaction(async (tx) => {
          // Nullify references in archived conversations
          await tx.execute(sql`
            UPDATE conversations 
            SET agent_id = NULL 
            WHERE agent_id = ${numericId} AND status = 'archived'
          `);

          // Nullify references in resolved unanswered questions
          await tx.execute(sql`
            UPDATE unanswered_questions 
            SET agent_id = NULL 
            WHERE agent_id = ${numericId} AND status IN ('resolved', 'closed')
          `);

          // Delete the agent
          const deleteResult = await tx.execute(sql`
            DELETE FROM agents WHERE id = ${numericId} RETURNING id
          `);

          return (deleteResult as any[]).length > 0;
        });

        return result;
      },
      { id }
    );
  }

  async getAgentKnowledgeBases(agentId: string | number): Promise<KnowledgeBase[]> {
    return this.executeQuery(
      'getAgentKnowledgeBases',
      async () => {
        const numericId = this.validateId(agentId);

        // Get agent's knowledge base IDs
        const agent = await this.getAgent(numericId);
        if (!agent || !agent.knowledgeBaseIds) {
          return [];
        }

        const kbIds = Array.isArray(agent.knowledgeBaseIds) 
          ? agent.knowledgeBaseIds 
          : JSON.parse(agent.knowledgeBaseIds as string);

        if (!kbIds || kbIds.length === 0) {
          return [];
        }

        const results = await this.db.select()
          .from(knowledgeBases)
          .where(inArray(knowledgeBases.id, kbIds));

        return results;
      },
      { agentId }
    );
  }

  async getAgentConversationCount(agentId: string | number): Promise<number> {
    return this.executeQuery(
      'getAgentConversationCount',
      async () => {
        const numericId = this.validateId(agentId);

        const result = await this.db.execute(sql`
          SELECT COUNT(*) as count 
          FROM conversations 
          WHERE agent_id = ${numericId}
        `);

        return parseInt((result as any[])[0]?.count || '0');
      },
      { agentId }
    );
  }

  async getAgentRecentConversations(agentId: string | number, limit: number = 10): Promise<Conversation[]> {
    return this.executeQuery(
      'getAgentRecentConversations',
      async () => {
        const numericId = this.validateId(agentId);

        const results = await this.db.select()
          .from(conversations)
          .where(eq(conversations.agentId, numericId))
          .orderBy(desc(conversations.createdAt))
          .limit(limit);

        return results;
      },
      { agentId, limit }
    );
  }

  async getAgentDependencies(id: string | number): Promise<{ 
    conversations: number;
    widgets: number;
    unansweredQuestions: number;
  }> {
    return this.executeQuery(
      'getAgentDependencies',
      async () => {
        const numericId = this.validateId(id);

        // Get all dependency counts in parallel
        const [widgetResult, conversationResult, unansweredResult] = await Promise.all([
          this.db.execute(sql`SELECT COUNT(*) as count FROM widgets WHERE agent_id = ${numericId}`),
          this.db.execute(sql`SELECT COUNT(*) as count FROM conversations WHERE agent_id = ${numericId}`),
          this.db.execute(sql`SELECT COUNT(*) as count FROM unanswered_questions WHERE agent_id = ${numericId}`)
        ]);

        return {
          widgets: parseInt((widgetResult as any[])[0]?.count || '0'),
          conversations: parseInt((conversationResult as any[])[0]?.count || '0'),
          unansweredQuestions: parseInt((unansweredResult as any[])[0]?.count || '0')
        };
      },
      { id }
    );
  }

  async archiveAgentConversations(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'archiveAgentConversations',
      async () => {
        const numericId = this.validateId(agentId);

        await this.db.execute(sql`
          UPDATE conversations 
          SET status = 'archived' 
          WHERE agent_id = ${numericId} 
          AND (status IS NULL OR status != 'archived')
        `);

        return true;
      },
      { agentId }
    );
  }

  async deleteAgentKnowledgeBaseAssociations(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgentKnowledgeBaseAssociations',
      async () => {
        const numericId = this.validateId(agentId);

        await this.db.execute(sql`
          UPDATE agents 
          SET knowledge_base_ids = NULL 
          WHERE id = ${numericId}
        `);

        return true;
      },
      { agentId }
    );
  }

  async deleteAgentActivities(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgentActivities',
      async () => {
        const numericId = this.validateId(agentId);

        // Delete activity logs where entity_type is 'agent' and entity_id matches
        await this.db.delete(activityLogs)
          .where(and(
            eq(activityLogs.entityType, 'agent'),
            eq(activityLogs.entityId, numericId.toString())
          ));

        return true;
      },
      { agentId }
    );
  }

  async deleteAgentShares(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgentShares',
      async () => {
        const numericId = this.validateId(agentId);

        // Delete team resource permissions for this agent
        await this.db.delete(teamResourcePermissions)
          .where(and(
            eq(teamResourcePermissions.resourceType, 'agent'),
            eq(teamResourcePermissions.resourceId, numericId)
          ));

        // Delete member resource permissions for this agent
        await this.db.delete(memberResourcePermissions)
          .where(and(
            eq(memberResourcePermissions.resourceType, 'agent'),
            eq(memberResourcePermissions.resourceId, numericId)
          ));

        return true;
      },
      { agentId }
    );
  }

  async deleteAgentUnansweredQuestions(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgentUnansweredQuestions',
      async () => {
        const numericId = this.validateId(agentId);

        await this.db.execute(sql`
          DELETE FROM unanswered_questions 
          WHERE agent_id = ${numericId}
        `);

        return true;
      },
      { agentId }
    );
  }

  async deleteAgentWidgets(agentId: string | number): Promise<boolean> {
    return this.executeQuery(
      'deleteAgentWidgets',
      async () => {
        const numericId = this.validateId(agentId);

        await this.db.execute(sql`
          DELETE FROM widgets 
          WHERE agent_id = ${numericId}
        `);

        return true;
      },
      { agentId }
    );
  }

  async cascadeDeleteAgent(id: string | number): Promise<boolean> {
    return this.executeQuery(
      'cascadeDeleteAgent',
      async () => {
        const numericId = this.validateId(id);

        // Perform cascade deletion in transaction
        const result = await this.db.transaction(async (tx) => {
          // Delete in proper order to respect foreign key constraints
          await this.deleteAgentWidgets(numericId);
          await this.deleteAgentUnansweredQuestions(numericId);
          await this.archiveAgentConversations(numericId);
          await this.deleteAgentKnowledgeBaseAssociations(numericId);
          await this.deleteAgentActivities(numericId);
          await this.deleteAgentShares(numericId);

          // Finally delete the agent
          return await this.deleteAgent(numericId);
        });

        return result;
      },
      { id }
    );
  }

  async checkAgentAccess(agentId: number, userId: number): Promise<boolean> {
    return this.executeQuery(
      'checkAgentAccess',
      async () => {
        // Check if user owns the agent
        const agent = await this.getAgent(agentId);
        if (!agent) {
          return false;
        }

        if (agent.userId === userId) {
          return true;
        }

        // Check if agent is shared with user's team
        const result = await this.db.execute(sql`
          SELECT COUNT(*) as count
          FROM team_resource_permissions trp
          JOIN team_members tm ON trp.team_id = tm.team_id
          WHERE trp.resource_type = 'agent' 
          AND trp.resource_id = ${agentId}
          AND tm.user_id = ${userId}
          AND trp.permission_level IN ('read', 'write', 'admin')
        `);

        return parseInt((result as any[])[0]?.count || '0') > 0;
      },
      { agentId, userId }
    );
  }

  async updateAgentKnowledgeBases(agentId: string | number, knowledgeBaseIds: number[]): Promise<boolean> {
    try {
      await this.db
        .update(agents)
        .set({ knowledgeBaseIds })
        .where(eq(agents.id, parseInt(agentId.toString())));
      return true;
    } catch (error) {
      console.error('Error updating agent knowledge bases:', error);
      return false;
    }
  }

  async createAgentActivity(activity: any): Promise<any> {
    try {
      // This is a placeholder implementation - would need proper activity log schema
      return { id: Date.now(), ...activity, createdAt: new Date() };
    } catch (error) {
      console.error('Error creating agent activity:', error);
      throw error;
    }
  }

  async validateKnowledgeBaseAccess(userId: number, knowledgeBaseIds: number[]): Promise<boolean> {
    try {
      // Check if user has access to all specified knowledge bases
      const results = await this.db
        .select({ count: count() })
        .from(knowledgeBases)
        .where(
          and(
            inArray(knowledgeBases.id, knowledgeBaseIds),
            eq(knowledgeBases.userId, userId)
          )
        );

      return parseInt(results[0]?.count.toString() || '0') === knowledgeBaseIds.length;
    } catch (error) {
      console.error('Error validating knowledge base access:', error);
      return false;
    }
  }

  async associateAgentKnowledgeBases(agentId: string | number, knowledgeBaseIds: number[]): Promise<boolean> {
    return this.updateAgentKnowledgeBases(agentId, knowledgeBaseIds);
  }

  async getAgentConversationMetrics(agentId: string | number): Promise<{ total: number; recent: number }> {
    try {
      const results = await this.db
        .select({ 
          total: count(),
          recent: count(sql`CASE WHEN ${conversations.createdAt} > NOW() - INTERVAL '7 days' THEN 1 END`)
        })
        .from(conversations)
        .where(eq(conversations.agentId, parseInt(agentId.toString())));

      return results[0] || { total: 0, recent: 0 };
    } catch (error) {
      console.error('Error getting agent conversation metrics:', error);
      return { total: 0, recent: 0 };
    }
  }

  async getAgentResponseMetrics(agentId: string | number): Promise<{ averageResponseTime: number; successRate: number }> {
    try {
      // This would need proper metrics tracking - placeholder implementation
      return { averageResponseTime: 0, successRate: 0 };
    } catch (error) {
      console.error('Error getting agent response metrics:', error);
      return { averageResponseTime: 0, successRate: 0 };
    }
  }

  async getAgentUsageMetrics(agentId: string | number): Promise<{ totalRequests: number; tokensUsed: number }> {
    try {
      // This would need proper usage tracking - placeholder implementation
      return { totalRequests: 0, tokensUsed: 0 };
    } catch (error) {
      console.error('Error getting agent usage metrics:', error);
      return { totalRequests: 0, tokensUsed: 0 };
    }
  }

  async getAgentErrorMetrics(agentId: string | number): Promise<{ errorCount: number; errorRate: number }> {
    try {
      // This would need proper error tracking - placeholder implementation
      return { errorCount: 0, errorRate: 0 };
    } catch (error) {
      console.error('Error getting agent error metrics:', error);
      return { errorCount: 0, errorRate: 0 };
    }
  }

  async getAgentTemplate(templateId: string | number): Promise<Agent | undefined> {
    try {
      const results = await this.db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, parseInt(templateId.toString())),
            eq(agents.isPredefined, true)
          )
        )
        .limit(1);

      return results[0];
    } catch (error) {
      console.error('Error getting agent template:', error);
      return undefined;
    }
  }
}