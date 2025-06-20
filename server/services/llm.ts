import axios from 'axios';
import { encrypt, decrypt, createHash, maskApiKey } from './encryption';
import { db } from '../postgresql';
import { eq, and, or, ne, sql } from 'drizzle-orm';
import { userApiKeys, llmProviders, llmModels, agents, dailyUsageMetrics } from '@shared/schema';
import { UnansweredQuestionsService } from './unanswered_questions_service';
import { queryKnowledgeBase } from './embedding_service';

// External AI service URL
const AI_SERVICE_URL = process.env.FLASK_API_URL || 'https://d6081979-14b6-491c-a89e-97bb41c5c0e8-00-2mdjtxzqllnzz.kirk.replit.dev';
// Ensure URL doesn't end with a slash to prevent double-slash issues
const EXTERNAL_API_URL = AI_SERVICE_URL.endsWith('/') ? AI_SERVICE_URL.slice(0, -1) : AI_SERVICE_URL;

/**
 * Utility function to track LLM token usage consistently across different functions
 * This function includes robust error handling and data validation
 * 
 * @param userId - The user ID to track usage for
 * @param tokenCount - Number of tokens used
 * @param metadata - Additional metadata about the request (provider, model, etc.)
 * @returns Promise that resolves when tracking is complete (or fails silently)
 */
// Make sure this function is properly exported
export async function trackLlmTokenUsage(
  userId: number,
  tokenCount: number,
  metadata: {
    provider: string;
    model: string;
    keyType: 'user' | 'environment' | 'unknown' | string;
    [key: string]: any;
  }
): Promise<any> {
  if (!userId) {
    console.warn('Cannot track token usage: Missing user ID');
    return;
  }
  
  // Ensure userId is a valid number
  if (isNaN(userId)) {
    console.warn(`Invalid user ID provided for token tracking: ${userId}`);
    return;
  }
  
  console.log(`
📊 TRACKING LLM TOKEN USAGE
  User ID: ${userId}
  Tokens: ${tokenCount}
  Provider: ${metadata.provider || 'unknown'}
  Model: ${metadata.model || 'unknown'}
  Key Type: ${metadata.keyType || 'unknown'}
  Source: ${metadata.source || 'unknown'}
`);
  
  // Validate the token count
  if (isNaN(tokenCount) || tokenCount <= 0) {
    console.warn(`Invalid token count (${tokenCount}) for tracking. Metadata:`, 
      JSON.stringify(metadata)
    );
    return;
  }
  
  try {
    // Get the storage instance
    const { storage } = await import('../storage');
    
    if (!storage || typeof storage.trackDailyUsageMetric !== 'function') {
      throw new Error('Storage interface is missing trackDailyUsageMetric method');
    }
    
    // Log detailed token tracking for debugging
    console.log(`🔍 DEBUG: Tracking token usage: ${tokenCount} tokens for model ${metadata.model}`);
    console.log(`🔍 DEBUG: Token usage details:
- Provider: ${metadata.provider || 'unknown'}
- Model: ${metadata.model || 'unknown'}
- Key Type: ${metadata.keyType || 'unknown'}
- User ID: ${userId} (type: ${typeof userId})
    `);

    try {
      // Test database connection before tracking
      const testConnection = await db.execute(sql`SELECT 1 as test`);
      console.log(`🔍 DEBUG: Database connection test: ${JSON.stringify(testConnection)}`);

      // Direct SQL check for usage_metrics table
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'daily_usage_metrics'
        ) as table_exists
      `);
      console.log(`🔍 DEBUG: daily_usage_metrics table exists: ${JSON.stringify(tableCheck)}`);

      // Insert directly using SQL for maximum reliability
      try {
        console.log(`🔍 DEBUG: Using direct SQL insertion with userId: ${userId}`);
        
        // Create today's date formatted for SQL as a string in YYYY-MM-DD format
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day
        const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        // First check if there's an existing metric for today with similar properties
        // Get source from metadata or default to 'api'
        const sourceValue = metadata.source || 'api';
        console.log(`🔍 DEBUG: Using source "${sourceValue}" for token tracking`);
        
        const existingMetricQuery = await db.execute(sql`
          SELECT id, metric_value FROM daily_usage_metrics
          WHERE user_id = ${userId}
          AND metric_type = 'llm_tokens_used'
          AND date = ${todayStr}
          AND source = ${sourceValue}
        `);
        
        console.log(`🔍 DEBUG: Existing metric check: ${JSON.stringify(existingMetricQuery)}`);
        
        let metricResult;
        // Ensure provider and model are stored as strings, not IDs
        console.log(`🔍 DEBUG: Provider before JSON: ${metadata.provider} (type: ${typeof metadata.provider})`);
        
        // Handle provider value - we want to use the slug directly
        let providerValue = metadata.provider;
        
        // If it's a numeric ID, attempt to look up the proper slug from the database
        if (typeof providerValue === 'number' || (typeof providerValue === 'string' && /^\d+$/.test(providerValue))) {
          try {
            const providerId = typeof providerValue === 'string' ? parseInt(providerValue, 10) : providerValue;
            console.log(`Looking up provider slug for numeric ID: ${providerId}`);
            
            // Get provider information from database 
            const providers = await getLlmProviders();
            const provider = providers.find(p => p.id === providerId);
            
            if (provider && provider.slug) {
              providerValue = provider.slug; 
              console.log(`Found provider slug ${providerValue} for ID ${providerId}`);
            } else {
              // Fallback mappings if DB lookup fails
              if (providerId === 1) {
                providerValue = 'openai';
              } else if (providerId === 2) {
                providerValue = 'anthropic';
              } else if (providerId === 3) {
                providerValue = 'mistral';
              }
              console.log(`Using fallback slug ${providerValue} for ID ${providerId}`);
            }
          } catch (err) {
            console.warn(`Error looking up provider slug: ${err}`);
          }
        }
        
        // Handle model value - try to get the actual model name
        let modelValue = metadata.model;
        if (typeof modelValue === 'number' || (typeof modelValue === 'string' && /^\d+$/.test(modelValue))) {
          try {
            const modelId = typeof modelValue === 'string' ? parseInt(modelValue, 10) : modelValue;
            
            // Try to look up model from database
            try {
              // Query the database for model information
              const modelsResult = await db.select()
                .from(llmModels)
                .where(eq(llmModels.id, modelId));
              
              if (modelsResult.length > 0) {
                // Use the model slug from database
                modelValue = modelsResult[0].slug;
                console.log(`Resolved model name from database: ${modelValue} for ID ${modelId}`);
              } else {
                // Fallback to hardcoded mappings if not found in database
                if (modelId === 1) {
                  modelValue = 'gpt-4o';
                } else if (modelId === 2) {
                  modelValue = 'gpt-3.5-turbo';
                } else if (modelId === 3) {
                  modelValue = 'claude-3-sonnet';
                } else {
                  console.log(`Unknown model ID ${modelId}, keeping as-is`);
                }
                console.log(`Using fallback model name: ${modelValue} for ID ${modelId}`);
              }
            } catch (dbError) {
              console.warn(`Error querying database for model: ${dbError}`);
              // Fallback to hardcoded mappings if database query fails
              if (modelId === 1) {
                modelValue = 'gpt-4o';
              } else if (modelId === 2) {
                modelValue = 'gpt-3.5-turbo';
              } else if (modelId === 3) {
                modelValue = 'claude-3-sonnet';
              }
              console.log(`Using fallback model name after DB error: ${modelValue}`);
            }
          } catch (err) {
            console.warn(`Error resolving model name: ${err}`);
          }
        }
        
        // Ensure we're storing strings, not numbers, in the metadata JSON
        const metadataJson = JSON.stringify({
          tokenType: 'total',
          provider: String(providerValue || 'unknown'),
          model: String(modelValue || 'unknown'),
          keyType: String(metadata.keyType || 'unknown')
        });
        
        console.log(`🔍 DEBUG: Metadata being stored: ${metadataJson}`);
        
        // Extract results to a standard array for consistent handling
        const resultRows = Array.isArray(existingMetricQuery) ? 
                           existingMetricQuery : 
                           ((existingMetricQuery as any)?.rows || []);
        
        if (resultRows.length > 0) {
          // Update existing record
          const existingId = resultRows[0].id;
          const existingValue = resultRows[0].metric_value;
          
          console.log(`🔍 DEBUG: Updating existing metric ID ${existingId} with current value ${existingValue}`);
          
          const updateResult = await db.execute(sql`
            UPDATE daily_usage_metrics
            SET metric_value = metric_value + ${tokenCount},
                updated_at = NOW(),
                metadata = ${metadataJson}
            WHERE id = ${existingId}
            RETURNING *
          `);
          
          const updateRows = Array.isArray(updateResult) ? 
                             updateResult : 
                             ((updateResult as any)?.rows || []);
          
          metricResult = updateRows.length > 0 ? updateRows[0] : null;
          console.log(`🔍 DEBUG: Update result: ${JSON.stringify(updateResult)}`);
        } else {
          // Insert new record
          console.log(`🔍 DEBUG: Creating new metric record`);
          
          const insertResult = await db.execute(sql`
            INSERT INTO daily_usage_metrics
            (user_id, date, metric_type, metric_value, source, metadata)
            VALUES
            (${userId}, ${todayStr}, 'llm_tokens_used', ${tokenCount}, ${metadata.source || 'unknown'}, ${metadataJson})
            RETURNING *
          `);
          
          const insertRows = Array.isArray(insertResult) ? 
                             insertResult : 
                             ((insertResult as any)?.rows || []);
          
          metricResult = insertRows.length > 0 ? insertRows[0] : null;
          console.log(`🔍 DEBUG: Insert result: ${JSON.stringify(insertResult)}`);
        }
        
        console.log(`✅ SUCCESS: Tracked LLM usage metric:
ID: ${metricResult?.id || 'unknown'}
Date: ${metricResult?.date ? new Date(metricResult.date).toISOString() : 'unknown'}
Tokens: ${tokenCount}
Provider: ${metadata.provider || 'unknown'}
Model: ${metadata.model || 'unknown'}
Key Type: ${metadata.keyType || 'unknown'}
        `);
        
        return metricResult;
      } catch (sqlError) {
        console.error('❌ SQL ERROR during direct token tracking insertion:', sqlError);
        
        // Fall back to the standard method if direct SQL fails
        console.log(`🔍 DEBUG: Falling back to storage interface method`);
        const metricResult = await storage.trackDailyUsageMetric(
          userId, 
          'llm_tokens_used',  // metric type
          tokenCount,         // metric value
          {
            source: metadata.source || 'unknown',    // source of the request (from metadata)
            metadata: {
              tokenType: 'total',
              provider: metadata.provider || 'unknown', 
              model: metadata.model || 'unknown',
              keyType: metadata.keyType || 'unknown',
              source: metadata.source || 'unknown'   // duplicate in metadata for easier querying
            }
          }
        );
        
        return metricResult;
      }
    } catch (dbError) {
      console.error('❌ ERROR in database operations during token tracking:', dbError);
      throw dbError; // Re-throw to be caught by outer try/catch
    }
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error('❌ Error tracking LLM token usage:', error);
    console.error('Failed tracking details:', JSON.stringify({
      userId: userId,
      tokenCount,
      provider: metadata.provider || 'unknown',
      model: metadata.model || 'unknown',
      keyType: metadata.keyType || 'unknown'
    }));
  }
}

// Function to send code generation requests to Python agent
export async function sendCodeGenerationRequest(prompt: string): Promise<any> {
  try {
    const codeApiUrl = `${EXTERNAL_API_URL}/api/llm/generate-code`;
    const response = await axios({
      method: 'post',
      url: codeApiUrl,
      data: {
        prompt,
        target_repl: process.env.REPL_SLUG // Identify this Repl
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error sending code generation request:', error);
    throw error;
  }
}

/**
 * Start the external AI service connection
 * This connects to the external service running in a separate repl
 */
export async function startLLMService(): Promise<void> {
  try {
    console.log('Waiting for AI service to be available...');
    // Set a very short timeout for the service check
    await waitForServiceToBeAvailable(3, 500);
    console.log('LLM service is ready');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to connect to AI service:', errorMessage);
    console.warn('Continuing application startup despite AI service unavailability.');
    // Not throwing the error allows the application to start even if the AI service is unavailable
  }
}

/**
 * Stop the LLM service connection
 * This is a no-op as we're using an external service
 */
export async function stopLLMService(): Promise<void> {
  console.log('LLM service connection closed');
  return;
}

/**
 * Verify the external AI service is available
 */
async function waitForServiceToBeAvailable(retries = 10, delay = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(`${EXTERNAL_API_URL}/api/llm/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      console.log(`Waiting for AI service to be available... (${i + 1}/${retries})`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('AI service failed to connect');
}

/**
 * Store a user's API key for an LLM provider
 */
export async function storeUserApiKey(
  userId: number, 
  providerId: string | number, 
  keyName: string,
  apiKey: string,
  isDefault: boolean = false,
  expiresAt?: Date
): Promise<number> {
  try {
    const numericProviderId = typeof providerId === 'string' ? parseInt(providerId) : providerId;
    
    // Create a hash of the API key for duplicate detection
    const keyHash = createHash(apiKey);
    
    // Check if this key already exists for this user and provider combination
    const existingKeys = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.keyHash, keyHash),
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.providerId, numericProviderId)
        )
      );
      
    if (existingKeys.length > 0) {
      throw new Error('This API key is already stored for this user and provider');
    }
    
    // Encrypt the API key
    const encryptedKey = encrypt(apiKey);
    
    // If this is set as default, remove default flag from other keys for this provider
    if (isDefault) {
      console.log(`New key is being set as default - Removing default flag from existing keys for providerId: ${numericProviderId}`);
      const updateResult = await db.update(userApiKeys)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(userApiKeys.userId, userId),
            eq(userApiKeys.providerId, numericProviderId),
            eq(userApiKeys.isDefault, true)
          )
        );
      console.log(`Reset default status for ${updateResult.count} existing keys`);
    }
    
    // Insert the new API key
    const now = new Date();
    const results = await db.insert(userApiKeys)
      .values({
        userId: userId,
        providerId: numericProviderId,
        keyName: keyName,
        encryptedKey: encryptedKey,
        keyHash: keyHash,
        expiresAt: expiresAt,
        isDefault: isDefault,
        updatedAt: now
      })
      .returning();
    
    // Register the key with the Python LLM service if it's the default
    if (isDefault) {
      await registerProviderWithLLMService(numericProviderId, apiKey);
    }
    
    return results[0].id;
  } catch (error) {
    console.error('Failed to store user API key:', error);
    throw error;
  }
}

