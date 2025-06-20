import { ApiKey, InsertApiKey } from '@shared/schema';

/**
 * Interface for API key storage functionality
 */
export interface ApiKeyStorageInterface {
  // API key operations
  getApiKey(id: number): Promise<ApiKey | undefined>;
  getApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | undefined>;
  getApiKeysByUserId(userId: number): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: number, data: Partial<ApiKey>): Promise<boolean>;
  updateApiKeyLastUsed(id: number, lastUsedAt: Date): Promise<boolean>;
  revokeApiKey(id: number): Promise<boolean>;
}