/**
 * SendGrid Email Service
 * 
 * This service handles sending emails using SendGrid, including OTP verification emails.
 */

import sgMail from '@sendgrid/mail';

// Check if SendGrid API key is provided
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
// Use a verified sender domain that matches your SendGrid account
const FROM_EMAIL = process.env.FROM_EMAIL || 'team@beyondask.com';
const FROM_NAME = process.env.FROM_NAME || 'BeyondAsk Team';

// Initialize SendGrid with API key
let isEmailServiceAvailable = false;

/**
 * Initialize the SendGrid email service
 */
export async function initSendGridService(): Promise<boolean> {
  try {
    // Skip initialization if no SendGrid API key is provided
    if (!SENDGRID_API_KEY) {
      console.log('SendGrid API key not configured, email service unavailable');
      isEmailServiceAvailable = false;
      return false;
    }

    // Set API key
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('SendGrid email service is ready to send messages');
    isEmailServiceAvailable = true;
    return true;
  } catch (error) {
    console.error('Error initializing SendGrid email service:', error);
    isEmailServiceAvailable = false;
    return false;
  }
}

/**
 * Check if email service is available
 * @returns Boolean indicating if email service is available
 */
export function isEmailAvailable(): boolean {
  return isEmailServiceAvailable;
}

/**
 * Send an OTP email using SendGrid
 * @param to - Recipient email address
 * @param otp - One-time password
 * @param appName - Optional application name
 * @returns Boolean indicating success or failure
 */
export async function sendOtpEmail(to: string, otp: string, appName?: string): Promise<boolean> {
  try {
    // If email service isn't available, log and return false
    if (!isEmailServiceAvailable) {
      console.log(`SendGrid email service not available, would have sent OTP ${otp} to ${to}`);
      return false;
    }

    const applicationName = appName || 'BeyondAsk';

    // Log SendGrid configuration
    console.log(`SendGrid configuration: API Key set = ${!!SENDGRID_API_KEY}, From Email = ${FROM_EMAIL}`);

    // Prepare email message
    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `Your verification code for ${applicationName}`,
      text: `Your verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your verification code</h2>
          <p>Use the following code to complete your verification:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 28px; letter-spacing: 5px; font-weight: bold;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is an automated message from ${applicationName}. Please do not reply to this email.
          </p>
        </div>
      `
    };

    console.log(`Attempting to send OTP via SendGrid to ${to} with message ID: ${Date.now()}`);

    // Send email
    const response = await sgMail.send(msg);
    console.log(`SendGrid API response:`, response ? JSON.stringify(response) : 'No response');
    console.log(`OTP email sent successfully to ${to}`);
    return true;
  } catch (error: unknown) {
    console.error('Error sending OTP email via SendGrid:', error);
    // Type guard for error with response property
    if (error && typeof error === 'object' && 'response' in error) {
      const sendGridError = error as { response: { body: unknown; statusCode: number } };
      console.error('SendGrid Error Response:', {
        body: sendGridError.response.body,
        statusCode: sendGridError.response.statusCode
      });
    }
    return false;
  }
}

/**
 * Send a general email using SendGrid
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param text - Plain text content
 * @param html - HTML content
 * @returns Boolean indicating success or failure
 */
export async function sendEmail(
  to: string, 
  subject: string, 
  text: string, 
  html?: string
): Promise<boolean> {
  try {
    // If email service isn't available, log and return false
    if (!isEmailServiceAvailable) {
      console.log(`SendGrid email service not available, would have sent email to ${to} with subject: ${subject}`);
      return false;
    }

    // Prepare email message
    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject,
      text,
      html: html || text
    };

    // Send email
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error: unknown) {
    console.error('Error sending email via SendGrid:', error);
    return false;
  }
}