/**
 * Get a user's API keys for a provider
 */
export async function getUserApiKeys(userId: number, providerId?: string | number): Promise<any[]> {
  try {
    // Build the where condition
    let whereCondition;
    
    if (providerId !== undefined) {
      // Handle providerId normalization
      let numericProviderId: number;
      
      // Check for null, undefined, empty string, and NaN
      if (providerId === null || providerId === '' || 
          (typeof providerId === 'number' && isNaN(providerId))) {
        console.log(`Invalid providerId in getUserApiKeys: ${providerId}, using default ID: 1`);
        numericProviderId = 1; // Default to OpenAI
      } else if (typeof providerId === 'string') {
        // Handle numeric strings
        const parsed = parseInt(providerId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          numericProviderId = parsed;
        } else {
          console.log(`Failed to parse providerId string in getUserApiKeys: ${providerId}, using default ID: 1`);
          numericProviderId = 1;
        }
      } else {
        // It's a number
        if (!isNaN(providerId) && providerId > 0) {
          numericProviderId = providerId;
        } else {
          console.log(`Invalid numeric providerId in getUserApiKeys: ${providerId}, using default ID: 1`);
          numericProviderId = 1;
        }
      }
      
      whereCondition = and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.providerId, numericProviderId)
      );
    } else {
      whereCondition = eq(userApiKeys.userId, userId);
    }
    
    // Find API keys
    const keys = await db.select()
      .from(userApiKeys)
      .where(whereCondition);
    
    // Get all provider IDs from the keys
    const providerIds = Array.from(new Set(keys.map(k => k.providerId)));
    
    // Get provider data to include provider name and slug
    let providers: Array<typeof llmProviders.$inferSelect> = [];
    
    if (providerIds.length > 0) {
      if (providerIds.length === 1) {
        providers = await db.select()
          .from(llmProviders)
          .where(eq(llmProviders.id, providerIds[0]));
      } else {
        // Build OR condition for multiple provider IDs
        const conditions = providerIds.map(id => eq(llmProviders.id, id));
        providers = await db.select()
          .from(llmProviders)
          .where(or(...conditions));
      }
    }
      
    const providerMap = new Map(providers.map(p => [p.id, p]));
    
    // Format the response
    const formattedKeys = keys.map(key => ({
      id: key.id,
      userId: key.userId,
      providerId: key.providerId,
      providerName: providerMap.get(key.providerId)?.name || 'Unknown Provider',
      providerSlug: providerMap.get(key.providerId)?.slug || 'unknown',
      keyName: key.keyName,
      maskedKey: maskApiKey(decrypt(key.encryptedKey)),
      isDefault: key.isDefault,
      expiresAt: key.expiresAt,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt
    }));
    
    // Log the keys for debugging
    console.log('API Keys for user:', userId, 'with isDefault status:', formattedKeys.map(k => ({
      id: k.id,
      providerId: k.providerId,
      providerName: k.providerName,
      isDefault: k.isDefault
    })));
    
    // Check if there are multiple default keys for the same provider
    const providerDefaultKeys = new Map();
    formattedKeys.forEach(key => {
      if (key.isDefault) {
        if (!providerDefaultKeys.has(key.providerId)) {
          providerDefaultKeys.set(key.providerId, []);
        }
        providerDefaultKeys.get(key.providerId).push(key.id);
      }
    });
    
    // Log warning if multiple default keys are found
    providerDefaultKeys.forEach((keyIds, providerId) => {
      if (keyIds.length > 1) {
        console.warn(`WARNING: Multiple default keys found for provider ${providerId}:`, keyIds);
      }
    });
    
    return formattedKeys;
  } catch (error) {
    console.error('Failed to get user API keys:', error);
    throw error;
  }
}

/**
 * Delete a user's API key
 */
export async function deleteUserApiKey(userId: number, keyId: number | string): Promise<boolean> {
  try {
    const numericKeyId = typeof keyId === 'string' ? parseInt(keyId) : keyId;
    
    // Find the key to check if it belongs to the user
    const [key] = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.id, numericKeyId),
          eq(userApiKeys.userId, userId)
        )
      );
      
    if (!key) {
      throw new Error('API key not found or does not belong to the user');
    }
    
    // Delete the key
    const result = await db.delete(userApiKeys)
      .where(eq(userApiKeys.id, numericKeyId))
      .returning();
      
    // If this was the default key, set another key as default
    if (key.isDefault) {
      // Find another key for this provider
      const [nextDefault] = await db.select()
        .from(userApiKeys)
        .where(
          and(
            eq(userApiKeys.userId, userId),
            eq(userApiKeys.providerId, key.providerId)
          )
        )
        .limit(1);
      
      if (nextDefault) {
        await db.update(userApiKeys)
          .set({ isDefault: true })
          .where(eq(userApiKeys.id, nextDefault.id));
        
        // Register the new default key with the Python LLM service
        await registerProviderWithLLMService(
          nextDefault.providerId,
          decrypt(nextDefault.encryptedKey)
        );
      }
    }
    
    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete user API key:', error);
    throw error;
  }
}

/**
 * Update a user's API key
 */
export async function updateUserApiKey(userId: number, keyId: number | string, updateData: { keyName?: string, isDefault?: boolean }): Promise<boolean> {
  try {
    const numericKeyId = typeof keyId === 'string' ? parseInt(keyId) : keyId;
    
    // Find the key to check if it belongs to the user
    const [key] = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.id, numericKeyId),
          eq(userApiKeys.userId, userId)
        )
      );
      
    if (!key) {
      return false;
    }
    
    // Update the key
    const updatePayload: any = { updatedAt: new Date() };
    if (updateData.keyName !== undefined) {
      updatePayload.keyName = updateData.keyName;
    }
    if (updateData.isDefault !== undefined) {
      updatePayload.isDefault = updateData.isDefault;
      
      // If setting as default, clear other defaults for this provider
      if (updateData.isDefault) {
        await db.update(userApiKeys)
          .set({ isDefault: false })
          .where(
            and(
              eq(userApiKeys.userId, userId),
              eq(userApiKeys.providerId, key.providerId),
              ne(userApiKeys.id, numericKeyId)
            )
          );
      }
    }
    
    await db.update(userApiKeys)
      .set(updatePayload)
      .where(eq(userApiKeys.id, numericKeyId));
      
    return true;
  } catch (error) {
    console.error('Failed to update user API key:', error);
    return false;
  }
}

export async function setDefaultUserApiKey(userId: number, keyId: number | string): Promise<boolean> {
  try {
    console.log(`Setting default key - userId: ${userId}, keyId: ${keyId}`);
    const numericKeyId = typeof keyId === 'string' ? parseInt(keyId) : keyId;
    
    // Find the key to check if it belongs to the user
    const [key] = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.id, numericKeyId),
          eq(userApiKeys.userId, userId)
        )
      );
      
    if (!key) {
      console.error(`API key not found or does not belong to user - keyId: ${numericKeyId}, userId: ${userId}`);
      throw new Error('API key not found or does not belong to the user');
    }
    
    console.log(`Found key to set as default:`, {
      id: key.id,
      providerId: key.providerId,
      isCurrentlyDefault: key.isDefault
    });
    
    // First approach: Use direct SQL to make the update more reliable
    try {
      console.log(`Using direct SQL to update default status for providerId: ${key.providerId}`);
      
      // Step 1: Set all keys for this provider to non-default using direct SQL
      const clearDefaultQuery = sql`
        UPDATE user_api_keys 
        SET is_default = false 
        WHERE user_id = ${userId} 
        AND provider_id = ${key.providerId}
      `;
      await db.execute(clearDefaultQuery);
      
      // Step 2: Set only the selected key as default using direct SQL
      const setDefaultQuery = sql`
        UPDATE user_api_keys 
        SET is_default = true, updated_at = NOW() 
        WHERE id = ${numericKeyId}
      `;
      await db.execute(setDefaultQuery);
      
      console.log(`Direct SQL update completed`);
    } catch (sqlError) {
      console.error(`Direct SQL update failed:`, sqlError);
      
      // Fall back to ORM approach if direct SQL fails
      console.log(`Falling back to ORM approach...`);
      
      // Update all keys for this provider to not be default (including this one to ensure clean state)
      console.log(`Removing default status from all keys for userId: ${userId}, providerId: ${key.providerId}`);
      const updateResult = await db.update(userApiKeys)
        .set({ isDefault: false })
        .where(
          and(
            eq(userApiKeys.userId, userId),
            eq(userApiKeys.providerId, key.providerId)
          )
        );
      
      console.log(`Reset ${updateResult.count} keys' default status`);
      
      // Set this key as default
      console.log(`Setting key ${numericKeyId} as default`);
      const result = await db.update(userApiKeys)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(userApiKeys.id, numericKeyId));
      
      console.log(`Updated key ${numericKeyId} as default`);
    }
    
    // Register the key with the Python LLM service
    await registerProviderWithLLMService(
      key.providerId,
      decrypt(key.encryptedKey)
    );
    
    // Verify that there's only one default key for this provider after our changes
    const defaultKeys = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.providerId, key.providerId),
          eq(userApiKeys.isDefault, true)
        )
      );
    
    console.log(`After update, found ${defaultKeys.length} default keys for providerId ${key.providerId}`);
    
    // Handle the case where multiple default keys still exist
    if (defaultKeys.length > 1) {
      console.warn(`WARNING: Multiple default keys still exist after update! IDs: ${defaultKeys.map(k => k.id).join(', ')}`);
      
      // Attempt to force fix the issue - clear all defaults except our target
      console.log(`Performing emergency cleanup of multiple default keys`);
      
      for (const defaultKey of defaultKeys) {
        // Skip the key we want to be default
        if (defaultKey.id === numericKeyId) continue;
        
        // Clear the default flag for this key
        await db.update(userApiKeys)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(userApiKeys.id, defaultKey.id));
          
        console.log(`Emergency cleanup: Removed default status from key ${defaultKey.id}`);
      }
    } else if (defaultKeys.length === 1 && defaultKeys[0].id === numericKeyId) {
      console.log(`Verification successful: Only key ${numericKeyId} is now set as default`);
    } else if (defaultKeys.length === 0) {
      console.warn(`WARNING: No default keys found after update! Attempting to set key ${numericKeyId} as default`);
      
      // One more attempt to set our key as default
      await db.update(userApiKeys)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(userApiKeys.id, numericKeyId));
    }
    
    return true;
  } catch (error) {
    console.error('Failed to set default user API key:', error);
    throw error;
  }
}

