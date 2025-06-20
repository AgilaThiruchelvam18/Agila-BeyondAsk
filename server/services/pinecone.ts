import { DocumentSourceType } from "@shared/schema";
import { Pinecone, PineconeRecord, RecordMetadata } from '@pinecone-database/pinecone';


/**
 * Helper function to create properly formatted metadata object for Pinecone
 * that conforms to RecordMetadata constraints (string|number|boolean|string[])
 */
export function createPineconeMetadata(data: {
  user_id?: string | number;
  knowledge_base_id?: string | number;
  document_id?: string | number;
  chunk_id?: string;
  content?: string;
  chunk_index?: number;
  total_chunks?: number;
  source?: string;
  source_type?: DocumentSourceType | string;
  created_at_iso?: string;
  [key: string]: any;
}): RecordMetadata {
  const metadata: RecordMetadata = {};

  // Convert each field to the appropriate type and format
  // Only using types allowed by RecordMetadata: string | boolean | number | string[]
  if (data.user_id !== undefined) metadata.user_id = String(data.user_id);
  if (data.knowledge_base_id !== undefined) metadata.knowledge_base_id = String(data.knowledge_base_id);
  if (data.document_id !== undefined) metadata.document_id = String(data.document_id);
  if (data.chunk_id !== undefined) metadata.chunk_id = String(data.chunk_id);
  if (data.content !== undefined) metadata.content = String(data.content);
  if (data.chunk_index !== undefined) metadata.chunk_index = Number(data.chunk_index);
  if (data.total_chunks !== undefined) metadata.total_chunks = Number(data.total_chunks);
  if (data.source !== undefined) metadata.source = String(data.source);
  if (data.source_type !== undefined) metadata.source_type = String(data.source_type);
  if (data.created_at_iso !== undefined) metadata.created_at_iso = String(data.created_at_iso);

  return metadata;
}

// Mock data for development
const mockVectors = new Map<string, PineconeRecord>();
const mockNamespaces = new Map<string, Map<string, PineconeRecord>>();
let pineconeClient: Pinecone | null = null;
let pineconeIndex: any = null;
const DEFAULT_INDEX_NAME = process.env.PINECONE_INDEX || 'knowledge-assistant';

