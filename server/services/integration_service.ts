import { storage } from '../storage';
import { 
  Integration, 
  IntegrationProvider, 
  IntegrationLog,
  IntegrationStatus,
  insertIntegrationSchema,
  insertIntegrationLogSchema
} from '@shared/schema';
import { z } from 'zod';

/**
 * Service for managing integrations and integration providers
 */
export class IntegrationService {
  
  /**
   * Get all integration providers
   */
  static async getAllProviders(): Promise<IntegrationProvider[]> {
    return await storage.getAllIntegrationProviders();
  }
  
  /**
   * Get an integration provider by ID
   */
  static async getProvider(id: number): Promise<IntegrationProvider | undefined> {
    return await storage.getIntegrationProvider(id);
  }
  
  /**
   * Get an integration provider by type
   */
  static async getProviderByType(type: string): Promise<IntegrationProvider | undefined> {
    return await storage.getIntegrationProviderByType(type);
  }
  
  /**
   * Get user's integrations (personal or team)
   */
  static async getUserIntegrations(userId: number): Promise<Integration[]> {
    return await storage.getIntegrationsByUserId(userId);
  }
  
  /**
   * Get team integrations
   */
  static async getTeamIntegrations(teamId: number): Promise<Integration[]> {
    return await storage.getIntegrationsByTeamId(teamId);
  }
  
  /**
   * Get an integration by ID and ensure the user has access
   */
  static async getIntegration(id: number, userId: number): Promise<Integration | undefined> {
    const integration = await storage.getIntegration(id);
    
    if (!integration) {
      return undefined;
    }
    
    // Check if user has access to this integration
    // Either it's the user's personal integration or they are a member of the team
    if (integration.userId === userId) {
      return integration;
    }
    
    if (integration.teamId) {
      // Check if user is a member of the team
      const isTeamMember = await storage.isTeamMember(integration.teamId, userId);
      if (isTeamMember) {
        return integration;
      }
    }
    
    return undefined;
  }

