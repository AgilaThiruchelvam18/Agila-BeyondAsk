import { Team, InsertTeam, TeamMember, InsertTeamMember, TeamInvitation, InsertTeamInvitation } from '../../shared/schema';

/**
 * Team Storage Interface
 * Defines all team-related database operations with consistent signatures
 */
export interface ITeamStorage {
  // Core Team CRUD operations
  getTeam(id: string | number): Promise<Team | undefined>;
  getTeamsByUserId(userId: string | number): Promise<Team[]>;
  createTeam(insertTeam: InsertTeam): Promise<Team>;
  updateTeam(id: string | number, teamData: Partial<Team>): Promise<Team | undefined>;
  deleteTeam(id: string | number): Promise<boolean>;
  
  // Team Member operations
  getTeamMembers(teamId: string | number): Promise<TeamMember[]>;
  getTeamMember(teamId: string | number, userId: string | number): Promise<TeamMember | undefined>;
  addTeamMember(insertMember: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(teamId: string | number, userId: string | number, memberData: Partial<TeamMember>): Promise<TeamMember | undefined>;
  removeTeamMember(teamId: string | number, userId: string | number): Promise<boolean>;
  isTeamMember(teamId: string | number, userId: string | number): Promise<boolean>;
  
  // Team Invitation operations
  getTeamInvitations(teamId: string | number): Promise<TeamInvitation[]>;
  getTeamInvitation(id: string | number): Promise<TeamInvitation | undefined>;
  getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined>;
  createTeamInvitation(insertInvitation: InsertTeamInvitation): Promise<TeamInvitation>;
  updateTeamInvitation(id: string | number, invitationData: Partial<TeamInvitation>): Promise<TeamInvitation | undefined>;
  deleteTeamInvitation(id: string | number): Promise<boolean>;
  
  // Advanced team operations
  searchTeams(params: {
    query?: string;
    userId?: number;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Team[]>;
  
  getTeamStats(teamId: string | number): Promise<{
    memberCount: number;
    activeInvitations: number;
    createdAt: Date;
    lastActivity: Date | null;
  }>;
  
  getUserTeamRole(teamId: string | number, userId: string | number): Promise<string | null>;
  getTeamsByRole(userId: string | number, role: string): Promise<Team[]>;
}