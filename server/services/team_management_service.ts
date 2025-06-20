/**
 * Team Management Service
 * 
 * This service handles team operations including team creation, member management,
 * and invitation functionality.
 */

import crypto from 'crypto';
import { storage } from '../storage';
import { 
  Team, 
  InsertTeam, 
  TeamMember, 
  InsertTeamMember,
  TeamInvitation, 
  InsertTeamInvitation,
  TeamRole,
  ActivityLog,
  InsertActivityLog
} from '@shared/schema';
import { sendEmail } from './sendgrid_service';

// Default invitation expiration time (48 hours in milliseconds)
const INVITATION_EXPIRY_HOURS = 48;

/**
 * Create a new team
 * @param userId - User ID of the team creator (will be the owner/admin)
 * @param teamData - Team information to create
 * @returns The created team
 */
export async function createTeam(userId: number, teamData: Omit<InsertTeam, 'ownerId'>): Promise<Team> {
  try {
    // Create the team with the user as owner
    const team = await storage.createTeam({
      ...teamData,
      ownerId: userId
    });
    
    // Add the creator as an admin team member
    await storage.createTeamMember({
      teamId: team.id,
      userId: userId,
      role: 'admin'
    });
    
    // Log activity
    await logActivity({
      userId,
      action: 'create',
      entityType: 'team',
      entityId: team.id.toString(),
      teamId: team.id,
      details: { 
        teamName: team.name 
      }
    });
    
    return team;
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
}

/**
 * Get a team by ID
 * @param teamId - Team ID
 * @returns The team or undefined if not found
 */
export async function getTeam(teamId: number): Promise<Team | undefined> {
  try {
    return await storage.getTeam(teamId);
  } catch (error) {
    console.error('Error getting team:', error);
    return undefined;
  }
}

/**
 * Get teams for a user
 * @param userId - User ID
 * @returns Array of teams the user is a member of
 */
export async function getUserTeams(userId: number): Promise<Team[]> {
  try {
    const memberships = await storage.getTeamMembershipsByUserId(userId);
    const teamIds = memberships.map(membership => membership.teamId);
    
    // For each team ID, get the team details
    const teams: Team[] = [];
    for (const teamId of teamIds) {
      const team = await storage.getTeam(teamId);
      if (team) teams.push(team);
    }
    
    return teams;
  } catch (error) {
    console.error('Error getting user teams:', error);
    return [];
  }
}

/**
 * Update a team
 * @param teamId - Team ID
 * @param userId - User ID making the update (for permission check)
 * @param teamData - Team data to update
 * @returns The updated team or undefined if not found or unauthorized
 */
export async function updateTeam(teamId: number, userId: number, teamData: Partial<Team>): Promise<Team | undefined> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return undefined;
    }
    
    // Update the team
    const updatedTeam = await storage.updateTeam(teamId, teamData);
    
    // Log activity
    if (updatedTeam) {
      await logActivity({
        userId,
        teamId,
        action: 'update',
        entityType: 'team',
        entityId: teamId.toString(),
        details: { 
          updates: teamData
        }
      });
    }
    
    return updatedTeam;
  } catch (error) {
    console.error('Error updating team:', error);
    return undefined;
  }
}

/**
 * Get team members
 * @param teamId - Team ID
 * @param userId - User ID making the request (for permission check)
 * @returns Array of team members with user details or empty array if unauthorized
 */
export async function getTeamMembers(teamId: number, userId: number): Promise<any[]> {
  try {
    // Check if user is a member of this team (any role can view members)
    if (!await isTeamMember(teamId, userId)) {
      console.log(`User ${userId} is not a member of team ${teamId}`);
      return [];
    }
    
    // Get team members
    const members = await storage.getTeamMembersByTeamId(teamId);
    
    // Enrich member data with user details
    const enrichedMembers = await Promise.all(members.map(async (member: TeamMember) => {
      const user = await storage.getUser(member.userId);
      return {
        ...member,
        id: `${member.teamId}-${member.userId}`, // Generate an ID for the frontend
        name: user ? user.name : 'Unknown User',
        email: user ? user.email : '',
        avatarUrl: user?.picture || null
      };
    }));
    
    return enrichedMembers;
  } catch (error) {
    console.error('Error getting team members:', error);
    return [];
  }
}

