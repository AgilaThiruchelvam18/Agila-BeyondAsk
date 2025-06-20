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
      userId,
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
    // Use the storage interface instead of direct MongoDB access
    // Import the storage interface
    const { storage } = await import('../storage');
    
    // Find the widget
    const widget = await storage.getWidget(id);
    
    return widget;
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
    // Use the storage interface instead of direct MongoDB access
    // Import the storage interface
    const { storage } = await import('../storage');
    
    // Find the widget
    const widget = await storage.getWidgetByPublicKey(publicKey);
    
    return widget;
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
    // Use the storage interface
    const widgets = await storage.getWidgetsByUserId(userId);
    return widgets;
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
    // Use the storage interface
    const updatedWidget = await storage.updateWidget(id, widgetData);
    return updatedWidget;
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
    // Use the storage interface
    return await storage.deleteWidget(id);
  } catch (error) {
    console.error('Error deleting widget:', error);
    return false;
  }
}

/**
 * Create a widget user
 * @param userData - User data to create
 * @returns The created user
 */
export async function createWidgetUser(userData: InsertWidgetUser): Promise<WidgetUser> {
  try {
    console.log(`Creating widget user with data:`, { email: userData.email, name: userData.name });
    
    // Use the storage interface
    // First check if the user already exists by email
    const existingUser = await storage.getWidgetUserByEmail(userData.email.toLowerCase());
    
    if (existingUser) {
      console.log(`Found existing widget user: ID=${existingUser.id}, Email=${existingUser.email}`);
      
      // Update the existing user if needed
      if (userData.name && userData.name !== existingUser.name) {
        console.log(`Updating existing user name from '${existingUser.name}' to '${userData.name}'`);
        const updatedUser = await storage.updateWidgetUser(existingUser.id, { name: userData.name });
        console.log(`User updated successfully: ID=${updatedUser?.id}`);
        return updatedUser || existingUser;
      }
      return existingUser;
    }
    
    // Create new user with lowercase email
    const insertData: InsertWidgetUser = {
      ...userData,
      email: userData.email.toLowerCase()
    };
    
    console.log(`No existing user found. Creating new widget user with email: ${insertData.email}`);
    
    // Create the user using the storage interface
    const newUser = await storage.createWidgetUser(insertData);
    console.log(`New widget user created successfully: ID=${newUser.id}, Email=${newUser.email}`);
    
    return newUser;
  } catch (error) {
    console.error('Error creating widget user:', error);
    throw error;
  }
}

/**
 * Get a widget user by ID
 * @param id - User ID
 * @returns The user or undefined if not found
 */
export async function getWidgetUser(id: string): Promise<WidgetUser | undefined> {
  try {
    // Use the storage interface
    return await storage.getWidgetUser(id);
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
    // Use the storage interface
    return await storage.getWidgetUserByEmail(email.toLowerCase());
  } catch (error) {
    console.error('Error getting widget user by email:', error);
    return undefined;
  }
}

/**
 * Create a widget session for a user
 * @param widgetUserId - Widget user ID
 * @returns The created session
 */
export async function createWidgetSession(widgetUserId: string): Promise<WidgetSession> {
  try {
    console.log(`Creating widget session for user ID: ${widgetUserId}`);
    
    // Generate token
    const token = crypto.randomBytes(64).toString('hex');
    console.log(`Generated session token of length: ${token.length}`);
    
    // Set expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);
    console.log(`Session will expire at: ${expiresAt.toISOString()}`);
    
    // Create insert data
    const insertData: InsertWidgetSession = {
      widgetUserId,
      token,
      expiresAt
    };
    
    // Create the session using the storage interface
    console.log(`Calling storage.createWidgetSession with data:`, { widgetUserId, tokenLength: token.length, expiresAt });
    const session = await storage.createWidgetSession(insertData);
    console.log(`Session created successfully with ID: ${session.id}`);
    
    // Update last login time for user
    console.log(`Updating lastLoginAt for user ID: ${widgetUserId}`);
    const updatedUser = await storage.updateWidgetUser(widgetUserId, { lastLoginAt: new Date() });
    console.log(`User ${widgetUserId} last login time updated successfully: ${updatedUser?.lastLoginAt}`);
    
    return session;
  } catch (error) {
    console.error('Error creating widget session:', error);
    throw error;
  }
}

