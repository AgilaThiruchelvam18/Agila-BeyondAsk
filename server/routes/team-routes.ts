/**
 * Team Management Routes
 * Handles team operations, member management, invitations, and activity logs
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth-middleware';
import { sendError } from '../utils/response-helpers';
import { getErrorMessage } from '../utils/type-guards';
import { storage } from '../storage';
import { sendEmail, isEmailAvailable } from '../services/sendgrid_service';
import { z } from 'zod';
import crypto from 'crypto';
import { TeamMember } from '@shared/schema';

const router = Router();

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
  settings: z.record(z.any()).optional()
});

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional()
});

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  permissions: z.array(z.string()).optional()
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
  permissions: z.array(z.string()).optional()
});

/**
 * Get all teams for authenticated user
 */
router.get('/teams', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teams = await storage.getUserTeams(userId);
    
    return res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch teams', 500);
  }
});

/**
 * Get specific team details
 */
router.get('/teams/:teamId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user is team member
    const isMember = await storage.isTeamMember(teamId, userId);
    if (!isMember) {
      return sendError(res, 'Access denied to this team', 403);
    }
    
    const team = await storage.getTeamById(teamId);
    if (!team) {
      return sendError(res, 'Team not found', 404);
    }
    
    // Get team members
    const members = await storage.getTeamMembersByTeamId(teamId);
    
    return res.json({ ...team, members });
  } catch (error) {
    console.error('Error fetching team details:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch team details', 500);
  }
});

/**
 * Create new team
 */
router.post('/teams', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = createTeamSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid team data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamData = validation.data;
    
    const team = await storage.createTeam({
      ...teamData,
      ownerId: userId
    });
    
    // Add creator as admin member
    await storage.createTeamMember({
      teamId: team.id,
      userId: userId,
      role: 'admin',
      status: 'active',
      joinedAt: new Date(),
      updatedAt: new Date()
    });
    
    // Log activity
    await storage.createActivityLog({
      teamId: team.id,
      userId: userId,
      action: 'create',
      entityType: 'team',
      entityId: team.id.toString(),
      details: { teamName: team.name }
    });
    
    return res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', getErrorMessage(error));
    return sendError(res, 'Failed to create team', 500);
  }
});

/**
 * Update team
 */
router.put('/teams/:teamId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = updateTeamSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid team data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const teamData = validation.data;
    const updatedTeam = await storage.updateTeam(teamId, teamData);
    
    if (!updatedTeam) {
      return sendError(res, 'Team not found', 404);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'update',
      entityType: 'team',
      entityId: teamId.toString(),
      details: teamData
    });
    
    return res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', getErrorMessage(error));
    return sendError(res, 'Failed to update team', 500);
  }
});

/**
 * Delete team
 */
router.delete('/teams/:teamId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user is team owner
    const team = await storage.getTeamById(teamId);
    if (!team) {
      return sendError(res, 'Team not found', 404);
    }
    
    if (team.ownerId !== userId) {
      return sendError(res, 'Only team owner can delete team', 403);
    }
    
    await storage.deleteTeam(teamId);
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'delete',
      entityType: 'team',
      entityId: teamId.toString(),
      details: { teamName: team.name }
    });
    
    return res.json({ message: 'Team deleted successfully', teamId });
  } catch (error) {
    console.error('Error deleting team:', getErrorMessage(error));
    return sendError(res, 'Failed to delete team', 500);
  }
});

/**
 * Get team members - Legacy API compatibility (exact path match)
 */