/**
 * Get the default API key for a provider
 */
export async function getDefaultUserApiKey(userId: number | string, providerId: string | number): Promise<any | null> {
  try {
    // ===== ENHANCED USER ID SAFETY CHECKS =====
    let numericUserId: number = 1; // Start with a safe default value
    
    // First check for invalid inputs that we know will cause issues
    if (userId === undefined || userId === null || userId === '' || 
        (typeof userId === 'number' && isNaN(userId))) {
      console.warn(`Invalid userId value detected early: ${userId}, type: ${typeof userId}, using default value 1`);
    } else {
      // Try to safely convert the userId to a number if it's valid
      if (typeof userId === 'string') {
        // Only parse if it looks like a number
        if (/^\d+$/.test(userId)) {
          const parsed = parseInt(userId, 10);
          if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed)) {
            numericUserId = parsed;
          } else {
            console.warn(`Parsed userId string "${userId}" but got invalid result: ${parsed}, using default value 1`);
          }
        } else {
          console.warn(`userId string "${userId}" is not a valid number format, using default value 1`);
        }
      } else if (typeof userId === 'number') {
        // Only use if it's a valid positive number
        if (!isNaN(userId) && userId > 0 && Number.isFinite(userId)) {
          numericUserId = userId;
        } else {
          console.warn(`Invalid userId number: ${userId}, using default value 1`);
        }
      } else {
        console.warn(`userId has unexpected type: ${typeof userId}, using default value 1`);
      }
    }
    
    // Final safety net - paranoid check to ensure we have a valid integer
    numericUserId = Math.floor(numericUserId);
    if (isNaN(numericUserId) || numericUserId <= 0 || !Number.isFinite(numericUserId)) {
      console.warn(`Final safety check caught invalid userId: ${numericUserId}, using default value 1`);
      numericUserId = 1;
    }
    
    // Ensure numericUserId is positively a valid number and not NaN
    if (!(typeof numericUserId === 'number' && !isNaN(numericUserId))) {
      numericUserId = 1;
      console.warn(`Extra safety: userId is still not valid after all checks, forcing to 1`);
    }
    
    // ===== ENHANCED PROVIDER ID SAFETY CHECKS =====
    // Always start with a safe default value
    let numericProviderId: number = 1;
    
    try {
      // First check for invalid inputs that we know will cause issues
      if (providerId === undefined || providerId === null || providerId === '' || 
          (typeof providerId === 'number' && isNaN(providerId))) {
        console.log(`Invalid providerId value detected early: ${providerId}, type: ${typeof providerId}, using default ID: 1`);
      } else {
        // Try to safely process the providerId based on its type
        if (typeof providerId === 'string') {
          // Empty string check (additional safety)
          if (providerId.trim() === '') {
            console.log(`Empty string provider ID, using default ID: 1`);
          }
          // Check if it's a known provider slug first
          else if (['openai', 'anthropic', 'mistral'].includes(providerId.toLowerCase())) {
            // Direct mapping of known providers
            const providerMap: Record<string, number> = {
              'openai': 1,
              'anthropic': 2,
              'mistral': 3
            };
            numericProviderId = providerMap[providerId.toLowerCase()];
            console.log(`Matched provider slug '${providerId}' to ID: ${numericProviderId}`);
          }
          // If it's not a known slug but looks like a number, try to parse it
          else if (/^\d+$/.test(providerId)) {
            const parsed = parseInt(providerId, 10);
            if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed) && parsed < Number.MAX_SAFE_INTEGER) {
              numericProviderId = parsed;
              console.log(`Parsed providerId string '${providerId}' to number: ${numericProviderId}`);
            } else {
              console.log(`Parsed providerId string "${providerId}" but got invalid result: ${parsed}, using default ID: 1`);
            }
          }
          // If it's a non-numeric string that's not a known slug, try to look it up
          else {
            console.log(`Looking up unknown provider slug: ${providerId}`);
            try {
              const id = await getProviderIdBySlug(providerId);
              if (id !== null && !isNaN(id) && id > 0 && Number.isFinite(id)) {
                numericProviderId = id;
                console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
              } else {
                console.log(`Could not resolve provider slug '${providerId}' to a valid ID, using default ID: 1`);
              }
            } catch (error) {
              console.error(`Error resolving provider ID for ${providerId}:`, error);
              console.log(`Using default ID: 1 due to error`);
            }
          }
        } else if (typeof providerId === 'number') {
          // Only use the number if it's valid
          if (!isNaN(providerId) && providerId > 0 && Number.isFinite(providerId) && providerId < Number.MAX_SAFE_INTEGER) {
            numericProviderId = providerId;
            console.log(`Using numeric provider ID: ${numericProviderId}`);
          } else {
            console.log(`Invalid numeric provider ID: ${providerId}, using default ID: 1`);
          }
        } else {
          console.log(`providerId has unexpected type: ${typeof providerId}, using default ID: 1`);
        }
      }
    } catch (error) {
      console.error(`Unexpected error during provider ID processing: ${error}`, error);
      console.log(`Using default ID: 1 due to error during processing`);
    }
    
    // Multiple layers of safety checks to guarantee we have a valid integer
    try {
      // 1. Convert to integer and check for NaN
      numericProviderId = Math.floor(Number(numericProviderId));
      
      // 2. Final safety check for any remaining issues
      if (isNaN(numericProviderId) || numericProviderId <= 0 || !Number.isFinite(numericProviderId)) {
        console.log(`Final safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
        numericProviderId = 1;
      }
      
      // 3. Extra paranoid check to ensure we have a valid positive integer
      if (typeof numericProviderId !== 'number' || numericProviderId !== Math.floor(numericProviderId) || numericProviderId <= 0) {
        console.log(`Extra safety check caught non-integer provider ID: ${numericProviderId}, using default ID: 1`);
        numericProviderId = 1;
      }
    } catch (error) {
      console.error(`Critical error in provider ID validation: ${error}`, error);
      numericProviderId = 1; // Safe fallback
    }
    
    // 3. Defensive type assertion to absolutely guarantee a number
    numericProviderId = Number(numericProviderId);
    
    // 4. One last paranoid check
    if (isNaN(numericProviderId) || numericProviderId <= 0) {
      console.log(`CRITICAL: After all checks, provider ID is still invalid. Forcing to 1.`);
      numericProviderId = 1;
    }
    
    // Ensure numericProviderId is positively a valid number and not NaN, not even possible to be NaN at this point
    if (!(typeof numericProviderId === 'number' && !isNaN(numericProviderId))) {
      numericProviderId = 1;
      console.warn(`Extra safety: providerId is still not valid after all checks, forcing to 1`);
    }
    
    // Log the final values being used in the query
    console.log(`Querying database with values - userId: ${numericUserId} (${typeof numericUserId}), providerId: ${numericProviderId} (${typeof numericProviderId})`);
    
    // Find the default key
    const [key] = await db.select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, numericUserId),
          eq(userApiKeys.providerId, numericProviderId),
          eq(userApiKeys.isDefault, true)
        )
      );
    
    // If user doesn't have an API key for this provider, use environment variables as fallback
    if (!key) {
      console.log(`No user API key found for userId ${numericUserId} and providerId ${numericProviderId}, checking environment variables`);
      
      // Get provider data to determine which environment variable to use
      const [provider] = await db.select()
        .from(llmProviders)
        .where(eq(llmProviders.id, numericProviderId));
      
      if (!provider) {
        console.error(`Provider with ID ${numericProviderId} not found`);
        return null;
      }
      
      // Map provider slugs to environment variable names
      const envVarMap: Record<string, string> = {
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'mistral': 'MISTRAL_API_KEY'
      };
      
      const envVarName = envVarMap[provider.slug.toLowerCase()];
      const defaultApiKey = process.env[envVarName];
      
      if (defaultApiKey) {
        console.log(`Found environment variable ${envVarName} for provider ${provider.slug}, using as fallback`);
        
        // Create a synthetic key object similar to what would be returned from the database
        return {
          id: -1, // Use a negative ID to indicate this is a fallback key
          userId: numericUserId,
          providerId: numericProviderId,
          keyName: `Default ${provider.name} API Key`,
          encryptedKey: encrypt(defaultApiKey), // Encrypt the environment variable key
          keyHash: createHash(defaultApiKey),
          isDefault: true,
          isEnvironmentDefault: true, // Flag to indicate this is from environment variables
          createdAt: new Date()
        };
      } else {
        console.warn(`No environment variable ${envVarName} found for provider ${provider.slug}`);
        return null;
      }
    }
    
    return key;
  } catch (error) {
    console.error('Failed to get default user API key:', error);
    throw error;
  }
}

/**
 * Register a provider with the Python LLM service
 */
async function registerProviderWithLLMService(providerId: string | number, apiKey: string): Promise<boolean> {
  try {
    // Default to OpenAI (ID: 1) - a safe fallback if we can't resolve the ID
    let numericProviderId: number = 1;
    
    // Early check to catch invalid provider IDs
    if (providerId === undefined || providerId === null || providerId === '' || 
        (typeof providerId === 'number' && isNaN(providerId))) {
      console.log(`Invalid, empty, or NaN providerId in registerProviderWithLLMService: ${providerId}, using default ID: ${numericProviderId}`);
      providerId = 1; // Default to OpenAI
    }
    
    console.log(`Received providerId in registerProviderWithLLMService: ${providerId} (type: ${typeof providerId})`);
    
    // Handle string provider IDs more carefully
    if (typeof providerId === 'string') {
      // Handle slug identifiers (e.g., 'openai', 'anthropic')
      if (isNaN(Number(providerId))) {
        console.log(`Resolving provider slug in registerProviderWithLLMService: ${providerId}`);
        try {
          const id = await getProviderIdBySlug(providerId);
          if (id !== null) {
            numericProviderId = id;
            console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
          } else {
            console.log(`Could not resolve provider slug '${providerId}', using default ID: ${numericProviderId}`);
          }
        } catch (error) {
          console.error(`Error resolving provider ID for ${providerId}:`, error);
          console.log(`Using default ID: ${numericProviderId} due to error`);
        }
      } else {
        // It's a numeric string, parse it
        const parsed = parseInt(providerId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          numericProviderId = parsed;
          console.log(`Parsed string provider ID '${providerId}' to number: ${numericProviderId}`);
        } else {
          console.log(`Failed to parse string provider ID '${providerId}', using default ID: ${numericProviderId}`);
        }
      }
    } else if (typeof providerId === 'number') {
      // Ensure it's a valid number (and not NaN)
      if (!isNaN(providerId) && providerId > 0) {
        numericProviderId = providerId;
        console.log(`Using numeric provider ID: ${numericProviderId}`);
      } else {
        console.log(`Invalid numeric provider ID: ${providerId}, using default ID: ${numericProviderId}`);
      }
    }
    
    // Final safety check to ensure we have a valid provider ID before database query
    if (isNaN(numericProviderId) || numericProviderId <= 0 || numericProviderId === Infinity) {
      console.log(`Final check in registerProviderWithLLMService: Invalid provider ID detected (${numericProviderId}), using default ID 1`);
      numericProviderId = 1; // Safe default to OpenAI
    }
    
    // Convert to integer to ensure we don't have any floating-point issues
    numericProviderId = Math.floor(numericProviderId);
    
    // Extra safety check to catch any other invalid values
    if (typeof numericProviderId !== 'number' || isNaN(numericProviderId)) {
      console.log(`Extra safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
      numericProviderId = 1;
    }
    
    // Get provider data
    const [provider] = await db.select()
      .from(llmProviders)
      .where(eq(llmProviders.id, numericProviderId));
    
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // Register the provider with the external LLM service
    try {
      const registerUrl = `${EXTERNAL_API_URL}/api/llm/register-provider`;
      const response = await axios({
        method: 'post',
        url: registerUrl,
        timeout: 5000,
        data: {
          provider_name: provider.slug,
          api_key: apiKey,
          base_url: provider.baseUrl,
          make_default: true
        }
      }); // Add a 5-second timeout to avoid hanging
      
      return response.status === 200;
    } catch (serviceError: unknown) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : String(serviceError);
      console.warn(`Could not register provider ${provider.name} with external AI service: ${errorMessage}`);
      console.warn('Application will continue running, but some LLM features may be limited');
      // Return true to avoid blocking the application startup
      return true;
    }
  } catch (error) {
    console.error('Failed to register provider with LLM service:', error);
    return false;
  }
}