/**
 * Verify a widget session token
 * @param token - Session token
 * @returns The session user ID or null if invalid
 */
export async function verifyWidgetSession(token: string): Promise<string | null> {
  try {
    // Use the storage interface to get the session
    const session = await storage.getWidgetSessionByToken(token);
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    const now = new Date();
    if (session.expiresAt < now) {
      return null;
    }
    
    // Return the user ID
    return session.widgetUserId;
  } catch (error) {
    console.error('Error verifying widget session:', error);
    return null;
  }
}

/**
 * Generate and send OTP for widget user authentication
 * @param email - User email
 * @param widgetName - Widget name for the email
 * @returns Boolean indicating success or failure
 */
export async function sendWidgetOtp(email: string, widgetName?: string): Promise<boolean> {
  try {
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
      // If SendGrid fails, log the failure but continue to try the traditional email service
      console.log(`SendGrid failed, falling back to traditional email service`);
    }
    
    // Fall back to traditional email service
    const emailSent = await sendEmailOtp(email, otp.code, widgetName);
    
    return emailSent;
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
    
    // Mark user as verified
    console.log(`Widget auth: Marking user as verified, ID=${user.id}`);
    const updatedUser = await storage.updateWidgetUser(user.id, { verified: true });
    console.log(`Widget auth: User ${user.id} updated, verified status: ${updatedUser?.verified}`);
    
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

/**
 * Create an anonymous widget user
 * @param userData - User data including IP address and user agent
 * @returns The created anonymous user
 */
export async function createAnonymousWidgetUser(userData: InsertAnonymousWidgetUser): Promise<AnonymousWidgetUser> {
  try {
    // Generate UUID if not provided
    if (!userData.uuid) {
      userData.uuid = uuidv4();
    }
    
    // Check if user already exists with the given UUID
    if (userData.uuid) {
      const existingUser = await storage.getAnonymousWidgetUserByUuid(userData.uuid);
      
      if (existingUser) {
        // Update the existing user with any new information
        const updateData: Partial<AnonymousWidgetUser> = {};
        
        if (userData.name && userData.name !== existingUser.name) updateData.name = userData.name;
        if (userData.email && userData.email !== existingUser.email) updateData.email = userData.email;
        if (userData.phone && userData.phone !== existingUser.phone) updateData.phone = userData.phone;
        if (userData.ipAddress && userData.ipAddress !== existingUser.ipAddress) updateData.ipAddress = userData.ipAddress;
        if (userData.userAgent && userData.userAgent !== existingUser.userAgent) updateData.userAgent = userData.userAgent;
        
        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          const updatedUser = await storage.updateAnonymousWidgetUser(existingUser.id, updateData);
          return updatedUser || existingUser;
        }
        
        return existingUser;
      }
    }
    
    // Create user with the storage interface
    return await storage.createAnonymousWidgetUser({
      ...userData,
      metadata: userData.metadata || {}
    });
  } catch (error) {
    console.error('Error creating anonymous widget user:', error);
    throw error;
  }
}

/**
 * Get an anonymous widget user by ID
 * @param id - Anonymous user ID
 * @returns The anonymous user or undefined if not found
 */
export async function getAnonymousWidgetUser(id: number): Promise<AnonymousWidgetUser | undefined> {
  try {
    // Use the storage interface
    return await storage.getAnonymousWidgetUser(id);
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
    // Use the storage interface
    return await storage.getAnonymousWidgetUserByUuid(uuid);
  } catch (error) {
    console.error('Error getting anonymous widget user by UUID:', error);
    return undefined;
  }
}

/**
 * Create an anonymous widget session
 * @param anonymousUserId - Anonymous user ID
 * @param widgetId - Widget ID
 * @param uuid - UUID for the session (same as user UUID)
 * @returns The created anonymous session
 */
