/**
 * Embedding Service
 * 
 * This service manages the creation, storage, and retrieval of embeddings
 * using the Python LLM service and Pinecone database.
 */

import { v4 as uuidv4 } from 'uuid';
import { DocumentChunk, ProcessedDocument } from './document_processor';
import { DocumentSourceType } from '@shared/schema';
import { 
  PineconeVector, 
  RecordMetadata,
  createPineconeMetadata,
  getPineconeApiUrl, 
  createEmbedding, 
  storeEmbedding, 
  storeEmbeddings, 
  querySimilar, 
  deleteEmbeddings, 
  deleteEmbeddingsByFilter,
  deleteNamespace,
  verifyPineconeConnection
} from './pinecone-api';
import { chatCompletion, generateEmbeddings, generateAnswerFromContext } from './llm';
import { storage } from '../storage';

// Interface for storing embedding results
export interface EmbeddingResult {
  id: string;
  embedding: number[];
  metadata: RecordMetadata;
}

/**
 * Create namespace from user ID and knowledge base ID
 */
export function createNamespace(userId: number, knowledgeBaseId: number): string {
  return `user-${userId}-kb-${knowledgeBaseId}`;
}

/**
 * Create embeddings for a processed document and store them in Pinecone
 * 
 * @param userId - User ID who owns the document
 * @param knowledgeBaseId - Knowledge base ID where the document belongs
 * @param documentId - Document ID
 * @param document - Processed document with chunks
 * @param providerId - LLM provider ID to use for embeddings
 * @returns Array of embedding results
 */