router.get('/teams/:id/members', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.id);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user is team member
    const isMember = await storage.isTeamMember(teamId, userId);
    if (!isMember) {
      return sendError(res, 'Access denied to this team', 403);
    }
    
    // Get team members with full user details to match legacy format
    const members = await storage.getTeamMembers(teamId);
    
    // Enrich member data with user details to match legacy response format with nested user object
    const enrichedMembers = await Promise.all(members.map(async (member: TeamMember) => {
      try {
        const user = await storage.getUserById(member.userId);
        console.log(`Enriching member ${member.userId}, user data:`, user);
        return {
          teamId: member.teamId,
          userId: member.userId,
          role: member.role,
          status: member.status || 'active',
          joinedAt: member.joinedAt,
          updatedAt: member.updatedAt,
          id: `${member.teamId}-${member.userId}`, // Generate composite ID for frontend
          user: {
            id: user?.id || member.userId,
            name: user ? user.name : 'Unknown User',
            email: user ? user.email : '',
            picture: user?.picture || null
          }
        };
      } catch (error) {
        console.error(`Error enriching member ${member.userId}:`, error);
        return {
          teamId: member.teamId,
          userId: member.userId,
          role: member.role,
          status: member.status || 'active',
          joinedAt: member.joinedAt,
          updatedAt: member.updatedAt,
          id: `${member.teamId}-${member.userId}`,
          user: {
            id: member.userId,
            name: 'Unknown User',
            email: '',
            picture: null
          }
        };
      }
    }));
    
    return res.json(enrichedMembers);
  } catch (error) {
    console.error('Error fetching team members:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch team members', 500);
  }
});

/**
 * Create team invitation - Legacy API compatibility
 */
router.post('/teams/:id/invitations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const teamId = parseInt(req.params.id);
    const { email, role } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'user'" });
    }
    
    if (isNaN(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }
    
    // Check if user has admin permissions for this team
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return res.status(403).json({ 
        message: "You don't have permission to create invitations for this team" 
      });
    }
    
    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration
    
    // Create invitation with token - legacy format
    const invitation = await storage.createTeamInvitation({
      teamId: teamId,
      email: email,
      role: role,
      invitedByUserId: userId,
      token: invitationToken,
      expiresAt: expirationDate,
      status: 'pending'
    });
    
    if (!invitation) {
      return res.status(403).json({
        message: "You don't have permission to create invitations for this team"
      });
    }
    
    // Send invitation email
    try {
      const team = await storage.getTeamById(teamId);
      const inviter = await storage.getUserById(userId);
      
      if (team && inviter) {
        if (!isEmailAvailable()) {
          console.log('Email service not configured, skipping email send');
        } else {
          // Use exact legacy email template format
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const inviteUrl = `${baseUrl}/teams/accept-invitation?token=${invitationToken}&email=${encodeURIComponent(email)}`;
          
          const subject = `You're invited to join "${team.name}" team`;
          const text = `${inviter.name} has invited you to join the team "${team.name}". Click the link to accept: ${inviteUrl}`;
          
          // Legacy email template - exact match
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
                  
                  <p><strong>${inviter.name}</strong> has invited you to join the team <strong>"${team.name}"</strong>.</p>
                  
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
          
          const emailSent = await sendEmail(email, subject, text, html);
          console.log(`Team invitation email ${emailSent ? 'sent' : 'failed'} to ${email}`);
        }
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue without failing the invitation creation
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'invite',
      entityType: 'team_member',
      entityId: invitation.id.toString(),
      details: { email, role }
    });
    
    return res.status(201).json(invitation);
  } catch (error) {
    console.error('Error creating team invitation:', error);
    return res.status(500).json({
      message: "Failed to create team invitation",
      error: getErrorMessage(error)
    });
  }
});

/**
 * Update team member role
 */
router.put('/teams/:teamId/members/:memberId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const validation = updateMemberRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid member data: ' + JSON.stringify(validation.error.errors), 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const memberId = parseInt(req.params.memberId);
    
    if (isNaN(teamId) || isNaN(memberId)) {
      return sendError(res, 'Invalid team or member ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const { role, permissions } = validation.data;
    
    const updatedMember = await storage.updateTeamMember(teamId, memberId, {
      role: role,
      permissions: permissions || []
    });
    
    if (!updatedMember) {
      return sendError(res, 'Team member not found', 404);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'update',
      entityType: 'team_member',
      entityId: memberId.toString(),
      details: { role, permissions }
    });
    
    return res.json(updatedMember);
  } catch (error) {
    console.error('Error updating team member:', getErrorMessage(error));
    return sendError(res, 'Failed to update team member', 500);
  }
});