/**
 * Check if a user is a member of a team
 * @param teamId - Team ID
 * @param userId - User ID
 * @returns Boolean indicating if the user is a team member
 */
export async function isTeamMember(teamId: number, userId: number): Promise<boolean> {
  try {
    const member = await storage.getTeamMember(userId);
    return !!member && member.status === 'active' && member.teamId === teamId;
  } catch (error) {
    console.error('Error checking team membership:', error);
    return false;
  }
}

/**
 * Check if a user has a specific role in a team
 * @param teamId - Team ID
 * @param userId - User ID
 * @param role - Role to check ('admin' or 'user')
 * @returns Boolean indicating if the user has the specified role
 */
export async function hasTeamPermission(teamId: number, userId: number, role: TeamRole): Promise<boolean> {
  try {
    const member = await storage.getTeamMemberByTeamAndUser(teamId, userId);
    
    if (!member || member.status !== 'active') {
      return false;
    }
    
    // Admin role has all permissions
    if (member.role === 'admin') {
      return true;
    }
    
    // Check if the user has the specific role
    return member.role === role;
  } catch (error) {
    console.error('Error checking team permission:', error);
    return false;
  }
}

/**
 * Check if a user has access to a team (is an active member)
 * @param teamId - Team ID
 * @param userId - User ID
 * @returns Boolean indicating if the user is an active member of the team
 */
export async function hasTeamAccess(teamId: number, userId: number): Promise<boolean> {
  try {
    const member = await storage.getTeamMemberByTeamAndUser(teamId, userId);
    return !!member && member.status === 'active';
  } catch (error) {
    console.error('Error checking team access:', error);
    return false;
  }
}

/**
 * Update a team member's role
 * @param teamId - Team ID
 * @param memberId - Member user ID to update
 * @param userId - User ID making the update (for permission check)
 * @param role - New role for the member
 * @returns The updated team member or undefined if not found or unauthorized
 */
export async function updateTeamMemberRole(
  teamId: number, 
  memberId: number, 
  userId: number, 
  role: TeamRole
): Promise<any | undefined> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return undefined;
    }
    
    // Get the member to update
    const member = await storage.getTeamMember(memberId);
    
    if (!member) {
      console.log(`Member ${memberId} not found in team ${teamId}`);
      return undefined;
    }
    
    // Cannot change the role of the team owner
    const team = await storage.getTeam(teamId);
    if (team?.ownerId === memberId) {
      console.log(`Cannot change role of team owner`);
      return undefined;
    }
    
    // Update the role
    const updatedMember = await storage.updateTeamMember(teamId, memberId, { role });
    
    // Log activity
    if (updatedMember) {
      await logActivity({
        userId,
        teamId,
        action: 'update_role',
        entityType: 'team_member',
        entityId: memberId.toString(),
        details: { 
          newRole: role,
          memberId: memberId
        }
      });

      // Get user details to enrich the member data
      const user = await storage.getUser(memberId);
      return {
        ...updatedMember,
        id: `${teamId}-${memberId}`, // Generate an ID for the frontend
        name: user ? user.name : 'Unknown User',
        email: user ? user.email : '',
        avatarUrl: user?.picture || null
      };
    }
    
    return undefined;
  } catch (error) {
    console.error('Error updating team member role:', error);
    return undefined;
  }
}

/**
 * Remove a member from a team
 * @param teamId - Team ID
 * @param memberId - Member user ID to remove
 * @param userId - User ID making the request (for permission check)
 * @returns Boolean indicating success or failure
 */