export async function createAndStoreEmbeddings(
  userId: number | string,
  knowledgeBaseId: number | string,
  documentId: string,
  document: ProcessedDocument,
  providerId: string | number
): Promise<EmbeddingResult[]> {
  console.log(`Creating embeddings for document ${documentId} with ${document.chunks.length} chunks`);
  
  // For namespace and metadata, we'll use the original user ID (properly normalized)
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Get the namespace for this user and knowledge base
  const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
  
  // Results array
  const results: EmbeddingResult[] = [];
  const pineconeVectors: PineconeVector[] = [];
  
  // Log the normalized values
  console.log(`Using normalized values: userId=${userIdNum}, knowledgeBaseId=${knowledgeBaseIdNum}, namespace=${namespace}`);
  
  // Normalize providerId with robust error handling
  let providerIdNum: number = 1; // Default to OpenAI (1)
  
  // Early check to catch invalid provider IDs
  if (providerId === undefined || providerId === null || providerId === '' || 
      (typeof providerId === 'number' && isNaN(providerId))) {
    console.log(`Invalid, empty, or NaN providerId in embedding service: ${providerId}, using default ID: ${providerIdNum}`);
  } else {
    // Handle string provider IDs more carefully
    if (typeof providerId === 'string') {
      // It's a numeric string, parse it
      const parsed = parseInt(providerId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        providerIdNum = parsed;
        console.log(`Parsed string provider ID '${providerId}' to number: ${providerIdNum}`);
      } else {
        console.log(`Failed to parse string provider ID '${providerId}', using default ID: ${providerIdNum}`);
      }
    } else if (typeof providerId === 'number') {
      // Ensure it's a valid number (and not NaN)
      if (!isNaN(providerId) && providerId > 0) {
        providerIdNum = providerId;
        console.log(`Using numeric provider ID: ${providerIdNum}`);
      } else {
        console.log(`Invalid numeric provider ID: ${providerId}, using default ID: ${providerIdNum}`);
      }
    }
  }
  
  // Final safety check to ensure we have a valid provider ID
  if (isNaN(providerIdNum) || providerIdNum <= 0 || providerIdNum === Infinity) {
    console.log(`Final check: Invalid provider ID detected (${providerIdNum}), using default ID 1`);
    providerIdNum = 1; // Safe default to OpenAI
  }
  
  // Convert to integer to ensure we don't have any floating-point issues
  providerIdNum = Math.floor(providerIdNum);
  
  // Extra safety check to catch any other invalid values
  if (typeof providerIdNum !== 'number' || isNaN(providerIdNum)) {
    console.log(`Extra safety check caught invalid provider ID: ${providerIdNum}, using default ID: 1`);
    providerIdNum = 1;
  }
  
  console.log(`Normalized providerId: ${providerIdNum} for embeddings`);
  
  // Create and store embeddings for each chunk
  for (const chunk of document.chunks) {
    try {
      // Convert chunk content to embedding using the original user ID
      const embeddingVector = await generateEmbeddings(
        userIdNum,     // Use the actual user's ID
        providerIdNum, // Use normalized provider ID
        chunk.content
      );
      
      // Create a unique ID for this embedding
      const embeddingId = uuidv4();
      
      // Format date as ISO string for Pinecone compatibility
      const createdAt = new Date();
      const createdAtIso = createdAt.toISOString();
      
      // Determine source type from metadata
      const sourceType = document.metadata.source_type || 'text';
      
      // Check if there are custom fields in the document metadata
      const customFields = chunk.metadata.custom_fields || {};
      
      // Create metadata for the embedding - using normalized IDs
      const metadata = createPineconeMetadata({
        content: chunk.content,
        source: chunk.metadata.source,
        chunk_index: chunk.metadata.chunk_index,
        total_chunks: chunk.metadata.total_chunks,
        document_id: documentId,
        knowledge_base_id: knowledgeBaseIdNum.toString(),
        user_id: userIdNum.toString(),
        created_at_iso: createdAtIso,
        source_type: sourceType as DocumentSourceType,
        chunk_id: `${documentId}-chunk-${chunk.metadata.chunk_index}`, // Add a unique chunk ID
        custom_fields: customFields
      });
      
      // Prepare record for Pinecone
      const vector: PineconeVector = {
        id: embeddingId,
        values: embeddingVector,
        metadata
      };
      
      // Add to records to be upserted
      pineconeVectors.push(vector);
      
      // Add to results
      results.push({
        id: embeddingId,
        embedding: embeddingVector,
        metadata
      });
      
      console.log(`Created embedding ${embeddingId} for chunk ${chunk.metadata.chunk_index + 1}/${chunk.metadata.total_chunks}`);
    } catch (error) {
      console.error(`Error creating embedding for chunk ${chunk.metadata.chunk_index}:`, error);
      // Don't throw error, just log it and continue with other chunks
      // This way, if one chunk fails, we can still process the others
      continue;
    }
  }
  
  // Store all embeddings in Pinecone in one batch operation
  if (pineconeVectors.length > 0) {
    try {
      console.log(`Attempting to store ${pineconeVectors.length} embeddings in Pinecone namespace ${namespace}`);
      const result = await storeEmbeddings(namespace, pineconeVectors);
      console.log(`SUCCESS: Stored ${pineconeVectors.length} embeddings in Pinecone namespace ${namespace}`);
      
      // Add a small delay to give Pinecone time to index the new embeddings
      // This helps ensure they'll be available for immediate searching
      console.log(`Waiting for Pinecone to index the new embeddings (1.5 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`Indexing delay completed.`);
      
      // Verify storage by checking Pinecone index stats
      try {
        const stats = await verifyPineconeConnection();
        console.log(`Pinecone index stats after embedding storage: ${JSON.stringify(stats)}`);
      } catch (verifyError) {
        console.error('Error verifying Pinecone connection after embedding storage:', verifyError);
        // Don't throw this error, just log it
      }
    } catch (error) {
      console.error('Error storing embeddings in Pinecone:', error);
      // We'll throw this error since it affects all embeddings
      throw error;
    }
  }
  
  return results;
}

/**
 * Search for similar documents using an embedding
 * 
 * @param userId - User ID
 * @param knowledgeBaseId - Knowledge base ID
 * @param query - Query string
 * @param providerId - LLM provider ID
 * @param topK - Number of results to return
 * @param filters - Additional metadata filters
 * @returns Search results
 */
export async function searchEmbeddings(
  userId: number | string,
  knowledgeBaseId: number | string,
  query: string,
  providerId: string | number,
  topK: number = 5,
  filters: Record<string, any> = {}
): Promise<any[]> {
  console.log(`Searching for "${query}" in knowledge base ${knowledgeBaseId}`);
  
  // Handle userId conversion with robust error handling
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Get the namespace for this user and knowledge base
  const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
  console.log(`Using namespace: ${namespace}`);
  
  // Normalize providerId with robust error handling
  let providerIdNum: number = 1; // Default to OpenAI (1)
  
  // Early check to catch invalid provider IDs
  if (providerId === undefined || providerId === null || providerId === '' || 
      (typeof providerId === 'number' && isNaN(providerId))) {
    console.log(`Invalid, empty, or NaN providerId in embedding search: ${providerId}, using default ID: ${providerIdNum}`);
  } else {
    // Handle string provider IDs more carefully
    if (typeof providerId === 'string') {
      // It's a numeric string, parse it
      const parsed = parseInt(providerId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        providerIdNum = parsed;
        console.log(`Parsed string provider ID '${providerId}' to number: ${providerIdNum}`);
      } else {
        console.log(`Failed to parse string provider ID '${providerId}', using default ID: ${providerIdNum}`);
      }
    } else if (typeof providerId === 'number') {
      // Ensure it's a valid number (and not NaN)
      if (!isNaN(providerId) && providerId > 0) {
        providerIdNum = providerId;
        console.log(`Using numeric provider ID: ${providerIdNum}`);
      } else {
        console.log(`Invalid numeric provider ID: ${providerId}, using default ID: ${providerIdNum}`);
      }
    }
  }
  
  // Final safety check to ensure we have a valid provider ID
  if (isNaN(providerIdNum) || providerIdNum <= 0 || providerIdNum === Infinity) {
    console.log(`Final check: Invalid provider ID detected (${providerIdNum}), using default ID 1`);
    providerIdNum = 1; // Safe default to OpenAI
  }
  
  // Convert to integer to ensure we don't have any floating-point issues
  providerIdNum = Math.floor(providerIdNum);
  
  // Extra safety check to catch any other invalid values
  if (typeof providerIdNum !== 'number' || isNaN(providerIdNum)) {
    console.log(`Extra safety check caught invalid provider ID: ${providerIdNum}, using default ID: 1`);
    providerIdNum = 1;
  }
  
  console.log(`Normalized providerId: ${providerIdNum} for embeddings search`);
  
  try {
    // Generate embedding for the query using the user's ID
    const queryEmbedding = await generateEmbeddings(
      userIdNum,       // Use the normalized user's ID
      providerIdNum,   // Use normalized provider ID
      query
    );
    
    // Search Pinecone
    const searchResults = await querySimilar(
      namespace,
      queryEmbedding,
      topK,
      filters
    );
    
    // Format and return results
    return searchResults.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      content: match.metadata?.content || '',
      metadata: match.metadata || {}
    }));
  } catch (error) {
    console.error('Error searching embeddings:', error);
    throw error;
  }
}

/**
 * Delete embeddings for a document
 * 
 * @param userId - User ID
 * @param knowledgeBaseId - Knowledge base ID
 * @param documentId - Document ID to delete
 */
export async function deleteDocumentEmbeddings(
  userId: number | string,
  knowledgeBaseId: number | string,
  documentId: string
): Promise<void> {
  console.log(`Deleting embeddings for document ${documentId}`);
  
  // Handle userId conversion with robust error handling
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Get the namespace for this user and knowledge base
  const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
  
  try {
    // We use a filter to delete by document_id - with the direct API approach
    // we can delete by filter instead of querying and then deleting by IDs
    await deleteEmbeddingsByFilter(namespace, {
      metadata: {
        document_id: documentId
      }
    });
    
    console.log(`Deleted embeddings for document ${documentId}`);
  } catch (error) {
    console.error(`Error deleting embeddings for document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Delete all embeddings for a knowledge base
 * 
 * @param userId - User ID
 * @param knowledgeBaseId - Knowledge base ID to delete
 */
export async function deleteKnowledgeBaseEmbeddings(
  userId: number | string, 
  knowledgeBaseId: number | string
): Promise<void> {
  console.log(`Deleting all embeddings for knowledge base ${knowledgeBaseId}`);
  
  // Handle userId conversion with robust error handling
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Get the namespace for this user and knowledge base
  const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
  
  try {
    // Delete all vectors in the namespace
    await deleteNamespace(namespace);
    console.log(`Deleted all embeddings for knowledge base ${knowledgeBaseId}`);
  } catch (error) {
    console.error(`Error deleting embeddings for knowledge base ${knowledgeBaseId}:`, error);
    throw error;
  }
}

/**
 * Get statistics for a knowledge base's embeddings
 * 
 * @param userId - User ID
 * @param knowledgeBaseId - Knowledge base ID
 */
export async function getKnowledgeBaseEmbeddingStats(
  userId: number | string,
  knowledgeBaseId: number | string
): Promise<any> {
  // Handle userId conversion with robust error handling
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Get the namespace for this user and knowledge base
  const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
  
  try {
    // Get stats for the index
    const stats = await verifyPineconeConnection();
    
    // Extract namespace stats
    const namespaceStats = stats.namespaces?.[namespace] || { vectorCount: 0 };
    
    // Return stats without duplicate vectorCount
    return {
      namespace,
      ...namespaceStats
    };
  } catch (error) {
    console.error(`Error getting stats for knowledge base ${knowledgeBaseId}:`, error);
    throw error;
  }
}

/**
 * Query the knowledge base with a natural language query and generate a response
 * 
 * @param userId - User ID
 * @param knowledgeBaseId - Knowledge base ID
 * @param query - User query
 * @param providerId - LLM provider ID for embeddings and chat
 * @returns Generated response and references
 */
export async function queryKnowledgeBase(
  userId: number | string,
  knowledgeBaseId: number | string,
  query: string,
  providerId: string | number,
  agentId?: number // Added optional agentId parameter
): Promise<any> {
  console.log(`Querying knowledge base ${knowledgeBaseId} with "${query}"`);
  
  // Handle userId conversion with robust error handling
  let userIdNum: number;
  let knowledgeBaseIdNum: number;
  
  // Handle userId conversion with robust error handling
  if (typeof userId === 'string') {
    userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId string: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else if (typeof userId === 'number') {
    userIdNum = userId;
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn(`Invalid userId number: ${userId}, using default value 1`);
      userIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid userId: ${userId}, using default value 1`);
    userIdNum = 1; // Safe default for unexpected types
  }
  
  // Handle knowledgeBaseId conversion with robust error handling
  if (typeof knowledgeBaseId === 'string') {
    knowledgeBaseIdNum = parseInt(knowledgeBaseId);
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId string: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else if (typeof knowledgeBaseId === 'number') {
    knowledgeBaseIdNum = knowledgeBaseId;
    if (isNaN(knowledgeBaseIdNum) || knowledgeBaseIdNum <= 0) {
      console.warn(`Invalid knowledgeBaseId number: ${knowledgeBaseId}, using default value 1`);
      knowledgeBaseIdNum = 1; // Safe default
    }
  } else {
    console.warn(`Completely invalid knowledgeBaseId: ${knowledgeBaseId}, using default value 1`);
    knowledgeBaseIdNum = 1; // Safe default for unexpected types
  }
  
  // Let searchEmbeddings and other functions handle providerId normalization
  // This approach avoids duplication of the normalization logic and prevents NaN issues
  console.log(`Passing providerId ${providerId} to searchEmbeddings for proper resolution`);
  
  try {
    // Get the namespace for this knowledge base
    const namespace = createNamespace(userIdNum, knowledgeBaseIdNum);
    console.log(`Querying namespace: ${namespace} for knowledge base ${knowledgeBaseIdNum}`);
    
    // Try up to 2 times to get results - this helps when new content has just been added
    // and might not be immediately available in Pinecone's index
    let searchResults = [];
    let attempts = 0;
    const maxAttempts = 2;
    
    while (searchResults.length === 0 && attempts < maxAttempts) {
      attempts++;
      console.log(`Search attempt ${attempts}/${maxAttempts} for query "${query}"`);
      
      searchResults = await searchEmbeddings(
        userIdNum,
        knowledgeBaseIdNum,
        query,
        providerId,
        5 // Top 5 most relevant chunks
      );
      
      // If no results and we have more attempts, wait a bit and try again
      if (searchResults.length === 0 && attempts < maxAttempts) {
        console.log(`No results found on attempt ${attempts}, waiting 1 second before retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (searchResults.length === 0) {
      // Instead of returning a stock "no information" message,
      // we'll set a flag to indicate no knowledge was found
      // This will allow the calling code to handle this situation
      return {
        noKnowledgeFound: true,
        answer: "", // Don't set an answer, let the calling code handle it
        references: []
      };
    }
    
    console.log(`Found ${searchResults.length} relevant chunks in knowledge base ${knowledgeBaseIdNum}`);
    // Log the first result for debugging
    if (searchResults.length > 0) {
      console.log(`Top result score: ${searchResults[0].score}, content preview: ${searchResults[0].content.substring(0, 100)}...`);
    }
    
    // Extract content and prepare context
    const context = searchResults.map(result => result.content).join('\n\n');
    
    // Format references with proper source attribution
    const references = searchResults.map(result => {
      // Get the document title from metadata, fallback to document_id if title not available
      const documentTitle = result.metadata.title || 
                           result.metadata.document_title || 
                           result.metadata.source || 
                           `Document ${result.metadata.document_id}` ||
                           'Unknown Document';
      
      return {
        id: result.id,
        score: result.score,
        content: result.content.substring(0, 150) + (result.content.length > 150 ? '...' : ''),
        source: documentTitle,
        metadata: {
          document_id: result.metadata.document_id,
          chunk_index: result.metadata.chunk_index,
          title: documentTitle
        }
      };
    });
    
    // Check if the query appears to be a follow-up
    const isFollowUp = query.includes('Original question:') && query.includes('Follow-up request:');
    
    // Check if the query includes a conversation summary format
    const hasConversationSummary = isFollowUp && query.includes('Recent conversation summary:');
    
    // Create a prompt for the LLM - either using the agent's custom template or the default
  /*  let promptTemplate = `You are a knowledgeable AI assistant that provides helpful, accurate information.

RULES:
1. If information is available in the provided context, use it to provide a precise, fact-based response.
2. If the specific answer cannot be found in the context, use your general knowledge to provide a helpful response.
3. Format your answer clearly and concisely.
4. When making direct quotations from the context, wrap them in quotation marks.
5. If asked about yourself or how you obtained this information, explain that you're an AI assistant using both knowledge base content and general knowledge.
6. For follow-up questions that ask you to modify or add to your previous answer, provide the best response based on available information.
7. Recognize editing requests like "add X to it", "include more about Y", or "update the previous response" as modifications to your last answer.
8. Always be helpful, accurate, and conversational in your responses.`;*/
    
    let promptTemplate = `You are a AI Assistant.`;

    // Add specific instructions for follow-up questions if detected
    if (isFollowUp) {
      console.log("Follow-up question detected in embedding service, adding specialized instructions");
      if (hasConversationSummary) {
        promptTemplate += `

FOLLOW-UP HANDLING WITH CONVERSATION SUMMARY:
- This is a follow-up question. The query contains the original question, a summary of recent conversation, and a new follow-up request.
- The conversation summary provides context from previous interactions.
- Focus on answering the follow-up request in the context of the conversation summary and the original question.
- If the follow-up asks you to modify or build upon previous information, use the conversation summary as context.
- If the follow-up asks for more details on a specific part of the conversation, elaborate on that part.
- Only reference information available in the provided context.`;
      } else {
        promptTemplate += `

FOLLOW-UP HANDLING:
- This is a follow-up question. The query contains the original question, your previous answer, and a new follow-up request.
- Focus on answering the follow-up request in the context of your previous answer and the original question.
- If the follow-up asks you to modify your previous answer, use your previous answer as a starting point and make the requested modifications.
- If the follow-up asks for more details on a specific part of your previous answer, elaborate on that part.
- Only reference information available in the provided context.`;
      }
    }

    // If agentId is provided, try to get the agent's custom prompt template
    if (agentId) {
      try {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          // Store agent configuration for later confidence check
          const agentConfidenceThreshold = agent.confidenceThreshold 
            ? parseFloat(agent.confidenceThreshold) 
            : 0.7; // Default threshold if not set
          
          const agentFallbackMessage = agent.fallbackMessage || 
            "I'm not confident enough to answer that based on the available knowledge. Could you please rephrase your question or provide more details?";
          
          // Set agent prompt template if available
          if (agent.promptTemplate) {
            let agentPrompt = agent.promptTemplate;
            
            // Keep our follow-up instructions if this is a follow-up query, even when using agent's custom prompt
            if (isFollowUp) {
              if (hasConversationSummary) {
                agentPrompt += `

FOLLOW-UP HANDLING WITH CONVERSATION SUMMARY:
- This is a follow-up question. The query contains the original question, a summary of recent conversation, and a new follow-up request.
- The conversation summary provides context from previous interactions.
- Focus on answering the follow-up request in the context of the conversation summary and the original question.
- If the follow-up asks you to modify or build upon previous information, use the conversation summary as context.
- If the follow-up asks for more details on a specific part of the conversation, elaborate on that part.
- Only reference information available in the provided context.`;
              } else {
                agentPrompt += `

FOLLOW-UP HANDLING:
- This is a follow-up question. The query contains the original question, your previous answer, and a new follow-up request.
- Focus on answering the follow-up request in the context of your previous answer and the original question.
- If the follow-up asks you to modify your previous answer, use your previous answer as a starting point and make the requested modifications.
- If the follow-up asks for more details on a specific part of your previous answer, elaborate on that part.
- Only reference information available in the provided context.`;
              }
            }
            
            promptTemplate = agentPrompt;
            console.log(`Using custom prompt template for agent ${agentId} in embedding service: ${promptTemplate.substring(0, 50)}...`);
          }
          
          // Add agent-specific rules to the prompt if available
          if (agent.rules && Array.isArray(agent.rules) && agent.rules.length > 0) {
            // Filter out empty rules
            const validRules = agent.rules.filter(rule => rule && rule.trim().length > 0);
            
            if (validRules.length > 0) {
              // Add a rules section to the prompt
              promptTemplate += `

ADDITIONAL AGENT RULES:
${validRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`;
              
              console.log(`Added ${validRules.length} agent-specific rules to the prompt`);
            }
          }
        }
      } catch (err) {
        console.error(`Error getting agent data: ${err}`);
        // Continue with default prompt template on error
      }
    }

    const messages = [
      {
        role: 'system',
        content: `${promptTemplate}

CONTEXT:
${context}`
      },
      {
        role: 'user',
        content: query
      }
    ];
    console.log("messaages", messages);
    // Use the specialized RAG implementation instead of generic chat completion
    // This ensures a more structured response that strictly follows the knowledge base data
    
    try {
      const response = await generateAnswerFromContext(
        userIdNum, // Use the normalized user's ID
        providerId,
        context,
        query,
        undefined, // model (use default)
        0.2, // temperature
        4096, // maxTokens - Increased from 1024 to allow longer responses
        agentId, // Pass agent ID for unanswered questions detection
        knowledgeBaseIdNum // Pass knowledge base ID for context
      );
      
      console.log(`Answer generated successfully, length: ${response.answer?.length || 0} characters`);
      
      // Return the response without confidence scoring for knowledge-based queries
      return {
        answer: response.answer,
        model: response.model,
        references
      };
    } catch (error) {
      console.error('Error using generateAnswerFromContext, falling back to chatCompletion:', error);
      
      // Fallback to the existing chat completion if the new function fails
      const response = await chatCompletion(
        userIdNum, // Use the normalized user's ID
        providerId, 
        messages
      );
      
      return {
        answer: response.content,
        references
      };
    }
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    throw error;
  }
}

// The deleteEmbeddingsByFilter function is now imported at the top of the file from pinecone-api