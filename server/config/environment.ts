/**
 * Environment Configuration
 * Centralized environment variable management
 */

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  PINECONE_API_KEY: string;
  PINECONE_ENVIRONMENT: string;
  PINECONE_INDEX: string;
  OPENAI_API_KEY: string;
  SENDGRID_API_KEY: string;
  SENDGRID_FROM_EMAIL: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || '',
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || '',
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || '',
    PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || '',
    PINECONE_INDEX: process.env.PINECONE_INDEX || 'knowledge-assistant',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || '',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  };
};

export const env = getEnvironmentConfig();