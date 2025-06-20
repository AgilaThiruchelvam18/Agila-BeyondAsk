import crypto from 'crypto';

// The encryption key should be stored in environment variables
// Ideally, this would be managed by a secrets manager in production
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ENCRYPTION_IV_LENGTH = 16; // For AES, this is always 16
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a string using AES-256-CBC
 * @param text - The text to encrypt
 * @returns The encrypted text as a base64 string with IV prepended
 */
export function encrypt(text: string): string {
  // Create a random initialization vector
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  
  // Create a cipher using the encryption key and iv
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), // Ensure key is 32 bytes for AES-256
    iv
  );
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Prepend the IV to the encrypted text (IV is needed for decryption)
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a string that was encrypted using the encrypt function
 * @param encryptedText - The encrypted text with IV prepended
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  // Split the IV and encrypted text
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedData = textParts[1];
  
  // Create a decipher using the encryption key and iv
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), // Ensure key is 32 bytes for AES-256
    iv
  );
  
  // Decrypt the text
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a hash of a string using SHA-256
 * @param text - The text to hash
 * @returns The hashed text as a hex string
 */
export function createHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Mask an API key for display
 * Only shows the first 4 and last 4 characters, masking everything in between
 * @param apiKey - The API key to mask
 * @returns The masked API key
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '********'; // If the key is too short, mask the entire thing
  }
  
  const firstFour = apiKey.substring(0, 4);
  const lastFour = apiKey.substring(apiKey.length - 4);
  const maskLength = apiKey.length - 8;
  const mask = '*'.repeat(maskLength);
  
  return firstFour + mask + lastFour;
}

/**
 * Generate a secure random token for API keys or other sensitive data
 * @param length - The length of the token to generate (default: 32)
 * @returns A secure random token as a hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a time-limited hash-based message authentication code (HMAC)
 * Useful for creating time-limited tokens
 * @param data - The data to sign
 * @param validityInMinutes - The validity period in minutes
 * @returns Object containing the token and expiry date
 */
export function createTimeLimitedToken(data: string, validityInMinutes: number = 60): { token: string, expiresAt: Date } {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + validityInMinutes);
  
  // Create a string that includes the data and expiry time
  const tokenData = `${data}|${expiresAt.getTime()}`;
  
  // Create HMAC from the token data
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY)
    .update(tokenData)
    .digest('hex');
  
  // Final token is the tokenData + HMAC
  const token = Buffer.from(`${tokenData}|${hmac}`).toString('base64');
  
  return { token, expiresAt };
}

/**
 * Verify a time-limited token created by createTimeLimitedToken
 * @param token - The token to verify
 * @returns The original data if valid, null if invalid or expired
 */
export function verifyTimeLimitedToken(token: string): string | null {
  try {
    // Decode the token
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split('|');
    
    if (parts.length !== 3) {
      return null; // Invalid token format
    }
    
    const data = parts[0];
    const expiryTime = parseInt(parts[1]);
    const providedHmac = parts[2];
    
    // Check if token has expired
    if (expiryTime < Date.now()) {
      return null; // Token expired
    }
    
    // Recreate the HMAC to verify integrity
    const expectedData = `${data}|${expiryTime}`;
    const expectedHmac = crypto.createHmac('sha256', ENCRYPTION_KEY)
      .update(expectedData)
      .digest('hex');
    
    // Verify the HMAC
    if (providedHmac !== expectedHmac) {
      return null; // Token has been tampered with
    }
    
    return data;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}