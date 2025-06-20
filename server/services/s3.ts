import fs from 'fs';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Set AWS credentials from environment variables
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET;

// Cache the S3 client instance for reuse
let s3Client: S3Client | null = null;

/**
 * Get or create an S3 client for interacting with AWS S3
 * @returns S3Client instance
 */
export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: REGION,
      // Credentials are automatically loaded from environment variables:
      // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    });
  }
  return s3Client;
};

/**
 * Check if S3 is properly configured
 * @returns Promise resolving to a boolean indicating if S3 is configured
 */
export const isS3Configured = async (): Promise<boolean> => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !BUCKET) {
    console.log('S3 is not configured: missing required environment variables');
    return false;
  }
  
  try {
    const client = getS3Client();
    // Just create the client to verify credentials are valid
    return true;
  } catch (error) {
    console.error('S3 configuration error:', error);
    return false;
  }
};

/**
 * Upload a file to S3
 * @param localFilePath Path to the local file
 * @param s3Key Key (path) where the file will be stored in S3
 * @param contentType MIME type of the file
 * @returns Promise resolving to the S3 URL
 */
export const uploadToS3 = async (
  localFilePath: string,
  s3Key: string,
  contentType: string
): Promise<string> => {
  if (!BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set');
  }
  
  const fileContent = fs.readFileSync(localFilePath);
  const client = getS3Client();
  
  const params = {
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType
  };
  
  await client.send(new PutObjectCommand(params));
  
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
};

/**
 * Download a file from S3 to a local path
 * @param s3Key Key (path) of the file in S3
 * @param localFilePath Path where the file will be saved locally
 * @returns Promise that resolves when the download is complete
 */
export const downloadFromS3 = async (
  s3Key: string,
  localFilePath: string
): Promise<void> => {
  if (!BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  
  const params = {
    Bucket: BUCKET,
    Key: s3Key
  };
  
  try {
    const command = new GetObjectCommand(params);
    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error('Response body is empty');
    }
    
    // Create a write stream for the file
    const fileStream = fs.createWriteStream(localFilePath);
    
    // Convert the readable stream to a Node.js stream
    if (response.Body instanceof ReadableStream) {
      // Handle browser ReadableStream
      const reader = response.Body.getReader();
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Write chunk to file
        fileStream.write(Buffer.from(value));
      }
      
      fileStream.end();
    } else {
      // Handle Node.js Readable stream
      const stream = response.Body as unknown as NodeJS.ReadableStream;
      
      // Create a promise that resolves when the stream is done
      await new Promise<void>((resolve, reject) => {
        stream.pipe(fileStream)
          .on('finish', () => resolve())
          .on('error', (err) => reject(err));
      });
    }
  } catch (error) {
    console.error('Error downloading from S3:', error);
    throw error;
  }
};

/**
 * Generate a presigned URL for downloading a file from S3
 * @param s3Key Key (path) of the file in S3
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Promise resolving to the presigned URL
 */
export const getPresignedUrl = async (
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> => {
  if (!BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  
  const params = {
    Bucket: BUCKET,
    Key: s3Key
  };
  
  const command = new GetObjectCommand(params);
  return await getSignedUrl(client, command, { expiresIn });
};

/**
 * Delete a file from S3
 * @param s3Key Key (path) of the file in S3
 * @returns Promise that resolves when the delete operation is complete
 */
export const deleteFromS3 = async (s3Key: string): Promise<void> => {
  if (!BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  
  const params = {
    Bucket: BUCKET,
    Key: s3Key
  };
  
  await client.send(new DeleteObjectCommand(params));
};