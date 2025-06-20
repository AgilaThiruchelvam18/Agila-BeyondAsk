import fs from 'fs';
import path from 'path';
import { 
  getS3Client, 
  uploadToS3, 
  downloadFromS3, 
  deleteFromS3,
  isS3Configured
} from './s3';
import { storage } from '../storage';
import pdfParse from 'pdf-parse';

/**
 * Generates an S3 key for a document file
 * @param userId User ID
 * @param filename Original filename
 * @returns S3 key string
 */
export const generateS3Key = (userId: number, filename: string): string => {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
  return `documents/${userId}/${timestamp}-${sanitizedFilename}`;
};

/**
 * Saves an uploaded file to S3 if configured, otherwise to local storage
 * @param file Multer file object
 * @param userId User ID
 * @returns Object with file info
 */
export const saveUploadedFile = async (
  file: Express.Multer.File,
  userId: number
): Promise<{
  filePath: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  isS3: boolean;
}> => {
  // Check if S3 is configured
  const s3Available = await isS3Configured();
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (s3Available) {
    try {
      console.log(`Uploading file ${file.originalname} to S3...`);
      
      // Generate S3 key based on user ID and original filename
      const s3Key = generateS3Key(userId, file.originalname);
      
      // Upload to S3
      await uploadToS3(file.path, s3Key, file.mimetype);
      
      // Delete local file after successful S3 upload
      fs.unlinkSync(file.path);
      
      console.log(`File ${file.originalname} uploaded to S3 with key ${s3Key}`);
      
      return {
        filePath: s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
        extension: fileExtension,
        isS3: true
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      // Fall back to local storage if S3 upload fails
      console.log('Falling back to local storage');
    }
  }
  
  // Use local storage if S3 is not configured or upload failed
  return {
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype,
    extension: fileExtension,
    isS3: false
  };
};

/**
 * Process a document stored in S3
 * @param filePath S3 key or local path
 * @param isS3 Whether the file is stored in S3
 * @param title Document title
 * @param metadata Processing metadata
 * @returns Processed document with chunks
 */
export const processDocument = async (
  filePath: string,
  isS3: boolean,
  title: string,
  metadata: any
): Promise<{
  chunks: { content: string; metadata: any }[];
  metadata: any;
}> => {
  let fileBuffer: Buffer;
  let tempPath: string | null = null;
  
  try {
    if (isS3) {
      // Create temp directory if it doesn't exist
      const tempDir = './temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create a temporary file to download S3 content
      const tempFilename = `${Date.now()}-${path.basename(filePath)}`;
      tempPath = path.join(tempDir, tempFilename);
      
      // Download the file from S3
      await downloadFromS3(filePath, tempPath);
      fileBuffer = fs.readFileSync(tempPath);
    } else {
      // Read file directly from local storage
      fileBuffer = fs.readFileSync(filePath);
    }
    
    // Determine file type based on extension
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (fileExt === '.pdf') {
      // Process PDF
      const pdfData = await pdfParse(fileBuffer);
      
      // Basic chunking (in a production app, you'd want more sophisticated chunking)
      const chunkSize = 1000; // characters
      const chunks = [];
      let text = pdfData.text;
      
      // Split text into chunks
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push({
          content: chunk,
          metadata: {
            ...metadata,
            chunk_index: Math.floor(i / chunkSize),
            source: `${title} (PDF)`,
            page: 'unknown' // In a real implementation, track page numbers
          }
        });
      }
      
      return {
        chunks,
        metadata: {
          ...metadata,
          pdf_info: {
            total_pages: pdfData.numpages,
            total_chars: pdfData.text.length
          }
        }
      };
    } else if (['.docx', '.doc', '.txt', '.rtf', '.odt'].includes(fileExt)) {
      // For text-based documents, use simple text processing
      // In a production app, use specific libraries for each file type
      let documentText = '';
      
      if (fileExt === '.txt') {
        documentText = fileBuffer.toString('utf8');
      } else {
        // Basic placeholder for other document types
        // In production, you'd use libraries like mammoth (DOCX) or others
        documentText = `Content from ${title}. This is a basic extraction.`;
      }
      
      // Basic chunking
      const chunkSize = 1000; // characters
      const chunks = [];
      
      for (let i = 0; i < documentText.length; i += chunkSize) {
        const chunk = documentText.slice(i, i + chunkSize);
        chunks.push({
          content: chunk,
          metadata: {
            ...metadata,
            chunk_index: Math.floor(i / chunkSize),
            source: `${title} (${fileExt.substring(1).toUpperCase()})`
          }
        });
      }
      
      return {
        chunks,
        metadata
      };
    } else {
      throw new Error(`Unsupported file extension: ${fileExt}`);
    }
  } finally {
    // Clean up temporary file if it was created
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
};

/**
 * Delete a document from S3 or local storage
 * @param filePath Path to the file
 * @param isS3 Whether the file is in S3
 */
export const deleteDocument = async (filePath: string, isS3: boolean): Promise<void> => {
  if (isS3) {
    await deleteFromS3(filePath);
  } else if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};