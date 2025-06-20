import { eq, and, sql, count, inArray, desc, lt, gt, not } from 'drizzle-orm';
import { db } from '../postgresql';
import { randomBytes, randomUUID } from 'crypto';
import {
  Team,
  InsertTeam,
  TeamMember,
  InsertTeamMember,
  TeamInvitation,
  InsertTeamInvitation,
  ActivityLog,
  InsertActivityLog,
  TeamResourcePermission,
  InsertTeamResourcePermission,
  MemberResourcePermission,
  InsertMemberResourcePermission,
  ApiKey,
  InsertApiKey,
  // Database tables
  teams,
  teamMembers,
  teamInvitations,
  activityLogs,
  teamResourcePermissions,
  memberResourcePermissions,
  apiKeys,
} from '../../shared/schema';

/**
 * TeamAdapter - Specialized adapter for team management operations
 * Handles team CRUD, member management, invitations, permissions, and activity logging
 */
export class TeamAdapter {
  
  /**
   * Get team by ID
   */
  async getTeam(id: number): Promise<Team | undefined> {
    console.log(`[TeamAdapter] getTeam: { id: ${id} }`);
    try {
      const results = await db.select().from(teams).where(eq(teams.id, id));
      const result = results.length > 0 ? results[0] : undefined;
      console.log(`[TeamAdapter] getTeam completed: { resultCount: '${result ? 'single' : 'none'}' }`);
      return result;
    } catch (error) {
      console.error('Error getting team:', error);
      return undefined;
    }
  }

  /**
   * Get teams by user ID
   */
  async getTeamsByUserId(userId: number): Promise<Team[]> {
    console.log(`[TeamAdapter] getTeamsByUserId: { userId: ${userId} }`);
    try {
      // Get teams where user is the owner
      const ownedTeams = await db.select().from(teams).where(eq(teams.ownerId, userId));
      
      // Get teams where user is a member
      const memberTeams = await db.select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        ownerId: teams.ownerId,
        settings: teams.settings,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

      // Combine and deduplicate with proper typing
      const allTeams = ownedTeams.map(team => ({
        ...team,
        avatarUrl: null,
        isActive: true
      }));
      memberTeams.forEach(team => {
        if (!allTeams.find(t => t.id === team.id)) {
          allTeams.push({
            id: team.id,
            name: team.name,
            ownerId: team.ownerId,
            description: team.description,
            avatarUrl: null,
            settings: team.settings,
            isActive: true,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt
          });
        }
      });

      console.log(`[TeamAdapter] getTeamsByUserId completed: { resultCount: ${allTeams.length} }`);
      return allTeams;
    } catch (error) {
      console.error('Error getting teams by user ID:', error);
      return [];
    }
  }

  /**
   * Create a new team
   */
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    console.log(`[TeamAdapter] createTeam: { name: '${insertTeam.name}', ownerId: ${insertTeam.ownerId} }`);
    try {
      const [result] = await db.insert(teams).values(insertTeam).returning();
      console.log(`[TeamAdapter] createTeam completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  }

  /**
   * Update team
   */
  async updateTeam(id: number, teamData: Partial<Team>): Promise<Team | undefined> {
    console.log(`[TeamAdapter] updateTeam: { id: ${id} }`);
    try {
      const [result] = await db.update(teams)
        .set({ ...teamData, updatedAt: new Date() })
        .where(eq(teams.id, id))
        .returning();
      
      console.log(`[TeamAdapter] updateTeam completed: { updated: ${!!result} }`);
      return result;
    } catch (error) {
      console.error('Error updating team:', error);
      return undefined;
    }
  }

  /**
   * Delete team
   */
  async deleteTeam(id: number): Promise<boolean> {
    console.log(`[TeamAdapter] deleteTeam: { id: ${id} }`);
    try {
      await db.delete(teams).where(eq(teams.id, id));
      console.log(`[TeamAdapter] deleteTeam completed: { deleted: true }`);
      return true;
    } catch (error) {
      console.error('Error deleting team:', error);
      return false;
    }
  }

  /**
   * Get team member by ID
   */
  async getTeamMember(id: number): Promise<TeamMember | undefined> {
    const results = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return results[0];
  }

  /**
   * Get specific team membership for a user in a team
   */
  async getTeamMemberByTeamAndUser(teamId: number, userId: number): Promise<TeamMember | undefined> {
    const results = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return results[0];
  }

  /**
   * Get team members by team ID
   */
  async getTeamMembersByTeamId(teamId: number): Promise<TeamMember[]> {
    console.log(`[TeamAdapter] getTeamMembersByTeamId: { teamId: ${teamId} }`);
    try {
      const results = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
      console.log(`[TeamAdapter] getTeamMembersByTeamId completed: { resultCount: ${results.length} }`);
      return results;
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  }

  /**
   * Get team members by user ID
   */
  async getTeamMembersByUserId(userId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
  }

  /**
   * Create team member
   */
  async createTeamMember(insertMember: InsertTeamMember): Promise<TeamMember> {
    console.log(`[TeamAdapter] createTeamMember: { teamId: ${insertMember.teamId}, userId: ${insertMember.userId} }`);
    try {
      const [result] = await db.insert(teamMembers).values(insertMember).returning();
      console.log(`[TeamAdapter] createTeamMember completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating team member:', error);
      throw error;
    }
  }