export async function createAnonymousWidgetSession(
  anonymousUserId: number, 
  widgetId: number, 
  uuid: string
): Promise<AnonymousWidgetSession> {
  try {
    // Generate token
    const token = crypto.randomBytes(64).toString('hex');
    
    // Create insert data
    const insertData: InsertAnonymousWidgetSession = {
      anonymousUserId,
      widgetId: widgetId.toString(), // Convert to string as the schema expects
      uuid,
      token
    };
    
    // Use the storage interface to create the session
    // Note: lastActive is set by default in the database
    return await storage.createAnonymousWidgetSession(insertData);
  } catch (error) {
    console.error('Error creating anonymous widget session:', error);
    throw error;
  }
}

/**
 * Verify an anonymous widget session token
 * @param token - Session token
 * @returns The anonymous user ID or null if invalid
 */
export async function verifyAnonymousWidgetSession(token: string): Promise<number | null> {
  try {
    // Use the storage interface to get the anonymous session
    const session = await storage.getAnonymousWidgetSessionByToken(token);
    
    if (!session) {
      console.log('No anonymous session found for token');
      return null;
    }
    
    // Update last active time
    await storage.updateAnonymousWidgetSession(session.id, { lastActive: new Date() });
    
    // Return the anonymous user ID
    return session.anonymousUserId;
  } catch (error) {
    console.error('Error verifying anonymous widget session:', error);
    return null;
  }
}

/**
 * Check if an email already exists in the leads for a widget
 * @param widgetId - Widget ID
 * @param email - Email to check
 * @returns The existing lead or undefined if not found
 */
export async function findExistingLead(widgetId: number | string, email: string): Promise<WidgetLead | undefined> {
  try {
    const leads = await storage.getWidgetLeadsByWidgetId(widgetId);
    return leads.find(lead => lead.email.toLowerCase() === email.toLowerCase());
  } catch (error) {
    console.error('Error finding existing lead:', error);
    return undefined;
  }
}

/**
 * Check and enforce rate limits for lead creation
 * @param ipAddress - IP address to check
 * @param widgetId - Widget ID
 * @returns Object with isLimited flag and reset time
 */
export async function checkRateLimit(ipAddress: string, widgetId: number | string): Promise<{ 
  isLimited: boolean; 
  resetTime?: Date;
  attemptsRemaining?: number;
}> {
  try {
    // Find any leads from this IP in the last hour
    const leads = await storage.getWidgetLeadsByWidgetId(widgetId);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentLeads = leads.filter(lead => 
      lead.ipAddress === ipAddress && 
      new Date(lead.createdAt) > oneHourAgo
    );
    
    // Get the most recent lead with rate limit info
    const rateLimitedLead = leads.find(lead => 
      lead.ipAddress === ipAddress && 
      lead.rateLimit > 0 &&
      lead.rateLimitReset && new Date(lead.rateLimitReset) > now
    );
    
    // Check if currently rate limited
    if (rateLimitedLead && rateLimitedLead.rateLimitReset) {
      return { 
        isLimited: true, 
        resetTime: new Date(rateLimitedLead.rateLimitReset),
      };
    }
    
    // Allow max 5 lead submissions per hour per IP
    const MAX_LEADS_PER_HOUR = 5;
    const attemptsRemaining = MAX_LEADS_PER_HOUR - recentLeads.length;
    
    if (recentLeads.length >= MAX_LEADS_PER_HOUR) {
      // Set rate limit for 1 hour from now
      const resetTime = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Update all leads from this IP with rate limit info
      for (const lead of recentLeads) {
        await updateWidgetLead(lead.id, { 
          rateLimit: recentLeads.length,
          rateLimitReset: resetTime
        });
      }
      
      return { isLimited: true, resetTime };
    }
    
    return { isLimited: false, attemptsRemaining };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Default to not limited if there's an error
    return { isLimited: false };
  }
}

/**
 * Create a widget lead with duplicate and rate limit checking
 * @param leadData - Lead information to store
 * @returns The created or updated lead
 */