export async function initPineconeClient_old(): Promise<void> {
  try {
    const apiKey = process.env.PINECONE_API_KEY;
    const environment = process.env.PINECONE_ENVIRONMENT;
    const DIMENSION = 1536; // Set dimension to 1536 for OpenAI embeddings

    if (!apiKey || !environment) {
      console.warn("Pinecone API key or environment not provided. Using mock implementation.");
      pineconeClient = null;
      pineconeIndex = createMockPineconeIndex();
      return;
    }

    // Connect to real Pinecone
    pineconeClient = new Pinecone({
      apiKey: apiKey
    });

    // List available indexes
    try {
      const indexes = await pineconeClient.listIndexes();
      console.log("Available Pinecone indexes:", indexes);
      let configuredIndexName = DEFAULT_INDEX_NAME;
      let indexFound = false;

      // Check if the exact index exists first
      if (indexes.indexes?.some(idx => idx.name === configuredIndexName)) {
        // Verify the dimension of the existing index
        try {
          const indexDetails = await pineconeClient.describeIndex(configuredIndexName);
          if (indexDetails.dimension === DIMENSION) {
            pineconeIndex = pineconeClient.index(configuredIndexName);
            console.log(`Connected to Pinecone index: ${configuredIndexName} with correct dimension ${DIMENSION}`);
            indexFound = true;
          } else {
            console.warn(`Index ${configuredIndexName} exists but has dimension ${indexDetails.dimension} instead of ${DIMENSION}`);
            // We'll try other indexes or create a new one with the correct dimension
          }
        } catch (error) {
          console.error(`Error checking dimension of index ${configuredIndexName}:`, error);
        }
      }

      // If correct index not found, check for similar named indexes
      if (!indexFound) {
        const matchingIndex = indexes.indexes?.find(idx => 
          idx.name.startsWith(configuredIndexName) || 
          (configuredIndexName.includes('-') && 
           idx.name === configuredIndexName.substring(0, configuredIndexName.lastIndexOf('-')))
        );

        if (matchingIndex) {
          // Verify dimension of the matching index
          try {
            const indexDetails = await pineconeClient.describeIndex(matchingIndex.name);
            if (indexDetails.dimension === DIMENSION) {
              pineconeIndex = pineconeClient.index(matchingIndex.name);
              console.log(`Connected to Pinecone index with similar name: ${matchingIndex.name} with correct dimension ${DIMENSION}`);
              indexFound = true;
            } else {
              console.warn(`Index ${matchingIndex.name} exists but has dimension ${indexDetails.dimension} instead of ${DIMENSION}`);
            }
          } catch (error) {
            console.error(`Error checking dimension of index ${matchingIndex.name}:`, error);
          }
        }
      }

      // If no index found with correct dimension, try to create a new one
      if (!indexFound) {
        console.log(`Creating new Pinecone index '${configuredIndexName}' with dimension ${DIMENSION}...`);
        try {
          await pineconeClient.createIndex({
            name: configuredIndexName,
            dimension: DIMENSION,
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          });

          // Wait for the index to initialize
          console.log(`Waiting for index to initialize...`);
          let isReady = false;
          let attempts = 0;
          const maxAttempts = 12; // Maximum 1 minute wait (12 * 5 seconds)

          while (!isReady && attempts < maxAttempts) {
            try {
              const description = await pineconeClient.describeIndex(configuredIndexName);
              if (description.status?.ready) {
                isReady = true;
                console.log(`Index '${configuredIndexName}' is now ready!`);
                pineconeIndex = pineconeClient.index(configuredIndexName);
                indexFound = true;
              } else {
                console.log(`Index status: ${description.status?.state || 'initializing'}...`);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            } catch (error) {
              console.log(`Still waiting for index to be ready...`);
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }

          if (!isReady) {
            console.warn(`Index creation timeout. Using mock implementation.`);
            pineconeIndex = createMockPineconeIndex();
          }
        } catch (error) {
          console.error(`Error creating Pinecone index:`, error);

          // If we failed to create an index, try to use any available index
          if (indexes.indexes && indexes.indexes.length > 0) {
            const firstIndex = indexes.indexes[0];
            console.warn(`Using available index: ${firstIndex.name} but dimensions may not match`);
            pineconeIndex = pineconeClient.index(firstIndex.name);
          } else {
            console.warn(`No Pinecone indexes available. Using mock implementation.`);
            pineconeIndex = createMockPineconeIndex();
          }
        }
      }
    } catch (error) {
      console.error("Error listing Pinecone indexes:", error);
      pineconeIndex = createMockPineconeIndex();
    }
  } catch (error) {
    console.error("Failed to connect to Pinecone:", error);
    // Fall back to mock implementation
    pineconeClient = null;
    pineconeIndex = createMockPineconeIndex();
  }
}

/**
 * Initialize Pinecone client
 * @returns {Promise<void>}
 */
export async function initPineconeClient(): Promise<void> {
  try {
    const apiKey = process.env.PINECONE_API_KEY;
    const environment = process.env.PINECONE_ENVIRONMENT;

    if (!apiKey || !environment) {
      console.warn("Pinecone API key or environment not provided. Using mock implementation.");
      pineconeClient = null;
      pineconeIndex = createMockPineconeIndex();
      return;
    }

    // Connect to real Pinecone
    pineconeClient = new Pinecone({
      apiKey: apiKey
    });

    // List available indexes
    try {
      const indexes = await pineconeClient.listIndexes();
      console.log("Available Pinecone indexes:", indexes);

      // The index name in the environment might have a suffix in the host but not in the name
      // Extract the base name without any suffix if it exists
      let configuredIndexName = DEFAULT_INDEX_NAME;

      // Check if the exact index exists first
      if (indexes.indexes?.some(idx => idx.name === configuredIndexName)) {
        pineconeIndex = pineconeClient.index(configuredIndexName);
        console.log(`Connected to Pinecone index: ${configuredIndexName}`);
      } 
      // If not, try to find an index that starts with our configured name (without suffix)
      else if (indexes.indexes?.some(idx => {
        // Check if any of the available indexes starts with our configured name
        // This handles cases where the index has been created with a suffix
        return idx.name.startsWith(configuredIndexName) || 
               (configuredIndexName.includes('-') && 
               idx.name === configuredIndexName.substring(0, configuredIndexName.lastIndexOf('-')));
      })) {
        // Find the matching index
        const matchingIndex = indexes.indexes.find(idx => 
          idx.name.startsWith(configuredIndexName) || 
          (configuredIndexName.includes('-') && 
           idx.name === configuredIndexName.substring(0, configuredIndexName.lastIndexOf('-')))
        );

        if (matchingIndex) {
          pineconeIndex = pineconeClient.index(matchingIndex.name);
          console.log(`Connected to Pinecone index with similar name: ${matchingIndex.name}`);
        }
      } 
      // Fallback to use the first available index if we can't find our configured one
      else if (indexes.indexes && indexes.indexes.length > 0) {
        const firstIndex = indexes.indexes[0];
        pineconeIndex = pineconeClient.index(firstIndex.name);
        console.log(`Could not find index ${configuredIndexName}, using available index: ${firstIndex.name}`);
      }
      // No indexes available, create mock
      else {
        console.warn(`No Pinecone indexes found. Creating mock index.`);
        pineconeIndex = createMockPineconeIndex();
      }
    } catch (error) {
      console.error("Error listing Pinecone indexes:", error);
      pineconeIndex = createMockPineconeIndex();
    }
  } catch (error) {
    console.error("Failed to connect to Pinecone:", error);
    // Fall back to mock implementation
    pineconeClient = null;
    pineconeIndex = createMockPineconeIndex();
  }
}

/**
 * Get Pinecone index instance
 * @returns {any} The Pinecone index
 */
export function getPineconeClient(): any {
  if (!pineconeIndex) {
    throw new Error("Pinecone client has not been initialized. Call initPineconeClient first.");
  }
  return pineconeIndex;
}

/**
 * Create a mock Pinecone index for development
 * @returns {any} A mock Pinecone index
 */
function createMockPineconeIndex(): any {
  return {
    upsert: async ({ vectors, namespace = '_default' }: { 
      vectors: PineconeRecord[] | any[], 
      namespace?: string 
    }) => {
      // Ensure vectors is an array
      if (!Array.isArray(vectors)) {
        console.error('Error in mock upsert: vectors is not an array:', typeof vectors);
        throw new TypeError('vectors is not iterable');
      }

      // Create namespace if it doesn't exist
      if (!mockNamespaces.has(namespace)) {
        mockNamespaces.set(namespace, new Map());
      }

      const namespaceVectors = mockNamespaces.get(namespace)!;

      // Process and store vectors in the namespace, with validation
      for (const vector of vectors) {
        // Validate vector has required properties
        if (!vector.id || !vector.values) {
          console.error('Invalid vector in mock upsert:', vector);
          throw new Error(`Invalid vector: missing required fields (id: ${!!vector.id}, values: ${!!vector.values})`);
        }

        // Ensure metadata is an object, not an array
        if (vector.metadata && Array.isArray(vector.metadata)) {
          console.warn('Mock upsert: metadata is an array, converting to object');
          // Convert metadata array to object
          const metadataObj: Record<string, any> = {};
          for (const key of vector.metadata) {
            metadataObj[key] = ""; // Default empty string value
          }
          vector.metadata = metadataObj;
        }

        // Store the vector
        namespaceVectors.set(vector.id, vector);
        mockVectors.set(vector.id, vector); // Also store in global map for backwards compatibility
      }

      return { upsertedCount: vectors.length };
    },

    query: async ({ 
      vector, 
      namespace = '_default', 
      topK = 10,
      filter = undefined,
      includeMetadata = true
    }: { 
      vector: number[], 
      namespace?: string, 
      topK?: number,
      filter?: any,
      includeMetadata?: boolean
    }) => {
      // Get vectors for the namespace
      const namespaceVectors = mockNamespaces.get(namespace) || new Map();

      // Convert to array
      let vectors = Array.from(namespaceVectors.values());

      // Apply filter if provided
      if (filter && filter.metadata) {
        vectors = vectors.filter(vec => {
          // Check each filter condition
          return Object.entries(filter.metadata).every(([key, value]) => {
            return vec.metadata && vec.metadata[key] === value;
          });
        });
      }

      // Sort and limit (mock similarity by returning most recently added)
      const matches = vectors
        .slice(-topK)
        .reverse()
        .map(vec => ({
          id: vec.id,
          score: 0.9 - Math.random() * 0.2, // Random score between 0.7 and 0.9
          metadata: includeMetadata ? vec.metadata : undefined
        }));

      return { matches };
    },

    delete: async ({ 
      ids = undefined, 
      deleteAll = false,
      namespace = '_default',
      filter = undefined
    }: { 
      ids?: string[], 
      deleteAll?: boolean,
      namespace?: string,
      filter?: any
    }) => {
      // Get vectors for the namespace
      const namespaceVectors = mockNamespaces.get(namespace) || new Map();

      let deletedCount = 0;

      if (deleteAll) {
        // Delete all vectors in the namespace
        deletedCount = namespaceVectors.size;
        namespaceVectors.clear();
      } else if (ids && ids.length > 0) {
        // Delete specific vectors by ID
        ids.forEach(id => {
          if (namespaceVectors.has(id)) {
            namespaceVectors.delete(id);
            mockVectors.delete(id); // Also remove from global map
            deletedCount++;
          }
        });
      } else if (filter && filter.metadata) {
        // Delete vectors matching filter
        namespaceVectors.forEach((vec, id) => {
          // Check each filter condition
          const matches = Object.entries(filter.metadata).every(([key, value]) => {
            return vec.metadata && vec.metadata[key] === value;
          });

          if (matches) {
            namespaceVectors.delete(id);
            mockVectors.delete(id); // Also remove from global map
            deletedCount++;
          }
        });
      }

      return { deletedCount };
    },

    describeIndexStats: async () => {
      // Calculate stats for each namespace
      const namespaces: Record<string, { vectorCount: number }> = {};

      mockNamespaces.forEach((vectors, namespace) => {
        namespaces[namespace] = {
          vectorCount: vectors.size
        };
      });

      return {
        namespaces,
        dimension: 1536, // OpenAI's default dimension
        indexFullness: 0.01,
        totalVectorCount: mockVectors.size
      };
    }
  };
}

/**
 * Create vector embeddings from text
 * This is a placeholder for a real embedding function that would use a model like OpenAI
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} The vector embedding
 */
export async function createEmbedding(text: string): Promise<number[]> {
  // Mock implementation - in a real app, you would call a model API
  // This creates a random vector of dimension 1536 (OpenAI embedding size)
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

/**
 * Store embedding in Pinecone
 * @param {string} namespace - Pinecone namespace
 * @param {PineconeRecord} embedding - The embedding to store
 * @returns {Promise<void>}
 */
export async function storeEmbedding(
  namespace: string, 
  embedding: PineconeRecord
): Promise<void> {
  const index = getPineconeClient();
  await index.upsert({
    vectors: [embedding],
    namespace
  });
}

/**
 * Store multiple embeddings in Pinecone
 * @param {string} namespace - Pinecone namespace
 * @param {PineconeRecord[]} embeddings - The embeddings to store
 * @returns {Promise<{ success: boolean, upsertedCount: number }>} Success indicator and count
 */

export async function storeEmbeddings(
  namespace: string, 
  embeddings: {vectors: PineconeRecord[], namespace: string}
): Promise<{ success: boolean, upsertedCount: number }> {
  const index = getPineconeClient();
  console.log("index", index);
  console.log("embeddings",embeddings);
  // Check if embeddings.vectors is defined and is an array
  if (!embeddings || !Array.isArray(embeddings)) {
    console.error('Error: embeddings.vectors is not an array or is undefined.');
    return { success: false, upsertedCount: 0 };
  }

  console.log(`Starting to store ${embeddings.length} vectors in namespace '${namespace}'`);

  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    console.warn('Warning: No embeddings to store');
    return { success: true, upsertedCount: 0 };
  }

  // Ensure vectors are properly formatted for Pinecone v5.1.1
  const vectors = embeddings.map(vector => ({
    id: String(vector.id),
    values: Array.from(vector.values),
    metadata: vector.metadata
  }));

  // Track success
  let totalUpserted = 0;

  // Pinecone has a limit on batch size, so we need to chunk the requests
  const BATCH_SIZE = 100;

  try {
    for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
      const batch = embeddings.slice(i, i + BATCH_SIZE);
      console.log(`Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(embeddings.length / BATCH_SIZE)} with ${batch.length} vectors`);

      // Fix for metadata issue - create properly structured vector objects
      const vectors = batch.map(item => {
        // Ensure metadata is a properly formatted object, not an array
        let metadata: RecordMetadata = {};

        if (item.metadata) {
          if (Array.isArray(item.metadata)) {
            console.warn('CRITICAL ERROR: Metadata is an array of keys instead of an object:', item.metadata);
            metadata = {};
          } else if (typeof item.metadata === 'object') {
            try {
              const metadataObj = { ...item.metadata };

              if ('content' in metadataObj) metadata.content = String(metadataObj.content);
              if ('source' in metadataObj) metadata.source = String(metadataObj.source);
              if ('chunk_index' in metadataObj) metadata.chunk_index = Number(metadataObj.chunk_index);
              if ('total_chunks' in metadataObj) metadata.total_chunks = Number(metadataObj.total_chunks);
              if ('document_id' in metadataObj) metadata.document_id = String(metadataObj.document_id);
              if ('knowledge_base_id' in metadataObj) metadata.knowledge_base_id = String(metadataObj.knowledge_base_id);
              if ('user_id' in metadataObj) metadata.user_id = String(metadataObj.user_id);
              if ('created_at_iso' in metadataObj) metadata.created_at_iso = String(metadataObj.created_at_iso);
              if ('source_type' in metadataObj) metadata.source_type = String(metadataObj.source_type);
              if ('chunk_id' in metadataObj) metadata.chunk_id = String(metadataObj.chunk_id);
            } catch (error) {
              console.error('Error processing metadata:', error);
              metadata = {};
            }
          }
        }

        // Validate metadata
        if (!metadata.content || !metadata.document_id || !metadata.user_id) {
          console.warn('Metadata is missing required fields, using available fields', metadata);
          if (!metadata.content) metadata.content = 'No content available';
          if (!metadata.document_id) metadata.document_id = String(item.id);
          if (!metadata.user_id) metadata.user_id = '0';
        }

        // Handle missing or invalid values
        let vectorValues: number[] = [];
        if (item.values && Array.isArray(item.values)) {
          vectorValues = [...item.values];
        } else if (item.values) {
          try {
            vectorValues = Array.isArray(item.values) ? [...item.values] :
                         typeof item.values === 'object' ? Object.values(item.values) : 
                         [Number(item.values)];
            console.warn('Converting non-array values to array:', typeof item.values);
          } catch (e) {
            console.error('Failed to convert vector values to array:', e);
            vectorValues = Array(1536).fill(0); // Default vector length
          }
        } else {
          console.error('No vector values found, using zero vector as fallback');
          vectorValues = Array(1536).fill(0); // Default vector length
        }

        return {
          id: String(item.id),
          values: vectorValues,
          metadata
        };
      });

      // Log vectors being sent to Pinecone for debugging
      //console.log("Vectors being upserted:", JSON.stringify(vectors, null, 2));
      console.log("Vectors:", vectors);
      console.log("namespace:", namespace);
      //let vectors2 = vectors[0];
      try {
        
        const result = await index.upsert({
           namespace,
            vectors: vectors.map(v => ({
              id: String(v.id),
              values: [...v.values],
              metadata: v.metadata ? {...v.metadata} : undefined
            }))
        });

        if (result && typeof result.upsertedCount === 'number') {
          totalUpserted += result.upsertedCount;
          console.log(`Successfully upserted ${result.upsertedCount} vectors in this batch`);
        } else {
          console.error("Failed to upsert vectors. Pinecone returned no upserted count.");
        }
      } catch (error) {
        console.error(`Error upserting batch:`, error);

        if (i === 0) {
          throw error; // Signal an error if the first batch fails
        }
      }
    }

    console.log(`Completed storing ${totalUpserted} vectors in namespace '${namespace}'`);
    return { success: true, upsertedCount: totalUpserted };
  } catch (error) {
    console.error('Error storing embeddings in Pinecone:', error);
    return { success: false, upsertedCount: totalUpserted };
  }
}


/**
 * Query similar embeddings
 * @param {string} namespace - Pinecone namespace
 * @param {number[]} queryVector - The query vector
 * @param {number} topK - Number of results to return
 * @param {Record<string, any>} filter - Optional filter
 * @returns {Promise<any>} Matching embeddings
 */
export async function querySimilar(
  namespace: string, 
  queryVector: number[], 
  topK: number = 5,
  filter: Record<string, any> = {}
): Promise<any> {
  const index = getPineconeClient();

  // Prepare filter expression if needed
  const filterExpression = Object.keys(filter).length > 0 ? { metadata: filter } : undefined;

  return index.query({
    vector: queryVector,
    namespace,
    topK,
    filter: filterExpression,
    includeMetadata: true
  });
}

/**
 * Delete embeddings from Pinecone
 * @param {string} namespace - Pinecone namespace
 * @param {string[]} ids - IDs of embeddings to delete
 * @returns {Promise<void>}
 */
export async function deleteEmbeddings(namespace: string, ids: string[]): Promise<void> {
  const index = getPineconeClient();

  // Pinecone has a limit on batch size for deletion
  const BATCH_SIZE = 100;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    await index.delete({
      ids: batch,
      namespace
    });
  }
}

