import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { Drive, DriveItem, Site } from '@microsoft/microsoft-graph-types';
import 'isomorphic-fetch'; // Required for Microsoft Graph client to work
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

// Convert callback-based functions to Promise-based
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

interface SharePointConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface SharePointSite {
  id: string;
  name: string;
  url: string;
}

export interface SharePointDrive {
  id: string;
  name: string;
  webUrl: string;
  driveType: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  mimeType: string;
  isFolder: boolean;
  parentId?: string;
}

/**
 * SharePoint Service
 * Handles authentication and file operations with SharePoint via Microsoft Graph API
 */
export class SharePointService {
  private authClient: ConfidentialClientApplication | null = null;
  private graphClient: Client | null = null;
  private config: SharePointConfig | null = null;
  private tempDir: string;

  constructor() {
    // Create temp directory for file downloads
    this.tempDir = path.join(os.tmpdir(), 'sharepoint-downloads');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Initialize the SharePoint service with credentials
   */
  initialize(config: SharePointConfig): void {
    this.config = config;

    // Create MSAL authentication client
    this.authClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });
  }

  /**
   * Create and initialize the Graph client
   */
  private async getGraphClient(): Promise<Client> {
    if (!this.config) {
      throw new Error('SharePoint service not initialized');
    }

    if (this.graphClient) {
      return this.graphClient;
    }

    try {
      // Get access token for Microsoft Graph
      const result = await this.authClient!.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      if (!result?.accessToken) {
        throw new Error('Failed to acquire access token');
      }

      // Create Microsoft Graph client
      this.graphClient = Client.init({
        authProvider: (done) => {
          done(null, result.accessToken);
        },
      });

      return this.graphClient;
    } catch (error) {
      console.error('Error initializing graph client:', error);
      throw new Error(`Failed to initialize Microsoft Graph client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all SharePoint sites accessible to the authenticated user
   */
  async getSites(): Promise<SharePointSite[]> {
    try {
      const client = await this.getGraphClient();
      const response = await client
        .api('/sites')
        .select('id,displayName,webUrl')
        .get();

      return response.value.map((site: any) => ({
        id: site.id,
        name: site.displayName,
        url: site.webUrl,
      }));
    } catch (error) {
      console.error('Error getting SharePoint sites:', error);
      throw new Error(`Failed to retrieve SharePoint sites: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get drives (document libraries) for a specific SharePoint site
   */
  async getDrives(siteId: string): Promise<SharePointDrive[]> {
    try {
      const client = await this.getGraphClient();
      const response = await client
        .api(`/sites/${siteId}/drives`)
        .select('id,name,webUrl,driveType')
        .get();

      return response.value.map((drive: Drive) => ({
        id: drive.id!,
        name: drive.name!,
        webUrl: drive.webUrl!,
        driveType: drive.driveType!,
      }));
    } catch (error) {
      console.error('Error getting drives:', error);
      throw new Error(`Failed to retrieve drives for site: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get files and folders within a drive or folder
   */
  async getItems(
    driveId: string,
    folderId: string = 'root'
  ): Promise<SharePointFile[]> {
    try {
      const client = await this.getGraphClient();
      const endpoint = folderId === 'root'
        ? `/drives/${driveId}/root/children`
        : `/drives/${driveId}/items/${folderId}/children`;

      const response = await client
        .api(endpoint)
        .select('id,name,webUrl,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference')
        .get();

      return response.value.map((item: DriveItem) => ({
        id: item.id!,
        name: item.name!,
        webUrl: item.webUrl!,
        size: item.size || 0,
        createdDateTime: item.createdDateTime!,
        lastModifiedDateTime: item.lastModifiedDateTime!,
        mimeType: item.file?.mimeType || '',
        isFolder: !!item.folder,
        parentId: item.parentReference?.id,
      }));
    } catch (error) {
      console.error('Error getting items:', error);
      throw new Error(`Failed to retrieve items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download a file from SharePoint and save it locally
   */
  async downloadFile(driveId: string, itemId: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    try {
      const client = await this.getGraphClient();
      
      // Get file metadata first
      const fileInfo = await client
        .api(`/drives/${driveId}/items/${itemId}`)
        .select('name,file')
        .get();
      
      // Generate a unique filename to avoid collisions
      const fileName = fileInfo.name;
      const uniqueFileName = `${uuidv4()}-${fileName}`;
      const filePath = path.join(this.tempDir, uniqueFileName);
      
      // Download the file content
      const response = await client
        .api(`/drives/${driveId}/items/${itemId}/content`)
        .get();
      
      // Create a buffer from the response
      const buffer = await response.arrayBuffer();
      
      // Write the file to disk
      await writeFileAsync(filePath, Buffer.from(buffer));
      
      return {
        filePath,
        fileName,
        mimeType: fileInfo.file.mimeType || 'application/octet-stream',
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for files in SharePoint
   */
  async searchFiles(query: string): Promise<SharePointFile[]> {
    try {
      const client = await this.getGraphClient();
      const response = await client
        .api('/search/query')
        .post({
          requests: [
            {
              entityTypes: ['driveItem'],
              query: {
                queryString: query,
              },
              from: 0,
              size: 25,
            },
          ],
        });

      // Process and map the search results
      const results: SharePointFile[] = [];
      if (response.value && response.value[0].hitsContainers) {
        for (const container of response.value[0].hitsContainers) {
          for (const hit of container.hits) {
            const resource = hit.resource;
            results.push({
              id: resource.id,
              name: resource.name,
              webUrl: resource.webUrl,
              size: resource.size || 0,
              createdDateTime: resource.createdDateTime,
              lastModifiedDateTime: resource.lastModifiedDateTime,
              mimeType: resource.file?.mimeType || '',
              isFolder: !!resource.folder,
              parentId: resource.parentReference?.id,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching files:', error);
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default new SharePointService();