export async function createWidgetLead(leadData: InsertWidgetLead): Promise<WidgetLead> {
  try {
    // Check rate limits if IP address is provided
    if (leadData.ipAddress) {
      const { isLimited, resetTime } = await checkRateLimit(leadData.ipAddress, leadData.widgetId);
      if (isLimited) {
        throw new Error(`Rate limit exceeded. Please try again after ${resetTime?.toISOString()}`);
      }
    }
    
    // Check for existing lead with same email
    const existingLead = await findExistingLead(leadData.widgetId, leadData.email);
    
    if (existingLead) {
      // Update the existing lead instead of creating a new one
      const updatedData: Partial<WidgetLead> = {
        name: leadData.name,
        phone: leadData.phone || existingLead.phone,
        company: leadData.company || existingLead.company,
        ipAddress: leadData.ipAddress || existingLead.ipAddress,
        userAgent: leadData.userAgent || existingLead.userAgent,
        // Don't change emailVerified status
        status: existingLead.status === 'rejected' ? 'rejected' : 'new', // Keep rejected status if it was rejected
        updatedAt: new Date()
      };
      
      const updatedLead = await storage.updateWidgetLead(existingLead.id, updatedData);
      return updatedLead || existingLead;
    }
    
    // No existing lead, create a new one
    return await storage.createWidgetLead(leadData);
  } catch (error) {
    console.error('Error creating widget lead:', error);
    throw error;
  }
}

/**
 * Get widget lead by ID
 * @param id - Lead ID
 * @returns The lead or undefined if not found
 */
export async function getWidgetLead(id: number): Promise<WidgetLead | undefined> {
  try {
    // Use the storage interface to get the widget lead
    return await storage.getWidgetLead(id);
  } catch (error) {
    console.error('Error getting widget lead:', error);
    return undefined;
  }
}

/**
 * Get leads for a widget
 * @param widgetId - Widget ID
 * @returns Array of leads
 */
export async function getWidgetLeadsByWidgetId(widgetId: number): Promise<WidgetLead[]> {
  try {
    // Use the storage interface to get widget leads
    return await storage.getWidgetLeadsByWidgetId(widgetId);
  } catch (error) {
    console.error('Error getting widget leads by widget ID:', error);
    return [];
  }
}

/**
 * Get leads for an anonymous user
 * @param anonymousUserId - Anonymous user ID
 * @returns Array of leads
 */
export async function getWidgetLeadsByAnonymousUserId(anonymousUserId: number): Promise<WidgetLead[]> {
  try {
    // Use the storage interface to get widget leads by anonymous user ID
    return await storage.getWidgetLeadsByAnonymousUserId(anonymousUserId);
  } catch (error) {
    console.error('Error getting widget leads by anonymous user ID:', error);
    return [];
  }
}

/**
 * Update a widget lead
 * @param id - Lead ID
 * @param leadData - Lead data to update
 * @returns The updated lead or undefined if not found
 */
export async function updateWidgetLead(id: number, leadData: Partial<WidgetLead>): Promise<WidgetLead | undefined> {
  try {
    // Use the storage interface to update the widget lead
    return await storage.updateWidgetLead(id, leadData);
  } catch (error) {
    console.error('Error updating widget lead:', error);
    return undefined;
  }
}

/**
 * Verify a lead's email using OTP
 * @param leadId - Lead ID
 * @param code - OTP code
 * @returns Success status and message
 */
export async function verifyLeadEmail(leadId: number, code: string): Promise<{ success: boolean; message: string }> {
  try {
    const lead = await getWidgetLead(leadId);
    if (!lead) {
      return { success: false, message: "Lead not found" };
    }
    
    if (lead.emailVerified) {
      return { success: true, message: "Email already verified" };
    }
    
    // Get OTP for this email
    const otp = await storage.getOtpByEmail(lead.email);
    if (!otp) {
      return { success: false, message: "No verification code found" };
    }
    
    // Check if OTP is expired
    if (new Date() > new Date(otp.expiresAt)) {
      return { success: false, message: "Verification code expired" };
    }
    
    // Verify the code
    if (otp.code !== code) {
      return { success: false, message: "Invalid verification code" };
    }
    
    // Mark OTP as verified
    await storage.updateOtp(otp.id, { verified: true });
    
    // Mark lead as verified
    await updateWidgetLead(leadId, { 
      emailVerified: true,
      status: lead.status === 'new' ? 'verified' : lead.status // Update status if it's 'new'
    });
    
    return { success: true, message: "Email verified successfully" };
  } catch (error) {
    console.error('Error verifying lead email:', error);
    return { success: false, message: "Error verifying email" };
  }
}

