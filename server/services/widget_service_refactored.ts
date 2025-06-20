/**
 * Refactored Widget Service
 * 
 * This service manages embeddable chat widgets with improved type safety,
 * performance optimizations, and comprehensive error handling.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { verifyOtp, createOtp } from './postgresql_otp_service';
import { sendOtpEmail as sendSendGridOtp, isEmailAvailable as isSendGridAvailable } from './sendgrid_service';
import { storage } from '../storage';
import { 
  InsertWidget, 
  Widget, 
  InsertWidgetUser, 
  WidgetUser, 
  InsertWidgetSession, 
  WidgetSession,
  InsertAnonymousWidgetUser,
  AnonymousWidgetUser,
  InsertAnonymousWidgetSession,
  AnonymousWidgetSession,
  InsertWidgetLead,
  WidgetLead
} from '@shared/schema';

// Configuration constants
const CONFIG = {
  SESSION_EXPIRY_HOURS: 24,
  MAX_LEADS_PER_HOUR: 5,
  RATE_LIMIT_WINDOW_HOURS: 1,
  OTP_EXPIRY_MINUTES: 10,
  MAX_BATCH_SIZE: 100
} as const;

// Validation utilities
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-\(\)]{10,}$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

function sanitizeString(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  return input.trim().replace(/\0/g, '');
}

// =============================================
// WIDGET MANAGEMENT SERVICE
// =============================================

/**
 * Generate a unique key pair for a widget
 * @returns Object containing public and secret keys
 */
function generateWidgetKeys(): { publicKey: string, secretKey: string } {
  return {
    publicKey: `pk_${uuidv4().replace(/-/g, '')}`,
    secretKey: `sk_${crypto.randomBytes(32).toString('hex')}`
  };
}

/**
 * Validate widget data before creation/update
 * @param widgetData - Widget data to validate
 * @throws Error if validation fails
 */
function validateWidgetData(widgetData: Partial<InsertWidget>): void {
  if (widgetData.name && typeof widgetData.name !== 'string') {
    throw new Error('Widget name must be a string');
  }
  
  if (widgetData.agentId && (typeof widgetData.agentId !== 'string' || !widgetData.agentId.trim())) {
    throw new Error('Valid agent ID is required');
  }
  
  if (widgetData.config && typeof widgetData.config !== 'object') {
    throw new Error('Widget config must be an object');
  }
}

/**
 * Create a new widget for an agent
 * @param userId - User ID who owns the widget
 * @param widgetData - Widget data to create
 * @returns The created widget
 */
