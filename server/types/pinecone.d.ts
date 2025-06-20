// Type extensions for Pinecone

import '@pinecone-database/pinecone';

declare module '@pinecone-database/pinecone' {
  interface RecordMetadata {
    [key: string]: string | number | boolean | string[] | Date | undefined;
  }
}