  /**
   * Create a new integration
   */
  static async createIntegration(
    userId: number,
    integrationData: z.infer<typeof insertIntegrationSchema>,
    teamId?: number
  ): Promise<Integration> {
    try {
      // Ensure the provider exists
      if (!integrationData.providerId) {
        throw new Error('Provider ID is required');
      }
      const provider = await storage.getIntegrationProvider(Number(integrationData.providerId));
      if (!provider) {
        throw new Error('Integration provider not found');
      }
      
      // Create the integration
      const integration = await storage.createIntegration({
        ...integrationData,
        userId,
        teamId: teamId || null,
        status: integrationData.status || 'inactive'
      });
      
      // Log the creation
      await this.logIntegrationEvent(
        integration.id, 
        'Integration created',
        'create'
      );
      
      return integration;
    } catch (error) {
      console.error('Error creating integration:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing integration
   */
  static async updateIntegration(
    id: number,
    userId: number,
    updateData: Partial<Integration>
  ): Promise<Integration | undefined> {
    try {
      // Get the integration and check permissions
      const integration = await this.getIntegration(id, userId);
      if (!integration) {
        throw new Error('Integration not found or you do not have access');
      }
      
      // Update the integration
      const updatedIntegration = await storage.updateIntegration(id, {
        ...updateData,
        updatedAt: new Date()
      });
      
      if (updatedIntegration) {
        // Log the update
        await this.logIntegrationEvent(
          integration.id, 
          'Integration updated',
          'update'
        );
      }
      
      return updatedIntegration;
    } catch (error) {
      console.error('Error updating integration:', error);
      throw error;
    }
  }
  
  /**
   * Delete an integration
   */
  static async deleteIntegration(id: number, userId: number): Promise<boolean> {
    try {
      // Get the integration and check permissions
      const integration = await this.getIntegration(id, userId);
      if (!integration) {
        throw new Error('Integration not found or you do not have access');
      }
      
      // Delete the integration (also deletes logs)
      const success = await storage.deleteIntegration(id);
      
      return success;
    } catch (error) {
      console.error('Error deleting integration:', error);
      throw error;
    }
  }
  
  /**
   * Get logs for an integration
   */
  static async getIntegrationLogs(integrationId: number, userId: number): Promise<IntegrationLog[]> {
    try {
      // Check if user has access to this integration
      const integration = await this.getIntegration(integrationId, userId);
      if (!integration) {
        throw new Error('Integration not found or you do not have access');
      }
      
      return await storage.getIntegrationLogsByIntegrationId(integrationId);
    } catch (error) {
      console.error('Error getting integration logs:', error);
      throw error;
    }
  }
  
  /**
   * Log an integration event
   */
  static async logIntegrationEvent(
    integrationId: number,
    message: string,
    eventType: string,
    details: any = {}
  ): Promise<IntegrationLog> {
    try {
      return await storage.createIntegrationLog({
        integrationId,
        message,
        eventType,
        details
      });
    } catch (error) {
      console.error('Error logging integration event:', error);
      throw error;
    }
  }
  
  /**
   * Initialize default integration providers
   * Used during application startup to ensure basic providers exist
   */
  static async initializeDefaultProviders(): Promise<void> {
    try {
      const existingProviders = await storage.getAllIntegrationProviders();
      
      // Define default providers to initialize if they don't exist
      const defaultProviders = [
        {
          name: 'Google Drive',
          type: 'google_drive',
          description: 'Connect to Google Drive to import documents and files',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png',
          isActive: true,
          oauthEnabled: true,
          oauthConfig: {
            authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/drive.readonly',
          },
          configSchema: {
            properties: {
              folder_id: {
                type: 'string',
                title: 'Folder ID (Optional)',
                description: 'ID of the specific folder to access. Leave empty for the root folder.',
                required: false
              }
            },
            required: []
          }
        },
        {
          name: 'Microsoft SharePoint',
          type: 'sharepoint',
          description: 'Connect to SharePoint sites to import documents and files',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg',
          isActive: true,
          oauthEnabled: true,
          oauthConfig: {
            authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            scope: 'Files.Read.All Sites.Read.All',
          },
          configSchema: {
            properties: {
              site_url: {
                type: 'string',
                title: 'SharePoint Site URL',
                description: 'The full URL of your SharePoint site',
                required: true
              },
              library_name: {
                type: 'string',
                title: 'Document Library Name',
                description: 'Name of the document library (default: Documents)',
                required: false
              }
            },
            required: ['site_url']
          }
        },
        {
          name: 'Slack',
          type: 'slack',
          description: 'Connect to Slack to import conversation history and files',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
          isActive: true,
          oauthEnabled: true,
          oauthConfig: {
            authorizationUrl: 'https://slack.com/oauth/v2/authorize',
            tokenUrl: 'https://slack.com/api/oauth.v2.access',
            scope: 'channels:history channels:read',
          },
          configSchema: {
            properties: {
              channel_ids: {
                type: 'string',
                title: 'Channel IDs (comma-separated)',
                description: 'IDs of specific channels to import. Leave empty to import all accessible channels.',
                required: false
              }
            },
            required: []
          }
        },
        {
          name: 'Notion',
          type: 'notion',
          description: 'Connect to Notion to import pages and databases',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg',
          isActive: true,
          oauthEnabled: false,
          configSchema: {
            properties: {
              api_key: {
                type: 'string',
                title: 'Integration Token',
                description: 'Your Notion integration token (from Notion Integrations page)',
                required: true,
                secret: true
              },
              root_page_id: {
                type: 'string',
                title: 'Root Page ID (Optional)',
                description: 'ID of a specific page to access. Leave empty to access all available content.',
                required: false
              }
            },
            required: ['api_key']
          }
        },
        {
          name: 'Jira',
          type: 'jira',
          description: 'Connect to Jira to import issues and project data',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Jira_Logo.svg',
          isActive: true,
          oauthEnabled: false,
          configSchema: {
            properties: {
              site_url: {
                type: 'string',
                title: 'Jira Site URL',
                description: 'Your Jira site URL (e.g., https://your-domain.atlassian.net)',
                required: true
              },
              email: {
                type: 'string',
                title: 'Email',
                description: 'Email address associated with your Jira account',
                required: true
              },
              api_token: {
                type: 'string',
                title: 'API Token',
                description: 'Your Jira API token (from Atlassian account settings)',
                required: true,
                secret: true
              },
              project_key: {
                type: 'string',
                title: 'Project Key (Optional)',
                description: 'Specific Jira project key to focus on. Leave empty to access all projects.',
                required: false
              }
            },
            required: ['site_url', 'email', 'api_token']
          }
        }
      ];
      
      // Create default providers if they don't exist
      for (const providerData of defaultProviders) {
        const existingProvider = existingProviders.find(p => p.type === providerData.type);
        
        if (!existingProvider) {
          await storage.createIntegrationProvider(providerData as any);
          console.log(`Created default integration provider: ${providerData.name}`);
        }
      }
      
      console.log('Default integration providers initialized');
    } catch (error) {
      console.error('Error initializing default integration providers:', error);
    }
  }
}

export default IntegrationService;