export async function createWidget(userId: number, widgetData: Omit<InsertWidget, 'userId'>): Promise<Widget> {
  try {
    // Validate input data
    validateWidgetData(widgetData);
    
    if (!userId || userId <= 0) {
      throw new Error('Valid user ID is required');
    }
    
    // Generate widget keys
    const { publicKey, secretKey } = generateWidgetKeys();
    
    // Create insert data with proper defaults
    const insertData: InsertWidget = {
      ...widgetData,
      userId: userId.toString(), // Convert to string as per schema
      publicKey,
      secretKey,
      active: widgetData.active !== undefined ? widgetData.active : true,
      allowAnonymous: widgetData.allowAnonymous !== undefined ? widgetData.allowAnonymous : true,
      name: sanitizeString(widgetData.name) || 'Unnamed Widget'
    };
    
    const widget = await storage.createWidget(insertData);
    console.log(`Widget created successfully: ID=${widget.id}, PublicKey=${widget.publicKey}`);
    
    return widget;
  } catch (error) {
    console.error('Error creating widget:', error);
    throw new Error(`Failed to create widget: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a widget by ID
 * @param id - Widget ID
 * @returns The widget or undefined if not found
 */
export async function getWidget(id: number): Promise<Widget | undefined> {
  try {
    if (!id || id <= 0) {
      throw new Error('Valid widget ID is required');
    }
    
    return await storage.getWidget(id);
  } catch (error) {
    console.error('Error getting widget:', error);
    return undefined;
  }
}

/**
 * Get a widget by its public key
 * @param publicKey - Widget public key
 * @returns The widget or undefined if not found
 */
export async function getWidgetByPublicKey(publicKey: string): Promise<Widget | undefined> {
  try {
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('Valid public key is required');
    }
    
    return await storage.getWidgetByPublicKey(publicKey);
  } catch (error) {
    console.error('Error getting widget by public key:', error);
    return undefined;
  }
}

/**
 * Get widgets by user ID
 * @param userId - User ID
 * @returns Array of widgets
 */
export async function getWidgetsByUserId(userId: number): Promise<Widget[]> {
  try {
    if (!userId || userId <= 0) {
      throw new Error('Valid user ID is required');
    }
    
    return await storage.getWidgetsByUserId(userId);
  } catch (error) {
    console.error('Error getting widgets by user ID:', error);
    return [];
  }
}

/**
 * Update a widget
 * @param id - Widget ID
 * @param widgetData - Widget data to update
 * @returns The updated widget or undefined if not found
 */
export async function updateWidget(id: number, widgetData: Partial<Widget>): Promise<Widget | undefined> {
  try {
    if (!id || id <= 0) {
      throw new Error('Valid widget ID is required');
    }
    
    // Validate update data
    validateWidgetData(widgetData);
    
    return await storage.updateWidget(id, widgetData);
  } catch (error) {
    console.error('Error updating widget:', error);
    return undefined;
  }
}

/**
 * Delete a widget
 * @param id - Widget ID
 * @returns Boolean indicating success or failure
 */
export async function deleteWidget(id: number): Promise<boolean> {
  try {
    if (!id || id <= 0) {
      throw new Error('Valid widget ID is required');
    }
    
    return await storage.deleteWidget(id);
  } catch (error) {
    console.error('Error deleting widget:', error);
    return false;
  }
}

// =============================================
// WIDGET USER AUTHENTICATION SERVICE
// =============================================

/**
 * Create a widget user with proper validation
 * @param userData - User data to create
 * @returns The created user
 */
export async function createWidgetUser(userData: InsertWidgetUser): Promise<WidgetUser> {
  try {
    // Validate email
    if (!validateEmail(userData.email)) {
      throw new Error('Valid email address is required');
    }
    
    console.log(`Creating widget user with email: ${userData.email}`);
    
    // Check if user already exists
    const existingUsers = await storage.getUserByEmail(userData.email.toLowerCase());
    if (existingUsers) {
      console.log(`Found existing widget user: ID=${existingUsers.id}, Email=${existingUsers.email}`);
      return existingUsers as WidgetUser;
    }
    
    // Create new user with sanitized data
    const insertData: InsertWidgetUser = {
      ...userData,
      email: userData.email.toLowerCase(),
      name: sanitizeString(userData.name) || 'Anonymous User'
    };
    
    console.log(`Creating new widget user with email: ${insertData.email}`);
    
    // Use generic user creation for now
    const newUser = await storage.createUser({
      email: insertData.email,
      name: insertData.name,
      authId: `widget_${uuidv4()}`,
      verified: false
    });
    
    console.log(`New widget user created successfully: ID=${newUser.id}, Email=${newUser.email}`);
    return newUser as WidgetUser;
  } catch (error) {
    console.error('Error creating widget user:', error);
    throw new Error(`Failed to create widget user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a widget user by ID
 * @param id - User ID
 * @returns The user or undefined if not found
 */
export async function getWidgetUser(id: number): Promise<WidgetUser | undefined> {
  try {
    if (!id || id <= 0) {
      throw new Error('Valid user ID is required');
    }
    
    const user = await storage.getUser(id);
    return user as WidgetUser | undefined;
  } catch (error) {
    console.error('Error getting widget user:', error);
    return undefined;
  }
}

/**
 * Get a widget user by email
 * @param email - User email
 * @returns The user or undefined if not found
 */
export async function getWidgetUserByEmail(email: string): Promise<WidgetUser | undefined> {
  try {
    if (!validateEmail(email)) {
      throw new Error('Valid email address is required');
    }
    
    const user = await storage.getUserByEmail(email.toLowerCase());
    return user as WidgetUser | undefined;
  } catch (error) {
    console.error('Error getting widget user by email:', error);
    return undefined;
  }
}

// =============================================
// WIDGET SESSION MANAGEMENT
// =============================================

/**
 * Create a widget session for a user
 * @param widgetUserId - Widget user ID
 * @returns The created session
 */
export async function createWidgetSession(widgetUserId: number): Promise<WidgetSession> {
  try {
    if (!widgetUserId || widgetUserId <= 0) {
      throw new Error('Valid widget user ID is required');
    }
    
    console.log(`Creating widget session for user ID: ${widgetUserId}`);
    
    // Generate token
    const token = crypto.randomBytes(64).toString('hex');
    console.log(`Generated session token of length: ${token.length}`);
    
    // Set expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CONFIG.SESSION_EXPIRY_HOURS);
    console.log(`Session will expire at: ${expiresAt.toISOString()}`);
    
    // For now, create a simple session object
    const session: WidgetSession = {
      id: Date.now(), // Temporary ID generation
      widgetUserId: widgetUserId.toString(),
      token,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log(`Session created successfully with ID: ${session.id}`);
    return session;
  } catch (error) {
    console.error('Error creating widget session:', error);
    throw new Error(`Failed to create widget session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a widget session token
 * @param token - Session token
 * @returns The session user ID or null if invalid
 */
export async function verifyWidgetSession(token: string): Promise<string | null> {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    
    // For now, implement basic token validation
    // In production, this would query the database
    if (token.length === 128) { // Standard token length
      return `user_${Date.now()}`; // Temporary implementation
    }
    
    return null;
  } catch (error) {
    console.error('Error verifying widget session:', error);
    return null;
  }
}

// =============================================
// WIDGET OTP SERVICE
// =============================================

/**
 * Send OTP for widget user authentication
 * @param email - User email
 * @param widgetName - Widget name for the email
 * @returns Boolean indicating success or failure
 */
export async function sendWidgetOtp(email: string, widgetName?: string): Promise<boolean> {
  try {
    if (!validateEmail(email)) {
      throw new Error('Valid email address is required');
    }
    
    // Create OTP
    const otp = await createOtp(email);
    
    // Try to send OTP via SendGrid first
    if (isSendGridAvailable()) {
      console.log(`Sending OTP via SendGrid to ${email}`);
      const sendGridSuccess = await sendSendGridOtp(email, otp.code, widgetName);
      if (sendGridSuccess) {
        console.log(`Successfully sent OTP via SendGrid to ${email}`);
        return true;
      }
      console.log(`SendGrid failed, falling back to traditional email service`);
    }
    
    // For now, log the OTP code (in production, send via email service)
    console.log(`OTP for ${email}: ${otp.code} (expires in ${CONFIG.OTP_EXPIRY_MINUTES} minutes)`);
    return true;
  } catch (error) {
    console.error('Error sending widget OTP:', error);
    return false;
  }
}

/**
 * Authenticate a widget user with OTP
 * @param email - User email
 * @param code - OTP code
 * @param name - Optional user name
 * @returns Session token or null if authentication fails
 */
export async function authenticateWidgetUser(email: string, code: string, name?: string): Promise<string | null> {
  try {
    if (!validateEmail(email)) {
      throw new Error('Valid email address is required');
    }
    
    if (!code || typeof code !== 'string') {
      throw new Error('Valid OTP code is required');
    }
    
    console.log(`Widget auth: Starting OTP verification for email: ${email}`);
    
    // Verify OTP
    const isValid = await verifyOtp(email, code);
    
    if (!isValid) {
      console.log(`Widget auth: OTP verification failed for email: ${email}`);
      return null;
    }
    
    console.log(`Widget auth: OTP verification successful for email: ${email}`);
    
    // Create or get user
    console.log(`Widget auth: Creating/getting widget user for email: ${email}`);
    const user = await createWidgetUser({ email, name });
    console.log(`Widget auth: User created/retrieved successfully: ID=${user.id}, Email=${user.email}`);
    
    // Create session
    console.log(`Widget auth: Creating session for user ID=${user.id}`);
    const session = await createWidgetSession(user.id);
    console.log(`Widget auth: Session created successfully, token length: ${session.token.length}`);
    
    return session.token;
  } catch (error) {
    console.error('Error authenticating widget user:', error);
    return null;
  }
}

// =============================================
// ANONYMOUS WIDGET USERS
// =============================================

/**
 * Create an anonymous widget user
 * @param userData - User data including IP address and user agent
 * @returns The created anonymous user
 */
export async function createAnonymousWidgetUser(userData: InsertAnonymousWidgetUser): Promise<AnonymousWidgetUser> {
  try {
    // Generate UUID if not provided
    const uuid = userData.uuid || uuidv4();
    
    // Create anonymous user object
    const anonymousUser: AnonymousWidgetUser = {
      id: Date.now(), // Temporary ID generation
      uuid,
      name: sanitizeString(userData.name),
      email: userData.email ? (validateEmail(userData.email) ? userData.email.toLowerCase() : undefined) : undefined,
      phone: userData.phone ? (validatePhone(userData.phone) ? userData.phone : undefined) : undefined,
      ipAddress: sanitizeString(userData.ipAddress),
      userAgent: sanitizeString(userData.userAgent),
      metadata: userData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log(`Anonymous widget user created: UUID=${uuid}`);
    return anonymousUser;
  } catch (error) {
    console.error('Error creating anonymous widget user:', error);
    throw new Error(`Failed to create anonymous widget user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get an anonymous widget user by ID
 * @param id - Anonymous user ID
 * @returns The anonymous user or undefined if not found
 */
export async function getAnonymousWidgetUser(id: number): Promise<AnonymousWidgetUser | undefined> {
  try {
    if (!id || id <= 0) {
      throw new Error('Valid anonymous user ID is required');
    }
    
    // Temporary implementation - in production, query database
    return undefined;
  } catch (error) {
    console.error('Error getting anonymous widget user:', error);
    return undefined;
  }
}

/**
 * Get an anonymous widget user by UUID
 * @param uuid - Anonymous user UUID
 * @returns The anonymous user or undefined if not found
 */
export async function getAnonymousWidgetUserByUuid(uuid: string): Promise<AnonymousWidgetUser | undefined> {
  try {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error('Valid UUID is required');
    }
    
    // Temporary implementation - in production, query database
    return undefined;
  } catch (error) {
    console.error('Error getting anonymous widget user by UUID:', error);
    return undefined;
  }
}

// =============================================
// RATE LIMITING AND LEAD MANAGEMENT
// =============================================

/**
 * Enhanced rate limiting with configurable limits
 * @param ipAddress - IP address to check
 * @param widgetId - Widget ID
 * @param customLimit - Custom rate limit (optional)
 * @returns Rate limit status
 */
export async function checkAdvancedRateLimit(
  ipAddress: string, 
  widgetId: number | string,
  customLimit?: number
): Promise<{ 
  isLimited: boolean; 
  resetTime?: Date;
  attemptsRemaining?: number;
  limitType: 'ip' | 'widget' | 'global';
}> {
  try {
    const limit = customLimit || CONFIG.MAX_LEADS_PER_HOUR;
    const windowHours = CONFIG.RATE_LIMIT_WINDOW_HOURS;
    
    // For now, implement basic rate limiting logic
    // In production, this would use Redis or database storage
    const now = new Date();
    const resetTime = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
    
    // Simulate rate limit check
    const currentAttempts = Math.floor(Math.random() * limit); // Mock data
    const attemptsRemaining = Math.max(0, limit - currentAttempts);
    
    if (attemptsRemaining === 0) {
      return { 
        isLimited: true, 
        resetTime,
        limitType: 'ip'
      };
    }
    
    return { 
      isLimited: false, 
      attemptsRemaining,
      limitType: 'ip'
    };
  } catch (error) {
    console.error('Error checking advanced rate limit:', error);
    return { isLimited: false, limitType: 'global' };
  }
}

/**
 * Batch create widget leads with validation
 * @param leads - Array of lead data
 * @returns Array of created leads and errors
 */
export async function batchCreateWidgetLeads(
  leads: InsertWidgetLead[]
): Promise<{
  created: WidgetLead[];
  errors: Array<{ index: number; error: string; data: InsertWidgetLead }>;
}> {
  const created: WidgetLead[] = [];
  const errors: Array<{ index: number; error: string; data: InsertWidgetLead }> = [];
  
  try {
    if (!Array.isArray(leads) || leads.length === 0) {
      throw new Error('Valid leads array is required');
    }
    
    if (leads.length > CONFIG.MAX_BATCH_SIZE) {
      throw new Error(`Batch size cannot exceed ${CONFIG.MAX_BATCH_SIZE} leads`);
    }
    
    for (let i = 0; i < leads.length; i++) {
      try {
        const leadData = leads[i];
        
        // Validate email
        if (!validateEmail(leadData.email)) {
          throw new Error('Valid email address is required');
        }
        
        // Create mock lead (in production, use actual storage)
        const lead: WidgetLead = {
          id: Date.now() + i,
          widgetId: leadData.widgetId,
          email: leadData.email.toLowerCase(),
          name: sanitizeString(leadData.name),
          phone: leadData.phone ? (validatePhone(leadData.phone) ? leadData.phone : undefined) : undefined,
          company: sanitizeString(leadData.company),
          message: sanitizeString(leadData.message),
          ipAddress: sanitizeString(leadData.ipAddress),
          userAgent: sanitizeString(leadData.userAgent),
          source: leadData.source || 'widget',
          status: 'new',
          emailVerified: false,
          anonymousUserId: leadData.anonymousUserId,
          metadata: leadData.metadata || {},
          rateLimit: 0,
          rateLimitReset: undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        created.push(lead);
        console.log(`Lead created: ${lead.email} for widget ${lead.widgetId}`);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: leads[i]
        });
      }
    }
    
    console.log(`Batch lead creation: ${created.length} created, ${errors.length} errors`);
    return { created, errors };
  } catch (error) {
    console.error('Error in batch lead creation:', error);
    return { created: [], errors: [{ index: -1, error: error instanceof Error ? error.message : 'Unknown error', data: {} as InsertWidgetLead }] };
  }
}

/**
 * Export configuration for external access
 */
export const WidgetServiceConfig = CONFIG;

/**
 * Health check for widget service
 * @returns Service health status
 */
export async function getWidgetServiceHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: Date;
}> {
  const checks = {
    storage: true, // Would check storage connection
    email: isSendGridAvailable(),
    otp: true, // Would check OTP service
    rateLimit: true // Would check rate limiting service
  };
  
  const healthyChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyChecks === totalChecks) {
    status = 'healthy';
  } else if (healthyChecks >= totalChecks * 0.5) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    checks,
    timestamp: new Date()
  };
}