/**
 * Delete all embeddings in a namespace matching a filter
 * @param {string} namespace - Pinecone namespace
 * @param {Record<string, any>} filter - Filter criteria
 * @returns {Promise<void>}
 */
export async function deleteEmbeddingsByFilter(
  namespace: string, 
  filter: Record<string, any>
): Promise<void> {
  const index = getPineconeClient();
  await index.delete({
    filter: { metadata: filter },
    namespace
  });
}

/**
 * Delete all embeddings in a namespace
 * @param {string} namespace - Pinecone namespace
 * @returns {Promise<void>}
 */
export async function deleteNamespace(namespace: string): Promise<void> {
  const index = getPineconeClient();
  await index.delete({
    deleteAll: true,
    namespace
  });
}

/**
 * Verify Pinecone connection and return statistics
 * @returns {Promise<any>} Statistics about the Pinecone index
 */
export async function verifyPineconeConnection(): Promise<any> {
  console.log("Verifying Pinecone connection...");
  try {
    const index = getPineconeClient();
    const stats = await index.describeIndexStats();
    console.log("Pinecone connection verified successfully");
    console.log("Index statistics:", JSON.stringify(stats, null, 2));
    return stats;
  } catch (error) {
    console.error("Failed to verify Pinecone connection:", error);
    throw error;
  }
}