export async function removeTeamMember(teamId: number, memberId: number, userId: number): Promise<boolean> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return false;
    }
    
    // Cannot remove the team owner
    const team = await storage.getTeam(teamId);
    if (team?.ownerId === memberId) {
      console.log(`Cannot remove team owner`);
      return false;
    }
    
    // Check if member exists before removing
    const member = await storage.getTeamMember(memberId);
    if (!member || member.teamId !== teamId) {
      console.log(`Member ${memberId} not found in team ${teamId}`);
      return false;
    }
    
    // Try to delete the team member entirely instead of just marking inactive
    const deleted = await storage.deleteTeamMember(memberId);
    
    // If deletion failed, fallback to marking as inactive
    if (!deleted) {
      console.log(`Hard delete failed, trying soft delete (inactive status) for member ${memberId} in team ${teamId}`);
      const updated = await storage.updateTeamMember(teamId, memberId, { status: 'inactive' });
      
      if (!updated) {
        console.log(`Failed to remove member ${memberId} from team ${teamId}`);
        return false;
      }
    }
    
    // Log activity
    await logActivity({
      userId,
      teamId,
      action: 'remove',
      entityType: 'team_member',
      entityId: memberId.toString(),
      details: { 
        removedMemberId: memberId
      }
    });
    return true;
  } catch (error) {
    console.error('Error removing team member:', error);
    return false;
  }
}

/**
 * Generate a secure token for team invitation
 * @returns Secure random token
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a team invitation
 * @param teamId - Team ID
 * @param userId - User ID sending the invitation (for permission check)
 * @param inviteData - Invitation details
 * @returns The created invitation or undefined if unauthorized
 */
export async function createTeamInvitation(
  teamId: number, 
  userId: number, 
  inviteData: Omit<InsertTeamInvitation, 'invitedByUserId'>
): Promise<TeamInvitation | undefined> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return undefined;
    }
    
    // Generate token and set expiration time
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);
    
    // Check if this email already has a pending invitation for this team
    const existingInvitations = await storage.getTeamInvitationsByTeamId(teamId);
    const pendingInvitation = existingInvitations.find((invite: TeamInvitation) => 
      invite.email === inviteData.email && invite.status === 'pending'
    );
    
    // If there's a pending invitation, cancel it before creating a new one
    if (pendingInvitation) {
      await storage.updateTeamInvitation(pendingInvitation.id, { status: 'cancelled' });
    }
    
    // Create the invitation
    const invitation = await storage.createTeamInvitation({
      ...inviteData,
      invitedByUserId: userId,
      expiresAt,
      token // Passing token separately as it's handled in PostgresqlAdapter
    } as InsertTeamInvitation & { token: string });
    
    // Log activity
    await logActivity({
      userId,
      teamId,
      action: 'invite',
      entityType: 'team_invitation',
      entityId: invitation.id.toString(),
      details: { 
        email: invitation.email,
        role: invitation.role
      }
    });
    
    return invitation;
  } catch (error) {
    console.error('Error creating team invitation:', error);
    return undefined;
  }
}

/**
 * Get team invitations
 * @param teamId - Team ID
 * @param userId - User ID making the request (for permission check)
 * @returns Array of team invitations or empty array if unauthorized
 */
export async function getTeamInvitations(teamId: number, userId: number): Promise<TeamInvitation[]> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return [];
    }
    
    // Get team invitations
    return await storage.getTeamInvitationsByTeamId(teamId);
  } catch (error) {
    console.error('Error getting team invitations:', error);
    return [];
  }
}

/**
 * Cancel a team invitation
 * @param invitationId - Invitation ID
 * @param userId - User ID making the request (for permission check)
 * @returns Boolean indicating success or failure
 */
export async function cancelTeamInvitation(invitationId: number, userId: number): Promise<boolean> {
  try {
    // Get the invitation
    const invitation = await storage.getTeamInvitation(invitationId);
    
    if (!invitation) {
      console.log(`Invitation ${invitationId} not found`);
      return false;
    }
    
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(invitation.teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${invitation.teamId}`);
      return false;
    }
    
    // Cancel the invitation
    const updated = await storage.updateTeamInvitation(invitationId, { status: 'cancelled' });
    
    // Log activity
    if (updated) {
      await logActivity({
        userId,
        teamId: invitation.teamId,
        action: 'cancel_invite',
        entityType: 'team_invitation',
        entityId: invitationId.toString(),
        details: { 
          email: invitation.email
        }
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error cancelling team invitation:', error);
    return false;
  }
}

/**
 * Resend a team invitation email
 * @param invitationId - Invitation ID
 * @param userId - User ID making the request (for permission check)
 * @returns Boolean indicating success or failure
 */
export async function resendTeamInvitation(invitationId: number, userId: number): Promise<boolean> {
  try {
    // Get the invitation
    const invitation = await storage.getTeamInvitation(invitationId);
    
    if (!invitation) {
      console.log(`Invitation ${invitationId} not found`);
      return false;
    }
    
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(invitation.teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${invitation.teamId}`);
      return false;
    }
    
    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      console.log(`Invitation ${invitationId} is not pending (status: ${invitation.status})`);
      return false;
    }
    
    // Reset expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);
    
    // Update the invitation with new expiration
    await storage.updateTeamInvitation(invitationId, { expiresAt, updatedAt: new Date() });
    
    // Send the invitation email
    const emailSent = await sendTeamInvitationEmail(invitation);
    
    // Log activity
    if (emailSent) {
      await logActivity({
        userId,
        teamId: invitation.teamId,
        action: 'resend_invite',
        entityType: 'team_invitation',
        entityId: invitationId.toString(),
        details: { 
          email: invitation.email
        }
      });
    }
    
    return emailSent;
  } catch (error) {
    console.error('Error resending team invitation:', error);
    return false;
  }
}