  /**
   * Update team member
   */
  async updateTeamMember(teamId: string | number, userId: string | number, memberData: Partial<TeamMember>): Promise<TeamMember | undefined> {
    const numericTeamId = typeof teamId === 'string' ? parseInt(teamId) : teamId;
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    try {
      const [result] = await db.update(teamMembers)
        .set({ ...memberData, updatedAt: new Date() })
        .where(and(eq(teamMembers.teamId, numericTeamId), eq(teamMembers.userId, numericUserId)))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating team member:', error);
      return undefined;
    }
  }

  /**
   * Delete team member by ID
   */
  async deleteTeamMember(id: number): Promise<boolean> {
    try {
      await db.delete(teamMembers).where(eq(teamMembers.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting team member:', error);
      return false;
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(teamId: string | number, userId: string | number): Promise<boolean> {
    const numericTeamId = typeof teamId === 'string' ? parseInt(teamId) : teamId;
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    
    try {
      await db.delete(teamMembers)
        .where(and(eq(teamMembers.teamId, numericTeamId), eq(teamMembers.userId, numericUserId)));
      return true;
    } catch (error) {
      console.error('Error removing team member:', error);
      return false;
    }
  }

  /**
   * Get team invitation by ID
   */
  async getTeamInvitation(id: number): Promise<TeamInvitation | undefined> {
    const results = await db.select().from(teamInvitations).where(eq(teamInvitations.id, id));
    return results[0];
  }

  /**
   * Get team invitations by team ID
   */
  async getTeamInvitationsByTeamId(teamId: number): Promise<TeamInvitation[]> {
    return await db.select().from(teamInvitations).where(eq(teamInvitations.teamId, teamId));
  }

  /**
   * Get team invitations by email
   */
  async getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    return await db.select().from(teamInvitations).where(eq(teamInvitations.email, email));
  }

  /**
   * Create team invitation
   */
  async createTeamInvitation(insertInvitation: InsertTeamInvitation): Promise<TeamInvitation> {
    console.log(`[TeamAdapter] createTeamInvitation: { teamId: ${insertInvitation.teamId}, email: '${insertInvitation.email}' }`);
    try {
      const invitationData = {
        email: insertInvitation.email,
        token: randomUUID(),
        role: insertInvitation.role,
        expiresAt: insertInvitation.expiresAt,
        teamId: insertInvitation.teamId,
        invitedByUserId: insertInvitation.invitedByUserId,
        status: 'pending' as const
      };
      const [result] = await db.insert(teamInvitations).values(invitationData).returning();
      console.log(`[TeamAdapter] createTeamInvitation completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating team invitation:', error);
      throw error;
    }
  }

  /**
   * Update team invitation
   */
  async updateTeamInvitation(id: number, invitationData: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    try {
      const [result] = await db.update(teamInvitations)
        .set({ ...invitationData, updatedAt: new Date() })
        .where(eq(teamInvitations.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating team invitation:', error);
      return undefined;
    }
  }

  /**
   * Delete team invitation
   */
  async deleteTeamInvitation(id: number): Promise<boolean> {
    try {
      await db.delete(teamInvitations).where(eq(teamInvitations.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting team invitation:', error);
      return false;
    }
  }

  /**
   * Create activity log
   */
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    try {
      const [result] = await db.insert(activityLogs).values(insertLog).returning();
      return result;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  /**
   * Get activity logs by team ID
   */
  async getActivityLogsByTeamId(teamId: number, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const results = await db.select()
        .from(activityLogs)
        .where(eq(activityLogs.teamId, teamId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting activity logs by team ID:', error);
      return [];
    }
  }

  /**
   * Get activity logs by user ID
   */
  async getActivityLogsByUserId(userId: number, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const results = await db.select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error('Error getting activity logs by user ID:', error);
      return [];
    }
  }

  /**
   * Create team resource permission
   */
  async createTeamResourcePermission(insertPermission: InsertTeamResourcePermission): Promise<TeamResourcePermission> {
    try {
      const [result] = await db.insert(teamResourcePermissions).values(insertPermission).returning();
      return result;
    } catch (error) {
      console.error('Error creating team resource permission:', error);
      throw error;
    }
  }

  /**
   * Get team resource permissions by team ID
   */
  async getTeamResourcePermissionsByTeamId(teamId: number): Promise<TeamResourcePermission[]> {
    return await db.select().from(teamResourcePermissions).where(eq(teamResourcePermissions.teamId, teamId));
  }

  /**
   * Create member resource permission
   */
  async createMemberResourcePermission(insertPermission: InsertMemberResourcePermission): Promise<MemberResourcePermission> {
    try {
      const [result] = await db.insert(memberResourcePermissions).values(insertPermission).returning();
      return result;
    } catch (error) {
      console.error('Error creating member resource permission:', error);
      throw error;
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKey(id: number): Promise<ApiKey | undefined> {
    const results = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return results[0];
  }

  /**
   * Get API keys by user ID
   */
  async getApiKeysByUserId(userId: number): Promise<ApiKey[]> {
    console.log(`[TeamAdapter] getApiKeysByUserId: { userId: ${userId} }`);
    try {
      const results = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
      console.log(`[TeamAdapter] getApiKeysByUserId completed: { resultCount: ${results.length} }`);
      return results;
    } catch (error) {
      console.error('Error getting API keys by user ID:', error);
      return [];
    }
  }

  /**
   * Create API key
   */
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    console.log(`[TeamAdapter] createApiKey: { name: '${insertApiKey.name}', userId: ${insertApiKey.userId} }`);
    try {
      const scopesArray: string[] = insertApiKey.scopes ? 
        (Array.isArray(insertApiKey.scopes) ? insertApiKey.scopes as string[] : Object.values(insertApiKey.scopes).filter(v => typeof v === 'string') as string[]) : 
        ['agent:read', 'agent:chat'];
      
      const apiKeyData = {
        name: insertApiKey.name,
        keyPrefix: `beyask_${insertApiKey.name.toLowerCase().replace(/\s+/g, '_').substring(0, 8)}`,
        keyHash: randomBytes(32).toString('hex'),
        userId: insertApiKey.userId!,
        teamId: insertApiKey.teamId,
        scopes: scopesArray,
        expiresAt: insertApiKey.expiresAt,
        rateLimit: insertApiKey.rateLimit,
        revoked: insertApiKey.revoked || false
      };
      const [result] = await db.insert(apiKeys).values(apiKeyData).returning();
      console.log(`[TeamAdapter] createApiKey completed: { id: ${result.id} }`);
      return result;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw error;
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(id: number, apiKeyData: Partial<ApiKey>): Promise<ApiKey | undefined> {
    try {
      const [result] = await db.update(apiKeys)
        .set(apiKeyData)
        .where(eq(apiKeys.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating API key:', error);
      return undefined;
    }
  }

  /**
   * Update API key last used timestamp
   */
  async updateApiKeyLastUsed(id: number): Promise<boolean> {
    try {
      await db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, id));
      return true;
    } catch (error) {
      console.error('Error updating API key last used:', error);
      return false;
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(id: number): Promise<boolean> {
    try {
      await db.update(apiKeys)
        .set({ revoked: true })
        .where(eq(apiKeys.id, id));
      return true;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }

  /**
   * Check if user is team member
   */
  async isTeamMember(teamId: number, userId: number): Promise<boolean> {
    try {
      const result = await db.select({ count: count() })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId), 
          eq(teamMembers.userId, userId),
          eq(teamMembers.status, 'active')
        ));
      
      return (result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('Error checking team membership:', error);
      return false;
    }
  }

  /**
   * Check if user is team owner
   */
  async isTeamOwner(teamId: number, userId: number): Promise<boolean> {
    try {
      const team = await this.getTeam(teamId);
      return team?.ownerId === userId;
    } catch (error) {
      console.error('Error checking team ownership:', error);
      return false;
    }
  }

  /**
   * Get team statistics
   */
  async getTeamStats(teamId: number): Promise<{
    memberCount: number;
    pendingInvitations: number;
    recentActivity: number;
    resourcePermissions: number;
  }> {
    try {
      const [memberResult, invitationResult, activityResult, permissionResult] = await Promise.all([
        db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, teamId)),
        db.select({ count: count() }).from(teamInvitations).where(
          and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, 'pending'))
        ),
        db.select({ count: count() }).from(activityLogs).where(
          and(eq(activityLogs.teamId, teamId), gt(activityLogs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        ),
        db.select({ count: count() }).from(teamResourcePermissions).where(eq(teamResourcePermissions.teamId, teamId))
      ]);

      return {
        memberCount: memberResult[0]?.count || 0,
        pendingInvitations: invitationResult[0]?.count || 0,
        recentActivity: activityResult[0]?.count || 0,
        resourcePermissions: permissionResult[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting team stats:', error);
      return { memberCount: 0, pendingInvitations: 0, recentActivity: 0, resourcePermissions: 0 };
    }
  }
}