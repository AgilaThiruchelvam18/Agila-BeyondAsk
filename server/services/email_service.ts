import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private configured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Check for environment variables
      const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
      const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
      const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
      const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

      if (emailHost && emailUser && emailPass) {
        const config: EmailConfig = {
          host: emailHost,
          port: emailPort,
          secure: emailPort === 465,
          auth: {
            user: emailUser,
            pass: emailPass
          }
        };

        this.transporter = nodemailer.createTransport(config);
        this.configured = true;
        console.log('Email service configured successfully');
      } else {
        console.log('Email service not configured - missing environment variables');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  async sendEmail(emailData: EmailTemplate): Promise<boolean> {
    if (!this.configured || !this.transporter) {
      console.warn('Email service not configured, skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || this.htmlToText(emailData.html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  createTeamInvitationEmail(
    inviterName: string,
    teamName: string,
    inviteEmail: string,
    invitationToken: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): EmailTemplate {
    const inviteUrl = `${baseUrl}/teams/accept-invitation?token=${invitationToken}&email=${encodeURIComponent(inviteEmail)}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
          .content { padding: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Join a Team!</h1>
          </div>

          <div class="content">
            <p>Hello,</p>

            <p><strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong>.</p>

            <p>Click the button below to accept this invitation and join the team:</p>

            <a href="${inviteUrl}" class="button">Accept Invitation</a>

            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${inviteUrl}">${inviteUrl}</a></p>

            <p>This invitation will expire in 7 days.</p>
          </div>

          <div class="footer">
            <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
            <p>This is an automated message from BeyondAsk.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      to: inviteEmail,
      subject: `You're invited to join "${teamName}" team`,
      html
    };
  }

  getConfigurationStatus(): boolean {
    return this.configured;
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection test failed:', error);
      return false;
    }
  }
}

export default new EmailService();