/**
 * Accept team invitation by token
 */
router.post('/teams/accept-invitation', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return sendError(res, 'Token and email are required', 400);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    // Verify invitation token and get team info
    const verificationResult = await storage.verifyTeamInvitationToken(token);
    if (!verificationResult) {
      return sendError(res, 'Invalid or expired invitation token', 400);
    }
    
    const { invitation, teamName } = verificationResult;
    
    // Check if email matches the invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return sendError(res, 'Email does not match invitation', 400);
    }
    
    // Accept the invitation
    const teamMember = await storage.acceptTeamInvitation(token, userId);
    if (!teamMember) {
      return sendError(res, 'Failed to accept invitation', 500);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: invitation.teamId,
      userId: userId,
      action: 'accept_invitation',
      entityType: 'team_member',
      entityId: teamMember.id.toString(),
      details: { email, teamName }
    });
    
    return res.json({ 
      message: 'Invitation accepted successfully', 
      teamMember,
      teamName 
    });
  } catch (error) {
    console.error('Error accepting team invitation:', getErrorMessage(error));
    return sendError(res, 'Failed to accept invitation', 500);
  }
});

/**
 * Verify team invitation token (public endpoint for invitation page)
 */
router.get('/teams/verify-invitation/:token', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return sendError(res, 'Token is required', 400);
    }
    
    // Verify invitation token and get team info
    const verificationResult = await storage.verifyTeamInvitationToken(token);
    if (!verificationResult) {
      return sendError(res, 'Invalid or expired invitation token', 400);
    }
    
    const { invitation, teamName } = verificationResult;
    
    return res.json({ 
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        teamName,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Error verifying team invitation:', getErrorMessage(error));
    return sendError(res, 'Failed to verify invitation', 500);
  }
});

/**
 * Remove team member
 */
router.delete('/teams/:teamId/members/:memberId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const memberUserId = parseInt(req.params.memberId);
    
    if (isNaN(teamId) || isNaN(memberUserId)) {
      return sendError(res, 'Invalid team or member ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const member = await storage.getTeamMember(memberUserId);
    if (!member) {
      return sendError(res, 'Team member not found', 404);
    }
    
    await storage.removeTeamMember(teamId, memberUserId);
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamId,
      userId: userId,
      action: 'remove',
      entityType: 'team_member',
      entityId: memberUserId.toString(),
      details: { removedUserId: member.userId }
    });
    
    return res.json({ message: 'Team member removed successfully', memberId: memberUserId });
  } catch (error) {
    console.error('Error removing team member:', getErrorMessage(error));
    return sendError(res, 'Failed to remove team member', 500);
  }
});

/**
 * Get team invitations
 */
router.get('/teams/:teamId/invitations', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user has admin permissions
    const hasAdminAccess = await storage.hasTeamPermission(userId, teamId, 'admin');
    if (!hasAdminAccess) {
      return sendError(res, 'Admin access required', 403);
    }
    
    const invitations = await storage.getTeamInvitations(teamId);
    return res.json(invitations);
  } catch (error) {
    console.error('Error fetching team invitations:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch team invitations', 500);
  }
});

/**
 * Cancel team invitation - Legacy API compatibility
 */