/**
 * Get all available LLM providers
 */
export async function getLlmProviders(): Promise<any[]> {
  try {
    const result = await db.select()
      .from(llmProviders)
      .where(eq(llmProviders.isActive, true));
    
    return result.map(provider => ({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      description: provider.description,
      logoUrl: provider.logoUrl,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive
    }));
  } catch (error) {
    console.error('Failed to get LLM providers:', error);
    throw error;
  }
}

/**
 * Get provider ID by slug
 */
export async function getProviderIdBySlug(slug: string): Promise<number | null> {
  try {
    // Early safety check for invalid slug values
    if (slug === undefined || slug === null || typeof slug !== 'string') {
      console.log(`Invalid slug value (${slug}), defaulting to OpenAI (ID: 1)`);
      return 1; // Default to OpenAI
    }

    // Normalize slug to lowercase for case-insensitive comparison
    const normalizedSlug = slug.toLowerCase();
    console.log(`Looking up provider ID for slug: ${normalizedSlug}`);
    
    // Handle common slugs directly for better performance and reliability
    // This also helps if the database query fails for any reason
    if (normalizedSlug === 'openai') {
      console.log('Recognized OpenAI slug, using ID 1');
      return 1; // OpenAI is typically ID 1
    } else if (normalizedSlug === 'anthropic') {
      console.log('Recognized Anthropic slug, using ID 2');
      return 2; // Anthropic is typically ID 2
    } else if (normalizedSlug === 'mistral') {
      console.log('Recognized Mistral slug, using ID 3');
      return 3; // Mistral is typically ID 3
    }
    
    // For other slugs, query the database
    const providers: Array<typeof llmProviders.$inferSelect> = await db.select()
      .from(llmProviders)
      .where(eq(llmProviders.slug, normalizedSlug));
    
    const provider = providers.length > 0 ? providers[0] : null;
    const providerId = provider ? provider.id : null;
    
    if (providerId) {
      console.log(`Found provider ID ${providerId} for slug ${normalizedSlug}`);
    } else {
      console.log(`No provider found for slug ${normalizedSlug}, returning null`);
    }
    
    return providerId;
  } catch (error) {
    console.error(`Failed to get provider ID for slug ${slug}:`, error);
    // Return a safe default rather than throwing the error
    console.log('Using default provider ID 1 (OpenAI) due to error');
    return 1; // Default to OpenAI in case of errors
  }
}

/**
 * Get LLM models for a provider
 */