/**
 * Verify a team invitation token
 * @param token - Invitation token
 * @returns Object containing the invitation and team name if valid, undefined if not found or expired
 */
export async function verifyTeamInvitationToken(token: string): Promise<{ invitation: TeamInvitation; teamName: string | undefined; } | undefined> {
  try {
    // Get the invitation by token
    const invitation = await storage.getTeamInvitationByToken(token);
    
    if (!invitation) {
      console.log('Invitation not found for token');
      return undefined;
    }
    
    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      console.log(`Invitation is not pending (status: ${invitation.status})`);
      return undefined;
    }
    
    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await storage.updateTeamInvitation(invitation.id, { status: 'expired' });
      console.log('Invitation has expired');
      return undefined;
    }
    
    // Get team name for better context
    let teamName: string | undefined;
    try {
      const team = await storage.getTeam(invitation.teamId);
      teamName = team?.name;
    } catch (error) {
      console.warn(`Error retrieving team name for invitation ${invitation.id}:`, error);
      // Continue even if we can't get the team name
    }
    
    return { invitation, teamName };
  } catch (error) {
    console.error('Error verifying team invitation token:', error);
    return undefined;
  }
}

/**
 * Accept a team invitation
 * @param token - Invitation token
 * @param userId - User ID accepting the invitation
 * @returns The team member created or undefined if failed
 */
export async function acceptTeamInvitation(token: string, userId: number): Promise<TeamMember | undefined> {
  try {
    // Verify the invitation
    const verificationResult = await verifyTeamInvitationToken(token);
    
    if (!verificationResult) {
      console.log('Invalid or expired invitation token');
      return undefined;
    }
    
    const { invitation } = verificationResult;
    
    // Get user's email to verify it matches the invitation
    const user = await storage.getUser(userId);
    
    if (!user) {
      console.log(`User ${userId} not found`);
      return undefined;
    }
    
    // Check if email matches (case insensitive)
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      console.log(`Email mismatch: invitation for ${invitation.email}, user is ${user.email}`);
      return undefined;
    }
    
    // Check if user is already a member of this team
    const existingMember = await storage.getTeamMember(userId);
    
    if (existingMember && existingMember.teamId === invitation.teamId) {
      if (existingMember.status === 'active') {
        // User is already an active member, mark invitation as accepted
        await storage.updateTeamInvitation(invitation.id, { 
          status: 'accepted', 
          acceptedAt: new Date(),
          acceptedByUserId: userId
        });
        
        return existingMember;
      } else if (existingMember.status === 'inactive') {
        // Reactivate the membership
        const updatedMember = await storage.updateTeamMember(invitation.teamId, userId, { 
          status: 'active',
          role: invitation.role // Apply the new role from the invitation
        });
        
        // Mark invitation as accepted
        await storage.updateTeamInvitation(invitation.id, { 
          status: 'accepted', 
          acceptedAt: new Date(),
          acceptedByUserId: userId
        });
        
        return updatedMember;
      }
    }
    
    // Create a new team member
    const teamMember = await storage.createTeamMember({
      teamId: invitation.teamId,
      userId: userId,
      role: invitation.role as "admin" | "user" // Ensure correct type
    });
    
    // Mark invitation as accepted
    await storage.updateTeamInvitation(invitation.id, { 
      status: 'accepted', 
      acceptedAt: new Date(),
      acceptedByUserId: userId
    });
    
    // Log activity
    await logActivity({
      userId,
      teamId: invitation.teamId,
      action: 'accept_invite',
      entityType: 'team_invitation',
      entityId: invitation.id.toString(),
      details: { 
        role: invitation.role
      }
    });
    
    return teamMember;
  } catch (error) {
    console.error('Error accepting team invitation:', error);
    return undefined;
  }
}