/**
 * Get all leads for a user across all widgets
 * @param userId - User ID
 * @param options - Optional filtering parameters
 * @returns Array of leads with pagination info
 */
export async function getWidgetLeadsByUserId(
  userId: number,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: {
      dateRange?: { start: Date; end: Date };
      verified?: boolean;
      status?: string;
      search?: string;
      agentId?: string;
    }
  }
): Promise<{ leads: WidgetLead[]; total: number }> {
  try {
    // First get all widgets belonging to this user
    const widgets = await storage.getWidgetsByUserId(userId);
    
    // Get all leads for these widgets
    let allLeads: WidgetLead[] = [];
    for (const widget of widgets) {
      const leads = await storage.getWidgetLeadsByWidgetId(widget.id);
      allLeads = [...allLeads, ...leads];
    }
    
    // Handle filtering
    let filteredLeads = [...allLeads];
    
    if (options?.filters) {
      // Filter by date range
      if (options.filters.dateRange) {
        const { start, end } = options.filters.dateRange;
        filteredLeads = filteredLeads.filter(lead => {
          const createdAt = new Date(lead.createdAt);
          return createdAt >= start && createdAt <= end;
        });
      }
      
      // Filter by verification status
      if (options.filters.verified !== undefined) {
        filteredLeads = filteredLeads.filter(lead => 
          lead.emailVerified === options.filters.verified
        );
      }
      
      // Filter by lead status
      if (options.filters.status) {
        filteredLeads = filteredLeads.filter(lead => 
          lead.status === options.filters.status
        );
      }
      
      // Filter by agent ID
      if (options.filters.agentId) {
        filteredLeads = filteredLeads.filter(lead => 
          lead.agent === options.filters.agentId
        );
      }
      
      // Filter by search term (name, email, phone)
      if (options.filters.search) {
        const searchTerm = options.filters.search.toLowerCase();
        filteredLeads = filteredLeads.filter(lead => 
          lead.name.toLowerCase().includes(searchTerm) || 
          lead.email.toLowerCase().includes(searchTerm) ||
          (lead.phone && lead.phone.includes(searchTerm))
        );
      }
    }
    
    // Sort leads
    if (options?.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      filteredLeads.sort((a, b) => {
        // @ts-ignore - Dynamic property access
        const aValue = a[options.sortBy!];
        // @ts-ignore - Dynamic property access
        const bValue = b[options.sortBy!];
        
        if (aValue < bValue) return -1 * sortOrder;
        if (aValue > bValue) return 1 * sortOrder;
        return 0;
      });
    }
    
    // Get the total count before pagination
    const total = filteredLeads.length;
    
    // Apply pagination if specified
    if (options?.limit !== undefined && options?.offset !== undefined) {
      filteredLeads = filteredLeads.slice(options.offset, options.offset + options.limit);
    }
    
    return { leads: filteredLeads, total };
  } catch (error) {
    console.error('Error getting widget leads by user ID:', error);
    return { leads: [], total: 0 };
  }
}

/**
 * Export widget leads to CSV format
 * @param leads - Array of leads to export
 * @returns CSV string
 */
export function exportLeadsToCSV(leads: WidgetLead[]): string {
  // Define the CSV header row
  const headers = [
    'ID', 'Name', 'Email', 'Email Verified', 'Phone', 'Company', 'Status',
    'IP Address', 'Agent', 'Created At', 'Last Contacted'
  ];
  
  // Convert leads to CSV rows
  const rows = leads.map(lead => [
    lead.id,
    lead.name,
    lead.email,
    lead.emailVerified ? 'Yes' : 'No',
    lead.phone || '',
    lead.company || '',
    lead.status,
    lead.ipAddress || '',
    lead.agent || '',
    new Date(lead.createdAt).toISOString(),
    lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString() : ''
  ]);
  
  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}