export async function getLlmModels(providerId: string | number): Promise<any[]> {
  try {
    // Default to OpenAI (ID: 1) - a safe fallback if we can't resolve the ID
    let numericProviderId: number = 1;
    
    // Early check to catch invalid provider IDs
    if (providerId === undefined || providerId === null || providerId === '' || 
        (typeof providerId === 'number' && isNaN(providerId))) {
      console.log(`Invalid, empty, or NaN providerId in getLlmModels: ${providerId}, using default ID: ${numericProviderId}`);
      providerId = 1; // Default to OpenAI
    }
    
    console.log(`Received providerId in getLlmModels: ${providerId} (type: ${typeof providerId})`);
    
    // Handle string provider IDs more carefully
    if (typeof providerId === 'string') {
      // Handle slug identifiers (e.g., 'openai', 'anthropic')
      if (isNaN(Number(providerId))) {
        console.log(`Resolving provider slug in getLlmModels: ${providerId}`);
        try {
          const id = await getProviderIdBySlug(providerId);
          if (id !== null) {
            numericProviderId = id;
            console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
          } else {
            console.log(`Could not resolve provider slug '${providerId}', using default ID: ${numericProviderId}`);
          }
        } catch (error) {
          console.error(`Error resolving provider ID for ${providerId}:`, error);
          console.log(`Using default ID: ${numericProviderId} due to error`);
        }
      } else {
        // It's a numeric string, parse it
        const parsed = parseInt(providerId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          numericProviderId = parsed;
          console.log(`Parsed string provider ID '${providerId}' to number: ${numericProviderId}`);
        } else {
          console.log(`Failed to parse string provider ID '${providerId}', using default ID: ${numericProviderId}`);
        }
      }
    } else if (typeof providerId === 'number') {
      // Ensure it's a valid number (and not NaN)
      if (!isNaN(providerId) && providerId > 0) {
        numericProviderId = providerId;
        console.log(`Using numeric provider ID: ${numericProviderId}`);
      } else {
        console.log(`Invalid numeric provider ID: ${providerId}, using default ID: ${numericProviderId}`);
      }
    }
    
    // Final safety check to ensure we have a valid provider ID before database query
    if (isNaN(numericProviderId) || numericProviderId <= 0 || numericProviderId === Infinity) {
      console.log(`Final check in getLlmModels: Invalid provider ID detected (${numericProviderId}), using default ID 1`);
      numericProviderId = 1; // Safe default to OpenAI
    }
    
    // Convert to integer to ensure we don't have any floating-point issues
    numericProviderId = Math.floor(numericProviderId);
    
    // Extra safety check to catch any other invalid values
    if (typeof numericProviderId !== 'number' || isNaN(numericProviderId)) {
      console.log(`Extra safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
      numericProviderId = 1;
    }
    
    const models = await db.select()
      .from(llmModels)
      .where(
        and(
          eq(llmModels.providerId, numericProviderId),
          eq(llmModels.isActive, true)
        )
      );
    
    return models.map(model => ({
      id: model.id,
      providerId: model.providerId,
      name: model.name,
      slug: model.slug,
      version: model.version,
      capabilities: model.capabilities,
      contextWindow: model.contextWindow,
      costPerInputToken: model.costPerInputToken,
      costPerOutputToken: model.costPerOutputToken,
      maxOutputTokens: model.maxOutputTokens,
      isActive: model.isActive
    }));
  } catch (error) {
    console.error('Failed to get LLM models:', error);
    throw error;
  }
}

/**
 * Send a chat completion request to an LLM provider
 */
export async function chatCompletion(
  userId: number | string,
  providerId: string | number,
  messages: Array<{ role: string, content: string }>,
  model?: string,
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<any> {
  try {
    // Default to OpenAI (ID: 1) - a safe fallback if we can't resolve the ID
    let numericProviderId: number = 1;
    
    // Early check to catch invalid provider IDs
    if (providerId === undefined || providerId === null || providerId === '' || 
        (typeof providerId === 'number' && isNaN(providerId))) {
      console.log(`Invalid, empty, or NaN providerId in chatCompletion: ${providerId}, using default ID: ${numericProviderId}`);
      providerId = 1; // Default to OpenAI
    }
    
    console.log(`Received providerId in chatCompletion: ${providerId} (type: ${typeof providerId})`);
    
    // Handle string provider IDs more carefully
    if (typeof providerId === 'string') {
      // Handle slug identifiers (e.g., 'openai', 'anthropic')
      if (isNaN(Number(providerId))) {
        console.log(`Resolving provider slug in chatCompletion: ${providerId}`);
        try {
          const id = await getProviderIdBySlug(providerId);
          if (id !== null) {
            numericProviderId = id;
            console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
          } else {
            console.log(`Could not resolve provider slug '${providerId}', using default ID: ${numericProviderId}`);
          }
        } catch (error) {
          console.error(`Error resolving provider ID for ${providerId}:`, error);
          console.log(`Using default ID: ${numericProviderId} due to error`);
        }
      } else {
        // It's a numeric string, parse it
        const parsed = parseInt(providerId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          numericProviderId = parsed;
          console.log(`Parsed string provider ID '${providerId}' to number: ${numericProviderId}`);
        } else {
          console.log(`Failed to parse string provider ID '${providerId}', using default ID: ${numericProviderId}`);
        }
      }
    } else if (typeof providerId === 'number') {
      // Ensure it's a valid number (and not NaN)
      if (!isNaN(providerId) && providerId > 0) {
        numericProviderId = providerId;
        console.log(`Using numeric provider ID: ${numericProviderId}`);
      } else {
        console.log(`Invalid numeric provider ID: ${providerId}, using default ID: ${numericProviderId}`);
      }
    }
    
    // Final safety check to ensure we have a valid provider ID before database query
    if (isNaN(numericProviderId) || numericProviderId <= 0 || numericProviderId === Infinity) {
      console.log(`Final check in chatCompletion: Invalid provider ID detected (${numericProviderId}), using default ID 1`);
      numericProviderId = 1; // Safe default to OpenAI
    }
    
    // Convert to integer to ensure we don't have any floating-point issues
    numericProviderId = Math.floor(numericProviderId);
    
    // Extra safety check to catch any other invalid values
    if (typeof numericProviderId !== 'number' || isNaN(numericProviderId)) {
      console.log(`Extra safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
      numericProviderId = 1;
    }
    
    // Get the user's default API key for this provider (now includes environment variable fallback)
    const defaultKey = await getDefaultUserApiKey(userId, numericProviderId);
    if (!defaultKey) {
      // At this point there's no user API key and no environment variable fallback
      throw new Error('No API key found for this provider. Please add an API key or set up the environment variable.');
    }
    
    // Get provider data
    const [provider] = await db.select()
      .from(llmProviders)
      .where(eq(llmProviders.id, numericProviderId));
    
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }
    
    // If no model specified, get the default model
    if (!model) {
      const [defaultModel] = await db.select()
        .from(llmModels)
        .where(
          and(
            eq(llmModels.providerId, numericProviderId),
            eq(llmModels.isActive, true)
          )
        )
        .limit(1);
      
      if (defaultModel) {
        model = defaultModel.slug;
      }
    }
    
    // Get model name for logging and fallback generation
    const modelName = model || 'gpt-4o';
    const promptContent = messages.map(m => `${m.role}: ${m.content}`).join('\n').substring(0, 100) + '...';
    
    console.log(`Sending chat completion request to external service with model ${modelName} and provider ${provider.slug}`);
    console.log(`Prompt begins with: ${promptContent}`);
    
    try {
      // Determine if this is an auto-select model request
      const isAuto = model === 'auto';
      const modelToUse = isAuto ? undefined : modelName;
      
      console.log(`Provider for LLM request: ${provider.slug}, Model: ${modelToUse || 'auto-select'}, Auto Mode: ${isAuto}`);
      
      // Log the complete URL for debugging
      const llmApiUrl = `${EXTERNAL_API_URL}/api/llm/chat-completion`;
      console.log(`Sending request to LLM API at: ${llmApiUrl}`);
      
      // Send the request to the LLM service with explicit request configuration
      const response = await axios({
        method: 'post',
        url: llmApiUrl,
        data: {
          provider_name: provider.slug,
          model: modelToUse,
          auto_select: isAuto,
          messages,
          temperature,
          max_tokens: maxTokens
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Update the last_used timestamp for the API key (only if it's a user key, not an environment variable key)
      if (!defaultKey.isEnvironmentDefault && defaultKey.id > 0) {
        await db.update(userApiKeys)
          .set({ lastUsed: new Date() })
          .where(eq(userApiKeys.id, defaultKey.id));
      }
      
      // Check if the response appears to contain serialization error message from Python service
      if (response.data && response.data.error && 
          response.data.error.includes('ChatCompletion is not JSON serializable')) {
        console.log('Detected Python serialization error in external service');
        
        // The Python service is returning the raw OpenAI object which can't be serialized
        // Return a valid fallback response
        console.log('Generating fallback response due to serialization error in external service');
        
        // Analyze messages to create a relevant fallback response
        const lastUserMessage = messages.findLast(m => m.role === 'user');
        const userQuery = lastUserMessage ? lastUserMessage.content : 'your question';
        
        return {
          content: `I apologize, but I encountered a technical issue while processing your request about "${userQuery.substring(0, 50)}${userQuery.length > 50 ? '...' : ''}". The system is working on resolving this. Please try again or rephrase your question.`,
          usage: { total_tokens: 0 },
          model: modelName,
          provider: provider.slug,
          error: 'External service serialization error'
        };
      }
        
      // Process the response to ensure it's serializable
      if (response.data) {
        try {
          console.log('Processing external service response');
          
          // Create a new object with only serializable properties
          const processedResponse = {
            content: response.data.content || 
                    (response.data.choices && response.data.choices[0]?.message?.content) ||
                    response.data.text || 
                    "I apologize, but I couldn't generate a response.",
            
            // Include usage information if available - check multiple possible formats
            usage: (
              // Standard OpenAI format
              response.data.usage || 
              // Custom token_usage format sometimes returned by Python service
              (response.data.token_usage ? { 
                total_tokens: response.data.token_usage.total_tokens,
                prompt_tokens: response.data.token_usage.prompt_tokens,
                completion_tokens: response.data.token_usage.completion_tokens
              } : undefined) ||
              // Single total_tokens field
              (response.data.total_tokens ? { total_tokens: response.data.total_tokens } : undefined) ||
              // Check tokenUsage field (alternate naming)
              (response.data.tokenUsage ? { 
                total_tokens: response.data.tokenUsage.total_tokens,
                prompt_tokens: response.data.tokenUsage.prompt_tokens,
                completion_tokens: response.data.tokenUsage.completion_tokens
              } : undefined) ||
              // Check token_count field (simpler format)
              (response.data.token_count ? { total_tokens: response.data.token_count } : undefined) ||
              // Last resort fallback
              { total_tokens: 0 }
            ),
            
            // Include other serializable metadata
            model: response.data.model || modelName || 'unknown',
            provider: provider.slug,
            
            // Include any citations if they exist
            citations: Array.isArray(response.data.citations) ? response.data.citations : []
          };
          
          // Log the processed usage information
          console.log(`📊 PROCESSED USAGE DATA: ${JSON.stringify(processedResponse.usage)}`);
          
          
          // Log the entire response for debugging
          console.log('Python service response details:', JSON.stringify({
            hasUsage: !!response.data.usage,
            usageData: response.data.usage || 'No usage data',
            responseKeys: Object.keys(response.data),
            model: response.data.model || 'unknown'
          }, null, 2));

          // Track token usage metrics using the utility function
          try {
            // Dump raw response data for debugging
            console.log(`📊 TOKEN TRACKING DEBUG - Raw response data keys:`, Object.keys(response.data));
            
            // Try to extract token usage data from various possible locations with detailed logging
            let tokenCount = 0;
            let tokenSource = 'not_found';
            
            // Log all possible token usage fields we check
            console.log(`📊 DETAILED TOKEN DATA INSPECTION:
- response.data.usage: ${JSON.stringify(response.data.usage)}
- response.data.token_usage: ${JSON.stringify(response.data.token_usage)}
- response.data.total_tokens: ${response.data.total_tokens}
- response.data.tokenUsage: ${JSON.stringify(response.data.tokenUsage)}
- response.data.token_count: ${response.data.token_count}
- processedResponse.usage: ${JSON.stringify(processedResponse.usage)}
            `);
            
            // Check in order from most specific to most general
            if (response.data.usage?.total_tokens) {
              tokenCount = response.data.usage.total_tokens;
              tokenSource = 'usage.total_tokens';
            } else if (response.data.tokenUsage?.total_tokens) {
              tokenCount = response.data.tokenUsage.total_tokens;
              tokenSource = 'tokenUsage.total_tokens';
            } else if (response.data.token_usage?.total_tokens) {
              tokenCount = response.data.token_usage.total_tokens;
              tokenSource = 'token_usage.total_tokens';
            } else if (response.data.total_tokens) {
              tokenCount = response.data.total_tokens;
              tokenSource = 'total_tokens';
            } else if (response.data.token_count) {
              tokenCount = response.data.token_count;
              tokenSource = 'token_count';
            } else if (processedResponse.usage?.total_tokens) {
              tokenCount = processedResponse.usage.total_tokens;
              tokenSource = 'processedResponse.usage.total_tokens';
            } else if (typeof response.data.tokens === 'number') {
              tokenCount = response.data.tokens;
              tokenSource = 'tokens';
            } 
            
            // If we still haven't found tokens, check for prompt_tokens + completion_tokens
            if (tokenCount === 0) {
              const promptTokens = response.data.usage?.prompt_tokens || 
                                  response.data.prompt_tokens || 
                                  response.data.tokenUsage?.prompt_tokens || 
                                  response.data.token_usage?.prompt_tokens || 0;
                                  
              const completionTokens = response.data.usage?.completion_tokens || 
                                      response.data.completion_tokens || 
                                      response.data.tokenUsage?.completion_tokens || 
                                      response.data.token_usage?.completion_tokens || 0;
                                      
              if (promptTokens > 0 || completionTokens > 0) {
                tokenCount = promptTokens + completionTokens;
                tokenSource = 'prompt_tokens + completion_tokens';
              }
            }
            
            // Log final token count and source
            console.log(`📊 FINAL TOKEN COUNT: ${tokenCount} (source: ${tokenSource})`);
            
            // Track token usage with our reusable utility function
            // Convert userId to number if it's a string to ensure consistent token tracking
            const userIdNum: number = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
            
            if (!isNaN(userIdNum) && tokenCount > 0) {
              // Determine the actual provider used
              // First check if the response contains provider information
              // Ensure we're storing the provider slug (string), not ID (number)
              let actualProviderSlug = '';
              
              if (response.data.provider_used) {
                actualProviderSlug = response.data.provider_used; // From Python service response
              } else if (provider?.slug) {
                actualProviderSlug = provider.slug; // From the provider object
              } else if (typeof providerId === 'string' && !providerId.match(/^\d+$/)) {
                actualProviderSlug = providerId; // Direct provider slug (like "openai")
              } else {
                actualProviderSlug = 'unknown'; // Fallback
              }
              
              console.log(`🔍 DEBUG: Resolved provider slug from: response=${response.data.provider_used}, provider obj=${provider?.slug}, direct=${providerId}`);
              
              // Determine the actual model used (may be different than requested if auto-selection was used)
              let actualModel = response.data.model_used || processedResponse?.model || 'unknown';
              
              // For auto-selected models, use a special designation
              if (model === 'auto' && response.data.model_used) {
                actualModel = `auto:${response.data.model_used}`;
              }
              
              console.log(`🔍 DEBUG: Token tracking in chatCompletion for user ${userIdNum}, tokens: ${tokenCount}`);
              console.log(`🔍 DEBUG: Provider: ${actualProviderSlug}, Model: ${actualModel}`);
              
              try {
                // Use the keyType more consistently
                const keyType = defaultKey?.isEnvironmentDefault ? 'environment' : 'user';
                console.log(`🔍 DEBUG: Using API key type: ${keyType}`);
                
                await trackLlmTokenUsage(
                  userIdNum,
                  tokenCount,
                  {
                    provider: actualProviderSlug,
                    model: actualModel,
                    keyType: keyType,
                    tokenType: 'total',
                    source: 'chat_completion'
                  }
                );
                console.log(`✅ Successfully tracked ${tokenCount} tokens for user ${userIdNum}`);
              } catch (trackingError) {
                console.error(`❌ Error tracking tokens in chatCompletion:`, trackingError);
                console.error(`Tracking error details:`, trackingError instanceof Error ? trackingError.message : String(trackingError));
                // Continue processing to ensure the response is returned even if tracking fails
              }
            } else if (tokenCount <= 0) {
              console.warn(`⚠️ No tokens to track: tokenCount=${tokenCount} for user ${userIdNum}`);
            } else {
              console.error(`❌ Invalid userId format: ${userId} (parsed as ${userIdNum})`);
            }
          } catch (trackingError) {
            // Double safety - catch any errors that might occur even with our utility function
            console.error('Unexpected error in token tracking process:', trackingError);
          }
          
          // Test serialization
          JSON.stringify(processedResponse);
          console.log('Successfully processed and serialized LLM response');
          
          return processedResponse;
        } catch (serializationError) {
          console.error('Error serializing LLM response:', serializationError);
          // Return a minimal fallback response
          return {
            content: "I apologize, but I encountered an error processing your request.",
            usage: { total_tokens: 0 },
            model: modelName || 'unknown',
            provider: provider.slug,
            error: 'Response serialization error'
          };
        }
      }
      
      // Fallback if response data is undefined or null
      return {
        content: "I apologize, but I received an empty response from the language model.",
        usage: { total_tokens: 0 },
        model: modelName || 'unknown',
        provider: provider.slug,
        error: 'Empty response'
      };
    } catch (error: any) {
      console.error('External API request failed:', error.message || 'Unknown error');
      // If we received any response data with the error, try to extract the error message
      if (error.response && error.response.data) {
        console.log('Error response data:', JSON.stringify(error.response.data, null, 2));
        
        // Check for Python serialization error
        if (error.response.data.error && 
            typeof error.response.data.error === 'string' &&
            error.response.data.error.includes('ChatCompletion is not JSON serializable')) {
          console.log('Detected Python serialization error from exception');
          
          // Extract last user message for context
          const lastUserMessage = messages.findLast(m => m.role === 'user');
          const userQuery = lastUserMessage ? lastUserMessage.content : 'your question';
          
          return {
            content: `I apologize, but I encountered a technical issue while processing your request about "${userQuery.substring(0, 50)}${userQuery.length > 50 ? '...' : ''}". The system is working on resolving this. Please try again or rephrase your question.`,
            usage: { total_tokens: 0 },
            model: modelName,
            provider: provider.slug,
            error: 'External service serialization error'
          };
        }
      }
      
      // Default error handling - rethrow to be caught by the outer try/catch
      throw error;
    }
  } catch (error) {
    console.error('Failed to send chat completion request:', error);
    throw error;
  }
}

/**
 * Generate embeddings for text
 */
/**
 * Generate continuous content incrementally in chunks for long-form content, like sales pages
 * This function will generate text in multiple steps, each building upon the previous generation
 * @param userId - User ID
 * @param providerId - Provider ID or slug
 * @param query - The main content request (e.g., "Create a sales page for...")
 * @param agentId - Agent ID to use for generation
 * @param knowledgeBaseId - Optional knowledge base ID
 * @param totalSections - Number of sections to generate (default: 5)
 * @param maxTokensPerSection - Maximum tokens per section (default: 1500)
 * @param temperature - Temperature for generation (default: 0.7 for creative content)
 * @returns The complete generated content
 */
export async function generateContinuousContent(
  userId: number | string,
  providerId: string | number,
  query: string,
  agentId: number,
  knowledgeBaseId?: number,
  totalSections: number = 5,
  maxTokensPerSection: number = 1500,
  temperature: number = 0.7
): Promise<string> {
  console.log(`Starting continuous content generation for user ${userId}, agent ${agentId}, query: ${query.substring(0, 100)}...`);
  
  // Check if the agent has continuous content generation enabled
  try {
    // Use the database directly to query the agent
    const [agent] = await db.select()
      .from(agents)
      .where(eq(agents.id, agentId));

    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // If the agent has disabled continuous content generation, return an error
    if (agent.allowContinuousGeneration === false) {
      console.log(`Continuous content generation is disabled for agent ${agentId}`);
      throw new Error("Continuous content generation is disabled for this agent. Please enable it in the agent settings to use this feature.");
    }
  } catch (error) {
    console.error(`Error checking agent continuous generation settings:`, error);
    throw error;
  }
  
  let fullContent = '';
  let currentSectionNumber = 1;
  
  try {
    // Get relevant context from the knowledge base if provided
    let context = '';
    
    if (knowledgeBaseId) {
      try {
        const kbResponse = await queryKnowledgeBase(userId, knowledgeBaseId, query, providerId, agentId);
        
        if (kbResponse && kbResponse.relevant_chunks) {
          kbResponse.relevant_chunks.forEach((chunk: any, index: number) => {
            context += `\n[${index + 1}] ${chunk.content}\n`;
          });
        }
      } catch (error) {
        console.error(`Error querying knowledge base for continuous content generation:`, error);
      }
    }
    
    // Generate content section by section
    for (let i = 0; i < totalSections; i++) {
      const sectionContent = await generateContentSection(
        userId,
        providerId,
        query,
        fullContent, // Pass previously generated content for continuation
        i === 0 ? false : true, // Is this a continuation?
        context,
        currentSectionNumber,
        totalSections,
        maxTokensPerSection,
        temperature,
        agentId
      );
      
      // Add the section to the full content
      fullContent += sectionContent;
      
      // Increment section number
      currentSectionNumber++;
      
      console.log(`Generated section ${i+1}/${totalSections}, cumulative length: ${fullContent.length} chars`);
    }
    
    return fullContent;
  } catch (error) {
    console.error('Error generating continuous content:', error);
    throw error;
  }
}

// Helper function to generate a single section of content
async function generateContentSection(
  userId: number | string,
  providerId: string | number,
  originalQuery: string,
  previousContent: string,
  isContinuation: boolean,
  context: string,
  currentSection: number,
  totalSections: number,
  maxTokens: number,
  temperature: number,
  agentId: number
): Promise<string> {
  // Create section-specific query
  let sectionQuery = originalQuery;
  
  // For continuation sections, add specific instructions
  if (isContinuation) {
    sectionQuery = `${originalQuery} (Section ${currentSection} of ${totalSections})`;
  }
  
  // Generate this section using the RAG function
  const result = await generateAnswerFromContext(
    userId,
    providerId,
    context,
    sectionQuery,
    undefined, // Use default model
    temperature,
    maxTokens,
    agentId,
    undefined, // No KB ID needed (already queried above)
    undefined, // No conversation ID
    undefined, // No message ID
    'content_generator',
    previousContent, // Pass previous content for continuation
    isContinuation // Flag indicating this is a continuation request
  );
  
  return result.answer || '';
}

/**
 * Generate an answer based on the provided context using RAG technique
 * 
 * @param userId - User ID to use for API key lookup
 * @param providerId - LLM provider ID
 * @param context - Context information retrieved from the knowledge base
 * @param query - User's question
 * @param model - Optional model name (provider-specific default will be used if not provided)
 * @param temperature - Temperature for generation (lower = more deterministic)
 * @param maxTokens - Maximum tokens to generate
 * @returns Generated answer and model used
 */
export async function generateAnswerFromContext(
  userId: number | string,
  providerId: string | number,
  context: string,
  query: string,
  model?: string,
  temperature: number = 0.2,
  maxTokens: number = 1024,
  agentId?: number,
  knowledgeBaseId?: number,
  conversationId?: number,
  messageId?: number,
  source: string = 'chat',
  continuationText: string = '', // For continuation, previous generated text
  isContinuation: boolean = false // Flag to indicate if this is a continuation request
): Promise<any> {
  try {
    // Default to OpenAI (ID: 1) - a safe fallback if we can't resolve the ID
    let numericProviderId: number = 1;
    
    // Early check to catch invalid provider IDs
    if (providerId === undefined || providerId === null || providerId === '' || 
        (typeof providerId === 'number' && isNaN(providerId))) {
      console.log(`Invalid, empty, or NaN providerId in generateAnswerFromContext: ${providerId}, using default ID: ${numericProviderId}`);
      providerId = 1; // Default to OpenAI
    }
    
    console.log(`Received providerId in generateAnswerFromContext: ${providerId} (type: ${typeof providerId})`);
    
    // Use the helper functions to normalize provider ID and get API key
    const apiKey = await getDefaultUserApiKey(userId, providerId);
    
    if (!apiKey) {
      throw new Error(`No API key found for user ${userId} and provider ${providerId}`);
    }
    
    // Decrypt the API key
    const decryptedKey = decrypt(apiKey.encryptedKey);
    
    // Get the agent's prompt template if available
    let promptTemplate = undefined;
    
    if (agentId) {
      try {
        // Attempt to get the agent directly via SQL to make sure we get the new fields
        try {
          // Import storage instance
          const { storage } = await import('../storage');
          const agent = await storage.getAgent(agentId);
          
          if (agent) {
            // Get prompt template
            if (agent.promptTemplate) {
              promptTemplate = agent.promptTemplate;
              console.log(`Using custom prompt template for agent ${agentId} in LLM service`);
              
              // Check if this is a creative request for sales page generation
              if (query.toLowerCase().startsWith("create a sales page") || 
                  query.toLowerCase().startsWith("generate a sales page") ||
                  query.toLowerCase().startsWith("write a sales page")) {
                // Add the special flag for creative generation
                promptTemplate = "CREATE_SALES_PAGE " + promptTemplate;
                console.log("Added CREATE_SALES_PAGE flag to prompt template for creative generation");
              }
            }
            
            // Add agent-specific rules to the prompt if available
            if (agent.rules && Array.isArray(agent.rules) && agent.rules.length > 0) {
              // Filter out empty rules
              const validRules = agent.rules.filter((rule: string) => rule && rule.trim().length > 0);
              
              if (validRules.length > 0) {
                // Add a rules section to the prompt
                if (!promptTemplate) {
                  // If no prompt template, start with default
                  promptTemplate = "You are a helpful assistant that answers questions based on the provided context.";
                }
                
                // Append the rules to the prompt
                promptTemplate += `\n\nADDITIONAL AGENT RULES:
${validRules.map((rule: string, index: number) => `${index + 1}. ${rule}`).join('\n')}`;
                
                console.log(`Added ${validRules.length} agent-specific rules to the prompt in LLM service`);
              }
            }
          }
        } catch (directErr) {
          console.error(`Error getting agent via storage.getAgent: ${directErr}`);
          
          // Fallback to the old method if the direct query fails
          const [agent] = await db.select()
            .from(agents)
            .where(eq(agents.id, agentId));
          
          if (agent && agent.promptTemplate) {
            promptTemplate = agent.promptTemplate;
            console.log(`Using custom prompt template for agent ${agentId} in LLM service (fallback method)`);
          }
        }
      } catch (err) {
        console.error(`Error getting agent custom prompt template: ${err}`);
      }
    }
    
    // Get agent rules if available to pass explicitly
    let agentRules = [];
    let relevanceThreshold = null;
    
    if (agentId) {
      try {
        const { storage } = await import('../storage');
        const agent = await storage.getAgent(agentId);
        
        if (agent && agent.rules) {
          try {
            // Parse the rules if they're a string (JSON array)
            if (typeof agent.rules === 'string') {
              agentRules = JSON.parse(agent.rules);
            } else if (Array.isArray(agent.rules)) {
              agentRules = agent.rules;
            }
            
            console.log(`Passing ${agentRules.length} agent rules separately to Python service for relevance determination`);
          } catch (parseError) {
            console.error(`Error parsing agent rules: ${parseError}`);
          }
        }
        
        // Pass the confidence threshold to the Python service
        if (agent && agent.confidenceThreshold) {
          relevanceThreshold = parseFloat(agent.confidenceThreshold);
          console.log(`Passing agent confidence threshold (${relevanceThreshold}) to Python service`);
        }
      } catch (agentError) {
        console.error(`Error getting agent rules: ${agentError}`);
      }
    }
    
    // Log the detailed request being sent to Python service
    // Add the agent rules and relevance threshold parameters
    const requestData = {
      context,
      query,
      provider_name: apiKey.provider?.slug || 'openai', // Default to OpenAI
      model,
      temperature,
      max_tokens: maxTokens,
      prompt_template: promptTemplate, // Pass the prompt template if available
      continuation_text: continuationText, // Pass the previous text for continuation
      is_continuation: isContinuation, // Flag indicating if this is a continuation request
      agent_rules: agentRules, // Pass agent rules explicitly for relevance determination
      relevance_threshold: relevanceThreshold // Pass the confidence threshold for relevance checks
    };
    
    // Log the agent rules and threshold that we're sending
    console.log("==== DEBUG: AGENT RULES AND THRESHOLD PARAMETERS BEING SENT ====");
    console.log(`Agent rules (${agentRules?.length || 0}):`, JSON.stringify(agentRules));
    console.log(`Relevance threshold: ${relevanceThreshold}`);
    console.log("=====================================================================");
    
    console.log("==== DEBUG: SENDING REQUEST TO PYTHON SERVICE ====");
    console.log(`External API URL: ${EXTERNAL_API_URL}`);
    console.log(`Agent ID: ${agentId}`);
    console.log("=================================================");
    
    // Make request to the Python LLM service
    const answerApiUrl = `${EXTERNAL_API_URL}/api/llm/generate-answer`;
    const response = await axios({
      method: 'post',
      url: answerApiUrl,
      data: requestData
    });
    
    // Log response from Python service for debugging
    console.log("==== DEBUG: RECEIVED RESPONSE FROM PYTHON SERVICE ====");
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`Raw response data:`, JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    
    // NEW: Enhanced logging for token usage data
    console.log("\n=== TOKEN USAGE DATA INSPECTION ===");
    console.log(`Has token_usage property: ${Boolean(response.data.token_usage)}`);
    if (response.data.token_usage) {
      console.log(`token_usage content: ${JSON.stringify(response.data.token_usage)}`);
    }
    console.log(`Has usage property: ${Boolean(response.data.usage)}`);
    if (response.data.usage) {
      console.log(`usage content: ${JSON.stringify(response.data.usage)}`);
    }
    console.log(`Has total_tokens property: ${Boolean(response.data.total_tokens)}`);
    if (response.data.total_tokens) {
      console.log(`total_tokens value: ${response.data.total_tokens}`);
    }
    console.log("====================================================");
    
    // NEW: Extract and track token usage from Python service response
    let tokenCount = 0;
    let tokenSource = 'not_found';
    
    // Try multiple possible token usage formats
    if (response.data.token_usage?.total_tokens) {
      tokenCount = response.data.token_usage.total_tokens;
      tokenSource = 'token_usage.total_tokens';
    } else if (response.data.usage?.total_tokens) {
      tokenCount = response.data.usage.total_tokens;
      tokenSource = 'usage.total_tokens';
    } else if (response.data.total_tokens) {
      tokenCount = response.data.total_tokens;
      tokenSource = 'total_tokens';
    } else if (response.data.token_count) {
      tokenCount = response.data.token_count;
      tokenSource = 'token_count';
    }
    
    // If we still haven't found tokens, check for prompt_tokens + completion_tokens
    if (tokenCount === 0) {
      const promptTokens = response.data.token_usage?.prompt_tokens || 
                          response.data.usage?.prompt_tokens || 
                          response.data.prompt_tokens || 0;
                          
      const completionTokens = response.data.token_usage?.completion_tokens || 
                              response.data.usage?.completion_tokens || 
                              response.data.completion_tokens || 0;
                              
      if (promptTokens > 0 || completionTokens > 0) {
        tokenCount = promptTokens + completionTokens;
        tokenSource = 'prompt_tokens + completion_tokens';
      }
    }
    
    console.log(`📊 EXTRACTED TOKEN COUNT: ${tokenCount} (source: ${tokenSource})`);
    
    // Track token usage if we have valid data
    if (tokenCount > 0) {
      try {
        // Ensure userId is a number
        const numericUserId = typeof userId === 'string' ? parseInt(userId) : Number(userId);
        if (isNaN(numericUserId)) {
          console.warn(`Invalid user ID for token tracking: ${userId}`);
        } else {
          console.log(`🔄 Tracking token usage: ${tokenCount} tokens for user ${numericUserId}`);
          
          // Get the API key provider information
          const keyType = apiKey.isEnvironmentDefault ? 'environment' : 'user';
          
          // Added detailed logging to diagnose provider issue
          console.log(`🔍 DEBUG apiKey object: ${JSON.stringify({
            id: apiKey?.id,
            providerId: apiKey?.providerId,
            hasProvider: Boolean(apiKey?.provider),
            providerSlug: apiKey?.provider?.slug,
            isEnvDefault: apiKey?.isEnvironmentDefault
          })}`);
          
          // Provider resolution logic - prioritize in this order:
          // 1. Python service response (provider_used or provider field)
          // 2. API key provider info (from database)
          // 3. Request data provider_name (what was sent to Python service)
          // 4. Default to 'unknown'
          let providerName = 'unknown';
          
          // First priority: Provider info from Python service response
          if (response.data.provider_used) {
            // Direct slug returned by Python service
            providerName = response.data.provider_used;
            console.log(`Using provider_used from Python response: ${providerName}`);
          } else if (response.data.provider) {
            // Alternate field name
            providerName = response.data.provider;
            console.log(`Using provider from Python response: ${providerName}`);
          }
          // Second priority: API key provider info from database
          else if (apiKey?.provider?.slug) {
            providerName = apiKey.provider.slug;
            console.log(`Using provider slug from API key: ${providerName}`);
          }
          // Third priority: What was sent to Python service
          else if (requestData?.provider_name) {
            providerName = requestData.provider_name;
            console.log(`Using provider_name from request data: ${providerName}`);
          }
          // Final fallback: Try to resolve provider by ID
          else if (typeof providerId === 'string' && providerId) {
            try {
              const providerInfo = await getLlmProviders();
              const matchedProvider = providerInfo.find(p => p.id.toString() === providerId || p.slug === providerId);
              if (matchedProvider) {
                providerName = matchedProvider.slug;
                console.log(`Resolved provider name from ID ${providerId}: ${providerName}`);
              }
            } catch (providerError) {
              console.error('Error resolving provider by ID:', providerError);
            }
          }
          
          // Ensure the provider name is a valid string
          if (!providerName || typeof providerName !== 'string') {
            providerName = 'unknown';
            console.log(`Invalid provider name, using 'unknown'`);
          }
          
          const modelName = response.data.model || model || 'unknown';
          
          // Call our token tracking function
          await trackLlmTokenUsage(
            numericUserId,
            tokenCount,
            {
              provider: providerName,
              model: modelName,
              keyType: keyType,
              tokenType: 'total',
              source: source || 'api'
            }
          );
          
          console.log(`✅ Successfully tracked ${tokenCount} tokens for user ${numericUserId}`);
        }
      } catch (trackingError) {
        console.error(`❌ Error tracking tokens in generateAnswerFromContext:`, trackingError);
        // Don't throw the error - we don't want to fail the main function if tracking fails
      }
    } else {
      console.warn(`⚠️ No token count found in Python service response. Unable to track token usage.`);
    }
    
    // Check if the answer might be an unanswered question
    // The confidence score is a value from the model indicating how confident it is in the answer
    // If it's not provided, we'll use a default value
    // Note: The Python service may return confidence on a 0-100 scale or 0-1 scale
    // We normalize it to 0-1 for easier comparison with threshold settings in the app
    let confidenceScore = response.data.confidence_score || 
                         (response.data.metadata && response.data.metadata.confidence_score) || 
                         0.75; // Default to 75% confidence if not provided
    
    // If confidence is on a 0-100 scale, normalize it to 0-1 scale
    if (confidenceScore > 1) {
      confidenceScore = confidenceScore / 100;
      console.log(`Normalized confidence from 0-100 scale to 0-1 scale: ${confidenceScore}`);
    }
    
    // Normalize userId to numeric form if it's a string
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    // For knowledge base queries, skip relevance filtering completely since we sent skip_relevance_filtering: true
    const isIrrelevant = false; // Always treat knowledge base responses as relevant
    
    // Log detailed information about relevance determination
    console.log("==== DEBUG: RELEVANCE DETERMINATION ====");
    console.log(`Raw irrelevant flag from response.data.irrelevant: ${response.data.irrelevant}`);
    console.log(`Raw irrelevant flag from response.data.metadata.is_irrelevant: ${response.data.metadata?.is_irrelevant}`);
    console.log(`Final isIrrelevant determination: ${isIrrelevant} (forced to false for knowledge base queries)`);
    console.log(`Confidence score: ${confidenceScore}`);
    console.log(`Agent threshold (if available): ${relevanceThreshold}`);
    console.log("=========================================");
    
    // Create enhanced metadata with all the information we have
    const enhancedMetadata = {
      provider: apiKey.provider?.slug || 'openai',
      model: response.data.model || model,
      is_irrelevant: isIrrelevant,
      metadata: response.data.metadata || {}
    };
    
    console.log(`Answer generated with confidence score: ${confidenceScore}, irrelevant: ${isIrrelevant}`);
    
    // Check if the agent ID is provided
    if (agentId) {
      // Detect if the question was unanswered
      await UnansweredQuestionsService.detectUnansweredQuestion(
        query,
        response.data.answer || '',
        confidenceScore,
        context, // The context provided to answer the question
        agentId,
        numericUserId,
        knowledgeBaseId || null,
        conversationId || null,
        messageId || null,
        source,
        enhancedMetadata
      );
      
      try {
        // Check agent confidence threshold if available
        const { storage } = await import('../storage');
        const agent = await storage.getAgent(agentId);
        
        // Log threshold information for debugging
        console.log(`Using agent confidence threshold: ${agent?.confidenceThreshold}`);
        
        if (agent && 
            agent.confidenceThreshold && 
            typeof agent.confidenceThreshold === 'string' && 
            confidenceScore < parseFloat(agent.confidenceThreshold)) {
          
          console.log(`Answer confidence (${confidenceScore}) is below agent threshold (${agent.confidenceThreshold}), using fallback message`);
          
          // Use the fallback message if confidence is below threshold
          if (agent.fallbackMessage) {
            console.log(`Using custom agent fallback message: "${agent.fallbackMessage}"`);
            
            // Create a modified response with fallback message
            const originalResponse = response.data;
            
            // Log the complete response data for debugging
            console.log('LLM response data before fallback message:', JSON.stringify(originalResponse, null, 2));
            
            response.data = {
              ...originalResponse,
              answer: agent.fallbackMessage,
              original_answer: originalResponse.answer, // Store the original answer
              below_threshold: true,
              confidence_score: confidenceScore,
              threshold: parseFloat(agent.confidenceThreshold),
              is_fallback: true
            };
            
            console.log(`Replaced answer with fallback message due to low confidence`);
            
            // Log the updated response data for debugging
            console.log('LLM response after fallback message:', JSON.stringify(response.data, null, 2));
          } else {
            console.log(`No fallback message defined for agent ${agentId}, using original response`);
          }
        } else {
          // Log why we're not using the fallback message
          if (!agent) {
            console.log(`No agent found with ID ${agentId}`);
          } else if (!agent.confidenceThreshold) {
            console.log(`Agent ${agentId} has no confidence threshold defined`);
          } else if (typeof agent.confidenceThreshold !== 'string') {
            console.log(`Agent ${agentId} confidence threshold is not a string: ${typeof agent.confidenceThreshold}`);
          } else if (!(confidenceScore < parseFloat(agent.confidenceThreshold))) {
            console.log(`Answer confidence (${confidenceScore}) is above agent threshold (${agent.confidenceThreshold}), using original response`);
          }
        }
      } catch (error) {
        console.error('Error checking agent confidence threshold:', error);
        // Continue with the original response if checking threshold fails
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error generating answer from context:', error);
    throw error;
  }
}

export async function generateEmbeddings(
  userId: number | string,
  providerId: string | number,
  text: string,
  model?: string
): Promise<number[]> {
  try {
    // ===== ENHANCED USER ID SAFETY CHECKS =====
    let numericUserId: number = 1; // Start with a safe default value
    
    // First check for invalid inputs that we know will cause issues
    if (userId === undefined || userId === null || userId === '' || 
        (typeof userId === 'number' && isNaN(userId))) {
      console.warn(`Invalid userId value detected early in generateEmbeddings: ${userId}, type: ${typeof userId}, using default value 1`);
    } else {
      // Try to safely convert the userId to a number if it's valid
      if (typeof userId === 'string') {
        // Only parse if it looks like a number
        if (/^\d+$/.test(userId)) {
          const parsed = parseInt(userId, 10);
          if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed)) {
            numericUserId = parsed;
          } else {
            console.warn(`Parsed userId string "${userId}" but got invalid result: ${parsed}, using default value 1`);
          }
        } else {
          console.warn(`userId string "${userId}" is not a valid number format, using default value 1`);
        }
      } else if (typeof userId === 'number') {
        // Only use if it's a valid positive number
        if (!isNaN(userId) && userId > 0 && Number.isFinite(userId)) {
          numericUserId = userId;
        } else {
          console.warn(`Invalid userId number: ${userId}, using default value 1`);
        }
      } else {
        console.warn(`userId has unexpected type: ${typeof userId}, using default value 1`);
      }
    }
    
    // Final safety check to ensure we have a valid integer
    numericUserId = Math.floor(numericUserId);
    if (isNaN(numericUserId) || numericUserId <= 0 || !Number.isFinite(numericUserId)) {
      console.warn(`Final safety check caught invalid userId: ${numericUserId}, using default value 1`);
      numericUserId = 1;
    }
    
    // ===== ENHANCED PROVIDER ID SAFETY CHECKS =====
    // Always start with a safe default value
    let numericProviderId: number = 1;
    
    // First check for invalid inputs that we know will cause issues
    if (providerId === undefined || providerId === null || providerId === '' || 
        (typeof providerId === 'number' && isNaN(providerId))) {
      console.log(`Invalid providerId value detected early in generateEmbeddings: ${providerId}, type: ${typeof providerId}, using default ID: 1`);
    } else {
      // Try to safely process the providerId based on its type
      if (typeof providerId === 'string') {
        // Check if it's a known provider slug first
        if (['openai', 'anthropic', 'mistral'].includes(providerId.toLowerCase())) {
          // Direct mapping of known providers
          const providerMap: Record<string, number> = {
            'openai': 1,
            'anthropic': 2,
            'mistral': 3
          };
          numericProviderId = providerMap[providerId.toLowerCase()];
          console.log(`Matched provider slug '${providerId}' to ID: ${numericProviderId}`);
        }
        // If it's not a known slug but looks like a number, try to parse it
        else if (/^\d+$/.test(providerId)) {
          const parsed = parseInt(providerId, 10);
          if (!isNaN(parsed) && parsed > 0 && Number.isFinite(parsed)) {
            numericProviderId = parsed;
            console.log(`Parsed providerId string '${providerId}' to number: ${numericProviderId}`);
          } else {
            console.log(`Parsed providerId string "${providerId}" but got invalid result: ${parsed}, using default ID: 1`);
          }
        }
        // If it's a non-numeric string that's not a known slug, try to look it up
        else {
          console.log(`Looking up unknown provider slug: ${providerId}`);
          try {
            const id = await getProviderIdBySlug(providerId);
            if (id !== null && !isNaN(id) && id > 0 && Number.isFinite(id)) {
              numericProviderId = id;
              console.log(`Successfully resolved provider slug '${providerId}' to ID: ${numericProviderId}`);
            } else {
              console.log(`Could not resolve provider slug '${providerId}' to a valid ID, using default ID: 1`);
            }
          } catch (error) {
            console.error(`Error resolving provider ID for ${providerId}:`, error);
            console.log(`Using default ID: 1 due to error`);
          }
        }
      } else if (typeof providerId === 'number') {
        // Only use the number if it's valid
        if (!isNaN(providerId) && providerId > 0 && Number.isFinite(providerId)) {
          numericProviderId = providerId;
          console.log(`Using numeric provider ID: ${numericProviderId}`);
        } else {
          console.log(`Invalid numeric provider ID: ${providerId}, using default ID: 1`);
        }
      } else {
        console.log(`providerId has unexpected type: ${typeof providerId}, using default ID: 1`);
      }
    }
    
    // Multiple layers of safety checks to guarantee we have a valid integer
    
    // 1. Convert to integer
    numericProviderId = Math.floor(numericProviderId);
    
    // 2. Final safety check for any remaining issues
    if (isNaN(numericProviderId) || numericProviderId <= 0 || !Number.isFinite(numericProviderId)) {
      console.log(`Final safety check caught invalid provider ID: ${numericProviderId}, using default ID: 1`);
      numericProviderId = 1;
    }
    
    // 3. Defensive type assertion to absolutely guarantee a number
    numericProviderId = Number(numericProviderId);
    
    // 4. One last paranoid check
    if (isNaN(numericProviderId) || numericProviderId <= 0) {
      console.log(`CRITICAL: After all checks in generateEmbeddings, provider ID is still invalid. Forcing to 1.`);
      numericProviderId = 1;
    }
    
    // Log the final values being used
    console.log(`Generating embeddings with values - userId: ${numericUserId} (${typeof numericUserId}), providerId: ${numericProviderId} (${typeof numericProviderId})`);
    
    // Get the user's default API key for this provider
    let defaultKey: any = null;
    try {
      defaultKey = await getDefaultUserApiKey(numericUserId, numericProviderId);
      if (!defaultKey) {
        console.warn(`No default API key found for user ${numericUserId} and provider ${numericProviderId}`);
        // Instead of throwing an error, we'll use a fallback method for embeddings
        // This allows document processing to continue without API keys for testing purposes
      }
    } catch (keyError) {
      console.error('Error retrieving default API key:', keyError);
      // We'll continue and use the fallback method below
    }
    
    // Get provider data
    const [provider] = await db.select()
      .from(llmProviders)
      .where(eq(llmProviders.id, numericProviderId));
    
    if (!provider) {
      throw new Error(`Provider with ID ${numericProviderId} not found`);
    }
    
    // If no model specified, use the default embedding model
    if (!model) {
      // Use a default embedding model appropriate for the provider
      if (provider.slug === 'openai') {
        model = 'text-embedding-3-small';
      } else if (provider.slug === 'mistral') {
        model = 'mistral-embed';
      }
    }
    
    // Prepare request headers and data for embedding request
    const headers: any = {};
    let requestData: any = {
      provider_name: provider.slug,
      model,
      text
    };
    
    // If we have a valid API key, include it in the request
    if (defaultKey && defaultKey.key) {
      requestData.api_key = defaultKey.key;
      console.log(`Using API key for provider ${provider.slug}`);
    } else {
      // For testing: Check if we have a system-level API key in environment variables
      // This is a fallback mechanism for development environments
      if (provider.slug === 'openai' && process.env.OPENAI_API_KEY) {
        requestData.api_key = process.env.OPENAI_API_KEY;
        console.log(`Using system-level OpenAI API key from environment`);
      } else if (provider.slug === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        requestData.api_key = process.env.ANTHROPIC_API_KEY;
        console.log(`Using system-level Anthropic API key from environment`);
      } else if (provider.slug === 'mistral' && process.env.MISTRAL_API_KEY) {
        requestData.api_key = process.env.MISTRAL_API_KEY;
        console.log(`Using system-level Mistral API key from environment`);
      } else {
        console.warn(`No API key available for ${provider.slug} embeddings`);
      }
    }
    
    // Send the request to the LLM service with explicit token tracking flags
    const embeddingApiUrl = `${EXTERNAL_API_URL}/api/llm/text-embedding`;
    const response = await axios({
      method: 'post',
      url: embeddingApiUrl,
      headers: headers,
      data: {
        ...requestData
      }
    });
    
    // Update the last_used timestamp for the API key if we have a valid key
    if (defaultKey && defaultKey.id) {
      try {
        await db.update(userApiKeys)
          .set({ lastUsed: new Date() })
          .where(eq(userApiKeys.id, defaultKey.id));
        console.log(`Updated last_used timestamp for API key ${defaultKey.id}`);
      } catch (updateError) {
        console.warn('Failed to update API key timestamp:', updateError);
        // Continue anyway, this is just housekeeping
      }
    }
    
    // Log detailed response for debugging token usage
    console.log(`Embedding API Response Status: ${response.status}`);
    console.log(`Has token_usage field: ${Boolean(response.data.token_usage)}`);
    if (response.data.token_usage) {
      console.log(`token_usage content: ${JSON.stringify(response.data.token_usage)}`);
    }
    
    // Extract token usage data from the response
    let tokenCount = 0;
    let tokenSource = 'not_found';
    
    // Check for various token usage data formats
    if (response.data.token_usage?.total_tokens) {
      tokenCount = response.data.token_usage.total_tokens;
      tokenSource = 'token_usage.total_tokens';
    } else if (response.data.usage?.total_tokens) {
      tokenCount = response.data.usage.total_tokens;
      tokenSource = 'usage.total_tokens';
    } else if (response.data.token_count) {
      tokenCount = response.data.token_count;
      tokenSource = 'token_count';
    } else if (response.data.total_tokens) {
      tokenCount = response.data.total_tokens;
      tokenSource = 'total_tokens';
    }
    
    // Log what we found
    console.log(`📊 EMBEDDING TOKEN COUNT: ${tokenCount} (source: ${tokenSource})`);
    
    // Track token usage if we found any
    if (tokenCount > 0) {
      try {
        // Determine key type (environment vs. user key)
        const keyType = defaultKey?.isEnvironmentDefault ? 'environment' : 'user';
        console.log(`🔍 Using API key type for token tracking: ${keyType}`);
        
        // Get provider information in a more robust way
        let providerName = 'unknown';
        if (provider?.slug) {
          providerName = provider.slug;
          console.log(`Using provider slug from provider object: ${providerName}`);
        } else if (defaultKey?.provider?.slug) {
          providerName = defaultKey.provider.slug;
          console.log(`Using provider slug from API key: ${providerName}`);
        } else if (typeof providerId === 'string' && providerId) {
          // Try to resolve provider by ID
          try {
            const providerInfo = await getLlmProviders();
            const matchedProvider = providerInfo.find(p => p.id.toString() === providerId || p.slug === providerId);
            if (matchedProvider) {
              providerName = matchedProvider.slug;
              console.log(`Resolved provider name from ID ${providerId}: ${providerName}`);
            }
          } catch (providerError) {
            console.error('Error resolving provider by ID:', providerError);
          }
        }
        
        // Add detailed provider debug info
        console.log(`🔍 DEBUG provider info for embedding: ${JSON.stringify({
          providerId,
          providerFromParam: provider?.slug,
          keyProviderId: defaultKey?.providerId,
          keyProviderSlug: defaultKey?.provider?.slug,
          resolvedName: providerName
        })}`);
        
        // Track the token usage with improved provider identification
        await trackLlmTokenUsage(
          numericUserId,
          tokenCount,
          {
            provider: typeof providerName === 'string' ? providerName : String(providerName), 
            model: model || 'unknown',
            keyType: keyType,
            tokenType: 'embedding',
            source: 'embedding'
          }
        );
        
        console.log(`✅ Successfully tracked ${tokenCount} embedding tokens for user ${numericUserId}`);
      } catch (trackingError) {
        console.error(`❌ Error tracking embedding tokens:`, trackingError);
        // Don't throw the error - we don't want to fail the main function if tracking fails
      }
    } else {
      console.warn(`⚠️ No token count found in embedding response. Using fallback estimation.`);
      
      // Estimate tokens based on text length (very rough approximation, ~3 chars per token for English)
      const estimatedTokens = Math.ceil(text.length / 3);
      
      try {
        // Determine key type (environment vs. user key)
        const keyType = defaultKey?.isEnvironmentDefault ? 'environment' : 'user';
        
        // Track the estimated token usage with clear notation that it's estimated
        await trackLlmTokenUsage(
          numericUserId,
          estimatedTokens,
          {
            provider: provider.slug || 'unknown', 
            model: model || 'unknown',
            keyType: keyType,
            tokenType: 'embedding_estimated',
            source: 'embedding_fallback'
          }
        );
        
        console.log(`✅ Tracked estimated ${estimatedTokens} embedding tokens for user ${numericUserId}`);
      } catch (estimationError) {
        console.error(`❌ Error tracking estimated embedding tokens:`, estimationError);
      }
    }
    
    // Validate the embedding data to prevent invalid values from being returned
    const embedding = response.data.embedding;
    
    // If no embedding was returned, generate a simple random embedding as fallback
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.warn('No valid embedding returned from LLM service - this should not happen in production');
      throw new Error('Failed to generate embedding - no valid data returned from LLM service');
    }
    
    // Check for valid dimension - Pinecone index requires 1536 dimensions
    if (embedding.length !== 1536) {
      console.error(`Embedding dimension mismatch. Got ${embedding.length} dimensions, but Pinecone expects 1536 dimensions.`);
      console.warn('Response data:', JSON.stringify(response.data, null, 2));
      throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected 1536 dimensions`);
    }
    
    // Check if any values in the embedding are NaN or Infinity
    const hasInvalidValues = embedding.some(val => 
      isNaN(val) || !isFinite(val) || val === null || val === undefined
    );
    
    if (hasInvalidValues) {
      console.error('Embedding contains invalid values (NaN, Infinity, null, or undefined)');
      throw new Error('Invalid embedding values detected - contains NaN, Infinity, null, or undefined values');
    }
    
    return embedding;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw error;
  }
}

/**
 * Get a chat response from a provider with advanced options
 */
export async function getProviderChatResponse({
  providerId,
  modelId,
  systemPrompt,
  messages,
  temperature = 0.7,
  userId
}: {
  providerId: string | number;
  modelId?: string | number;
  systemPrompt: string;
  messages: Array<{ role: string, content: string }>;
  temperature?: number;
  userId: number;
}): Promise<{ text: string; usage?: { total_tokens: number } }> {
  // Format messages with the system prompt as the first message
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];
  
  // Use the existing chatCompletion function
  return await chatCompletion(
    userId,
    providerId,
    formattedMessages,
    modelId ? String(modelId) : undefined,
    temperature
  );
}