/**
 * Send a team invitation email
 * @param invitation - Team invitation
 * @returns Boolean indicating success or failure
 */
export async function sendTeamInvitationEmail(invitation: TeamInvitation): Promise<boolean> {
  try {
    // Get the team for the invitation
    const team = await storage.getTeam(invitation.teamId);
    
    if (!team) {
      console.log(`Team ${invitation.teamId} not found`);
      return false;
    }
    
    // Get the user who sent the invitation
    const inviter = await storage.getUser(invitation.invitedByUserId);
    
    if (!inviter) {
      console.log(`Inviter ${invitation.invitedByUserId} not found`);
      return false;
    }
    
    // Create the invitation URL (frontend will handle the token)
    const currentHost = process.env.REPLIT_DEPLOYMENT_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
    const inviteUrl = `${currentHost}/invite/${invitation.token}`;
    
    // Create email subject
    const subject = `You've been invited to join ${team.name} on BeyondAsk`;
    
    // Create plain text email
    const text = `
    ${inviter.name} has invited you to join ${team.name} on BeyondAsk as a ${invitation.role}.
    
    Click the link below to accept the invitation:
    ${inviteUrl}
    
    This invitation will expire in 48 hours.
    
    If you don't have a BeyondAsk account yet, you'll be guided through the signup process when you click the link above.
    
    If you did not expect this invitation, you can safely ignore this email.
    `;
    
    // Create HTML email
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">BeyondAsk Team Invitation</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="margin-top: 0; color: #111827;">You've been invited to join a team</h2>
        <p style="margin-bottom: 20px; color: #4B5563; font-size: 16px;"><strong>${inviter.name}</strong> has invited you to join <strong>${team.name}</strong> as a <strong>${invitation.role}</strong>.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Accept Invitation</a>
        </div>
        
        <div style="background-color: #F9FAFB; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #111827;">This invitation will expire in <strong>48 hours</strong>.</p>
        </div>
        
        <p style="color: #4B5563; font-size: 15px;">If you don't have a BeyondAsk account yet, you'll be guided through the signup process when you click the button above.</p>
        
        <p style="color: #6B7280; font-size: 14px; margin-top: 25px;">If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
      <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #eaeaea;">
        <p style="color: #6B7280; font-size: 13px; margin: 0;">&copy; ${new Date().getFullYear()} BeyondAsk. All rights reserved.</p>
      </div>
    </div>
    `;
    
    // Send the email
    return await sendEmail(invitation.email, subject, text, html);
  } catch (error) {
    console.error('Error sending team invitation email:', error);
    return false;
  }
}

/**
 * Log an activity for audit trail
 * @param activityData - Activity data to log
 * @returns The created activity log or undefined if failed
 */
export async function logActivity(activityData: InsertActivityLog): Promise<ActivityLog | undefined> {
  try {
    return await storage.createActivityLog(activityData);
  } catch (error) {
    console.error('Error logging activity:', error);
    return undefined;
  }
}

/**
 * Get activity logs for a team
 * @param teamId - Team ID
 * @param userId - User ID making the request (for permission check)
 * @returns Array of activity logs or empty array if unauthorized
 */
export async function getTeamActivityLogs(teamId: number, userId: number): Promise<ActivityLog[]> {
  try {
    // Check if user has admin permissions for this team
    if (!await hasTeamPermission(teamId, userId, 'admin')) {
      console.log(`User ${userId} does not have admin permission for team ${teamId}`);
      return [];
    }
    
    // Get activity logs for the team
    return await storage.getActivityLogsByTeamId(teamId);
  } catch (error) {
    console.error('Error getting team activity logs:', error);
    return [];
  }
}