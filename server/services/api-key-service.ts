import { randomBytes, createHash } from 'crypto';
import { IStorage } from '../storage';
import { ApiKey, InsertApiKey } from '@shared/schema';

export interface CreateApiKeyParams {
  userId: number;
  name: string;
  scopes: string[];
  teamId?: number | null;
  rateLimit?: number | null;
  expiresAt?: Date | null;
}

interface ApiKeyCreationResult {
  apiKey: ApiKey;
  keyValue: string;
}

/**
 * Service for managing API keys
 */
export class ApiKeyService {
  private readonly storage: IStorage;
  private readonly KEY_PREFIX_LENGTH = 8;
  private readonly KEY_VALUE_LENGTH = 32;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Create a new API key
   * @param params API key creation parameters
   * @returns The created API key and its full key value
   */
  async createApiKey(params: CreateApiKeyParams): Promise<ApiKeyCreationResult> {
    // Generate a secure random key
    const fullKeyBuffer = randomBytes(this.KEY_VALUE_LENGTH);
    const fullKey = fullKeyBuffer.toString('hex');
    
    // Split into prefix (shown to user) and the rest (secret)
    const keyPrefix = fullKey.substring(0, this.KEY_PREFIX_LENGTH);
    const secretPart = fullKey.substring(this.KEY_PREFIX_LENGTH);
    
    // Hash the secret part for storage
    const keyHash = this.hashKey(secretPart);
    
    // Full API key format = prefix + '.' + secret
    const apiKeyValue = `${keyPrefix}.${secretPart}`;
    
    // Create API key in database - use raw object since keyPrefix/keyHash are excluded from InsertApiKey
    const apiKey = await this.storage.createApiKey({
      userId: params.userId,
      name: params.name,
      teamId: params.teamId || null,
      keyPrefix,
      keyHash,
      scopes: params.scopes,
      rateLimit: params.rateLimit || 100, // Default to 100 requests per minute
      expiresAt: params.expiresAt || null,
      revoked: false
    } as any);
    
    return {
      apiKey,
      keyValue: apiKeyValue
    };
  }

  /**
   * Get API keys for a user
   * @param userId User ID
   * @returns List of API keys
   */
  async getUserApiKeys(userId: number): Promise<ApiKey[]> {
    return this.storage.getApiKeysByUserId(userId);
  }

  /**
   * Revoke (soft delete) an API key
   * @param keyId Key ID
   * @param userId User ID (for ownership verification)
   * @returns Success or failure
   */
  async revokeApiKey(keyId: number, userId: number): Promise<boolean> {
    const apiKey = await this.storage.getApiKey(keyId);
    
    if (!apiKey || apiKey.userId !== userId) {
      return false;
    }
    
    return this.storage.updateApiKey(keyId, { 
      revoked: true,
      updatedAt: new Date()
    });
  }

  /**
   * Verify an API key value against stored keys
   * @param apiKeyValue The full API key value (prefix.secret)
   * @returns The API key if valid, null otherwise
   */
  async verifyApiKey(apiKeyValue: string): Promise<ApiKey | null> {
    if (!apiKeyValue || typeof apiKeyValue !== 'string') {
      return null;
    }
    
    // Split the API key into prefix and secret parts
    const parts = apiKeyValue.split('.');
    if (parts.length !== 2) {
      return null;
    }
    
    const [keyPrefix, secretPart] = parts;
    
    // Get API key by prefix
    const apiKey = await this.storage.getApiKeyByPrefix(keyPrefix);
    if (!apiKey) {
      return null;
    }
    
    // Check if revoked
    if (apiKey.revoked) {
      return null;
    }
    
    // Check if expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return null;
    }
    
    // Hash the provided secret and compare with stored hash
    const providedKeyHash = this.hashKey(secretPart);
    if (providedKeyHash !== apiKey.keyHash) {
      return null;
    }
    
    // Update last used timestamp
    await this.storage.updateApiKeyLastUsed(apiKey.id, new Date());
    
    return apiKey;
  }

  /**
   * Hash the secret part of an API key
   * @param key The key to hash
   * @returns The hashed key
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}