router.delete('/teams/invitations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const invitationId = parseInt(req.params.id);
    
    if (isNaN(invitationId)) {
      return res.status(400).json({ message: "Invalid invitation ID" });
    }
    
    // Get invitation to verify team access
    const invitation = await storage.getTeamInvitation(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }
    
    // Check if user has admin permissions for this team
    const hasAdminAccess = await storage.hasTeamPermission(userId, invitation.teamId, 'admin');
    if (!hasAdminAccess) {
      return res.status(403).json({ 
        message: "You don't have permission to cancel this invitation" 
      });
    }
    
    await storage.deleteTeamInvitation(invitationId);
    
    // Log activity
    await storage.createActivityLog({
      teamId: invitation.teamId,
      userId: userId,
      action: 'cancel',
      entityType: 'team_invitation',
      entityId: invitationId.toString(),
      details: { email: invitation.email }
    });
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling team invitation:', getErrorMessage(error));
    return res.status(500).json({
      message: "Failed to cancel team invitation",
      error: getErrorMessage(error)
    });
  }
});

/**
 * Get team activity logs
 */
router.get('/teams/:teamId/activity', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const teamId = parseInt(req.params.teamId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (isNaN(teamId)) {
      return sendError(res, 'Invalid team ID', 400);
    }
    
    // Check if user is team member
    const isMember = await storage.isTeamMember(teamId, userId);
    if (!isMember) {
      return sendError(res, 'Access denied to this team', 403);
    }
    
    const activities = await storage.getTeamActivityLogs(teamId, page, limit);
    return res.json(activities);
  } catch (error) {
    console.error('Error fetching team activity logs:', getErrorMessage(error));
    return sendError(res, 'Failed to fetch team activity logs', 500);
  }
});

/**
 * Resend team invitation - Legacy API compatibility
 */
router.post('/teams/invitations/:id/resend', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const invitationId = parseInt(req.params.id);
    
    if (isNaN(invitationId)) {
      return res.status(400).json({ message: "Invalid invitation ID" });
    }
    
    // Get invitation to verify team access
    const invitation = await storage.getTeamInvitation(invitationId);
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }
    
    // Check if user has admin permissions for the team
    const hasAdminAccess = await storage.hasTeamPermission(userId, invitation.teamId, 'admin');
    if (!hasAdminAccess) {
      return res.status(403).json({ 
        message: "You don't have permission to resend this invitation" 
      });
    }
    
    const success = await storage.resendTeamInvitation(invitationId, userId);
    if (!success) {
      return res.status(403).json({ 
        message: "You don't have permission to resend this invitation" 
      });
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: invitation.teamId,
      userId: userId,
      action: 'resend',
      entityType: 'team_invitation',
      entityId: invitationId.toString(),
      details: { email: invitation.email }
    });
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error resending team invitation:', getErrorMessage(error));
    return res.status(500).json({
      message: "Failed to resend team invitation",
      error: getErrorMessage(error)
    });
  }
});

/**
 * Verify team invitation token (public endpoint)
 */
router.get('/teams/invitations/verify/:token', async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.params.token;
    
    const verificationResult = await storage.verifyTeamInvitationToken(token);
    if (!verificationResult) {
      return sendError(res, 'Invalid or expired invitation', 404);
    }
    
    const { invitation, teamName } = verificationResult;
    
    return res.json({
      invitation: {
        id: invitation.id,
        teamId: invitation.teamId,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      },
      teamName: teamName || 'Team'
    });
  } catch (error) {
    console.error('Error verifying team invitation:', getErrorMessage(error));
    return sendError(res, 'Failed to verify team invitation', 500);
  }
});

/**
 * Accept team invitation (public endpoint)
 */
router.post('/teams/invitations/accept/:token', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }
    
    const token = req.params.token;
    
    const teamMember = await storage.acceptTeamInvitation(token, userId);
    if (!teamMember) {
      return sendError(res, 'Invalid or expired invitation', 400);
    }
    
    // Log activity
    await storage.createActivityLog({
      teamId: teamMember.teamId,
      userId: userId,
      action: 'accept',
      entityType: 'team_invitation',
      entityId: token,
      details: { userId: userId }
    });
    
    return res.status(201).json(teamMember);
  } catch (error) {
    console.error('Error accepting team invitation:', getErrorMessage(error));
    return sendError(res, 'Failed to accept team invitation', 500);
  }
});

export default router;