/**
 * Token Manager
 * Handles secure storage and management of authentication tokens
 */

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_STORAGE_KEY = 'auth_tokens';
const LEGACY_TOKEN_KEY = 'auth_token'; // Legacy token storage for backward compatibility
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

export class TokenManager {
  private static instance: TokenManager;
  private tokens: TokenData | null = null;

  private constructor() {
    this.loadTokens();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokens(): void {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        this.tokens = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
      this.clearTokens();
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokens(): void {
    try {
      if (this.tokens) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(this.tokens));
        // Also update legacy auth_token for backward compatibility
        localStorage.setItem(LEGACY_TOKEN_KEY, this.tokens.accessToken);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to save tokens to storage:', error);
    }
  }

  /**
   * Set new tokens
   */
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.tokens = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000) // Convert seconds to milliseconds
    };
    this.saveTokens();
  }

  /**
   * Get current access token if valid
   */
  getAccessToken(): string | null {
    if (!this.tokens) {
      return null;
    }

    // Check if token is expired or will expire soon
    if (this.isTokenExpired()) {
      return null;
    }

    return this.tokens.accessToken;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.tokens?.refreshToken || null;
  }

  /**
   * Check if current token is expired or will expire soon
   */
  isTokenExpired(): boolean {
    if (!this.tokens) {
      return true;
    }

    return Date.now() >= (this.tokens.expiresAt - TOKEN_REFRESH_BUFFER);
  }

  /**
   * Check if refresh token exists
   */
  hasRefreshToken(): boolean {
    return !!this.tokens?.refreshToken;
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.tokens = null;
    this.saveTokens();
    // Additional cleanup to ensure legacy token is removed
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  /**
   * Update access token after refresh
   */
  updateAccessToken(accessToken: string, expiresIn: number): void {
    if (this.tokens) {
      this.tokens.accessToken = accessToken;
      this.tokens.expiresAt = Date.now() + (expiresIn * 1000);
      this.saveTokens();
      // Also update legacy token storage immediately
      localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
    }
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    if (!this.tokens) {
      return 0;
    }

    return Math.max(0, this.tokens.expiresAt - Date.now());
  }
}

export const tokenManager = TokenManager.getInstance();