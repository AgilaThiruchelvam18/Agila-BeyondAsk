import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { processPdf, processText } from './document_processor';
import { createAndStoreEmbeddings } from './embedding_service';
import { SubscriptionService } from './subscription_service';
import sharePointService from './sharepoint-service';

interface SharePointConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

/**
 * Process a SharePoint file to extract content, generate embeddings, and store in the knowledge base
 * @param document The document record
 * @param driveId SharePoint drive ID
 * @param fileId SharePoint file ID
 * @param userId User ID
 * @param knowledgeBaseId Knowledge base ID
 * @returns Promise resolving when processing completes
 */
export async function processSharePointFile(
  document: any,
  driveId: string,
  fileId: string,
  userId: number,
  knowledgeBaseId: number
): Promise<void> {
  try {
    console.log(`Processing SharePoint file for document ID ${document.id}: Drive ${driveId}, File ${fileId}`);
    
    // Update document status to processing
    await storage.updateDocument(document.id, {
      status: 'processing',
      processingInfo: {
        started_at: new Date().toISOString(),
        step: 'downloading'
      }
    });

    // Get SharePoint credentials from environment
    const config: SharePointConfig = {
      clientId: process.env.SHAREPOINT_CLIENT_ID || '',
      clientSecret: process.env.SHAREPOINT_CLIENT_SECRET || '',
      tenantId: process.env.SHAREPOINT_TENANT_ID || '',
      redirectUri: process.env.SHAREPOINT_REDIRECT_URI || '',
    };

    // Initialize SharePoint service
    sharePointService.initialize(config);

    // Download the file from SharePoint
    const downloadedFile = await sharePointService.downloadFile(driveId, fileId);
    console.log(`Downloaded SharePoint file: ${downloadedFile.fileName} (${downloadedFile.mimeType})`);

    // Update document with file info
    await storage.updateDocument(document.id, {
      processingInfo: {
        ...(document.processingInfo as any || {}),
        step: 'processing_file',
        fileName: downloadedFile.fileName,
        mimeType: downloadedFile.mimeType
      }
    });

    // Process the file based on type
    let processedContent: any = null;
    const filePath = downloadedFile.filePath;
    const mimeType = downloadedFile.mimeType;

    if (mimeType === 'application/pdf') {
      // Process PDF file
      console.log(`Processing PDF file: ${filePath}`);
      const pdfBuffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      processedContent = await processPdf(
        pdfBuffer, 
        filename, 
        {
          document_id: document.id.toString(),
          custom_fields: (document.metadata as any)?.custom_fields || {},
        }
      );
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      // Process text file
      console.log(`Processing text file: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      processedContent = await processText(
        fileContent,
        `sharepoint:${downloadedFile.fileName}`,
        {
          document_id: document.id.toString(),
          custom_fields: (document.metadata as any)?.custom_fields || {},
          sharepoint_metadata: {
            fileName: downloadedFile.fileName,
            mimeType: downloadedFile.mimeType,
            driveId,
            fileId
          }
        }
      );
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               mimeType === 'application/msword') {
      // For Word documents, extract text using a simple approach
      // In a real implementation, you'd use a specialized library or service
      console.log(`Processing Word document (basic extraction): ${filePath}`);
      // Simple placeholder for Word document processing
      // In production, you'd implement proper Word document parsing
      processedContent = await processText(
        `[Content from Word document: ${downloadedFile.fileName}]`,
        `sharepoint:${downloadedFile.fileName}`,
        {
          document_id: document.id.toString(),
          custom_fields: (document.metadata as any)?.custom_fields || {},
          sharepoint_metadata: {
            fileName: downloadedFile.fileName,
            mimeType: downloadedFile.mimeType,
            driveId,
            fileId
          }
        }
      );
    } else {
      // Unsupported file type
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    if (!processedContent) {
      throw new Error(`Failed to process file: ${downloadedFile.fileName}`);
    }

    // Get the file content as text
    let fileText = '';
    if (processedContent.text) {
      fileText = processedContent.text;
    } else if (processedContent.chunks) {
      fileText = processedContent.chunks.map((chunk: any) => chunk.text).join('\n');
    }

    // Update document with content
    await storage.updateDocument(document.id, {
      content: fileText ? fileText.replace(/\0/g, '') : '',
      metadata: {
        ...(document.metadata as any || {}),
        sharepoint: {
          fileName: downloadedFile.fileName,
          mimeType: downloadedFile.mimeType,
          driveId,
          fileId
        }
      },
      processingInfo: {
        ...(document.processingInfo as any || {}),
        step: 'generating_embeddings',
        chunks: processedContent.chunks ? processedContent.chunks.length : 0
      }
    });

    // Get the updated document
    const updatedDoc = await storage.getDocument(document.id);
    if (!updatedDoc) {
      throw new Error(`Document not found after update: ${document.id}`);
    }

    // Generate embeddings using OpenAI
    const providerId = 1; // Default to OpenAI
    const embeddingResults = await createAndStoreEmbeddings(
      userId,
      knowledgeBaseId,
      document.id.toString(),
      processedContent,
      providerId
    );

    // Update document to processed status
    await storage.updateDocument(document.id, {
      status: 'processed',
      processingInfo: {
        ...(updatedDoc.processingInfo as any || {}),
        step: 'completed',
        embeddings: embeddingResults.length,
        finished_at: new Date().toISOString()
      }
    });

    console.log(`Successfully processed SharePoint file for document ID ${document.id}: ${embeddingResults.length} embeddings created`);

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (cleanupError) {
      console.warn(`Failed to delete temporary file ${filePath}:`, cleanupError);
    }

    // Record storage usage
    try {
      const storageSize = Math.ceil((fileText?.length || 0) / 1024); // Convert to KB
      const subscriptionService = SubscriptionService.getInstance();
      await subscriptionService.recordUsage(userId, "storage_used", storageSize);
    } catch (usageError) {
      console.warn(`Failed to record storage usage for SharePoint file: ${usageError}`);
    }

  } catch (error) {
    console.error(`Error processing SharePoint file for document ID ${document.id}:`, error);

    // Update document to failed status
    await storage.updateDocument(document.id, {
      status: 'failed',
      processingInfo: {
        error: error instanceof Error ? error.message : String(error),
        finished_at: new Date().toISOString()
      }
    });
  }
}