import { storage } from '../storage';
import { ResourceType } from '@shared/schema';
import * as teamManagementService from './team_management_service';

/**
 * Get all resources a user has access to, including their own resources and 
 * those shared via team permissions
 * @param userId User ID
 * @param resourceType Resource type ('agent' or 'knowledgeBase')
 * @returns Array of resource IDs
 */
export async function getUserAccessibleResources(userId: number, resourceType: ResourceType): Promise<number[]> {
  try {
    console.log(`[PERF] getUserAccessibleResources: Starting lookup for user ${userId}, resource ${resourceType}`);
    const startTime = Date.now();
    
    // Start with an empty set to avoid duplicates
    const accessibleResourceIds = new Set<number>();
    
    // SUPER OPTIMIZED: Get team and member permissions in parallel (team lookup is now embedded in permission queries)
    const [teamPermissions, memberPermissions] = await Promise.all([
      storage.getUserTeamResourcePermissions(userId, resourceType), // Already includes team membership check
      storage.getUserMemberResourcePermissions(userId, resourceType) // Already includes membership check
    ]);
    
    // Get team count from the permissions (no separate query needed)
    const uniqueTeamIds = new Set(teamPermissions.map(p => p.teamId));
    console.log(`[PERF] getUserAccessibleResources: Got ${uniqueTeamIds.size} teams, ${teamPermissions.length} team perms, ${memberPermissions.length} member perms`);
    
    // Add team-level permissions
    teamPermissions.forEach(perm => accessibleResourceIds.add(perm.resourceId));
    
    // Add member-specific permissions
    memberPermissions.forEach(perm => accessibleResourceIds.add(perm.resourceId));
    
    const endTime = Date.now();
    const result = Array.from(accessibleResourceIds);
    console.log(`[PERF] getUserAccessibleResources: Completed in ${endTime - startTime}ms, found ${result.length} accessible resources`);
    
    return result;
  } catch (error) {
    console.error(`Error getting user accessible ${resourceType}s:`, error);
    return [];
  }
}

/**
 * Get all resource permissions for a team
 * @param teamId Team ID
 * @param resourceType Optional resource type filter
 * @returns Array of resource permissions
 */
export async function getTeamResourcePermissions(teamId: number, resourceType?: ResourceType) {
  return await storage.getTeamResourcePermissionsByTeamId(teamId, resourceType);
}

/**
 * Check if a team has permission to access a specific resource
 * @param teamId Team ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @returns Boolean indicating whether the team has permission
 */
export async function hasResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
  const permission = await storage.getTeamResourcePermission(teamId, resourceType, resourceId);
  return !!permission;
}

/**
 * Grant permission to a team for a specific resource
 * @param teamId Team ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @param userId User ID (creator)
 * @returns Created resource permission
 */
export async function grantResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number, userId: number) {
  // Check if permission already exists
  const existing = await storage.getTeamResourcePermission(teamId, resourceType, resourceId);
  if (existing) {
    return existing; // Permission already exists
  }

  // Create new permission
  return await storage.createTeamResourcePermission({
    teamId,
    resourceType,
    resourceId,
    createdBy: userId
  });
}

/**
 * Grant permission to a team for a specific resource - Alias for grantResourcePermission
 * Maintained for backward compatibility with existing API
 */
export async function grantTeamResourceAccess(teamId: number, resourceType: ResourceType, resourceId: number, userId: number) {
  return await grantResourcePermission(teamId, resourceType, resourceId, userId);
}

/**
 * Revoke permission from a team for a specific resource
 * @param teamId Team ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @returns Boolean indicating success
 */
export async function revokeResourcePermission(teamId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
  return await storage.deleteTeamResourcePermission(teamId, resourceType, resourceId);
}

/**
 * Revoke permission from a team for a specific resource - Alias for revokeResourcePermission
 * Maintained for backward compatibility with existing API
 */
export async function revokeTeamResourceAccess(teamId: number, resourceType: ResourceType, resourceId: number, _userId?: number): Promise<boolean> {
  return await revokeResourcePermission(teamId, resourceType, resourceId);
}

/**
 * Get all resources of a specific type that a team has access to
 * @param teamId Team ID
 * @param resourceType Resource type
 * @returns Array of resource IDs
 */
export async function getTeamAccessibleResources(teamId: number, resourceType: ResourceType): Promise<number[]> {
  const permissions = await storage.getTeamResourcePermissionsByTeamId(teamId, resourceType);
  return permissions.map(permission => permission.resourceId);
}

/**
 * Check if a member has permission to access a specific resource
 * @param teamId Team ID
 * @param userId User ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @returns Boolean indicating whether the member has permission
 */
export async function hasMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
  const permission = await storage.getMemberResourcePermission(teamId, userId, resourceType, resourceId);
  return !!permission;
}

/**
 * Grant permission to a team member for a specific resource
 * @param teamId Team ID
 * @param userId User ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @param createdBy User ID of the creator (admin)
 * @returns Created resource permission
 */
export async function grantMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number, createdBy: number) {
  // Check if permission already exists
  const existing = await storage.getMemberResourcePermission(teamId, userId, resourceType, resourceId);
  if (existing) {
    return existing; // Permission already exists
  }

  // Create new permission
  return await storage.createMemberResourcePermission({
    teamId,
    userId,
    resourceType,
    resourceId,
    createdBy
  });
}

/**
 * Grant permission to a team member for a specific resource - Alias for grantMemberResourcePermission
 * Maintained for backward compatibility with existing API
 */
export async function grantMemberResourceAccess(teamId: number, userId: number, resourceType: ResourceType, resourceId: number, createdBy: number) {
  return await grantMemberResourcePermission(teamId, userId, resourceType, resourceId, createdBy);
}

/**
 * Revoke permission from a team member for a specific resource
 * @param teamId Team ID
 * @param userId User ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @returns Boolean indicating success
 */
export async function revokeMemberResourcePermission(teamId: number, userId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
  return await storage.deleteMemberResourcePermission(teamId, userId, resourceType, resourceId);
}

/**
 * Revoke permission from a team member for a specific resource - Alias for revokeMemberResourcePermission
 * Maintained for backward compatibility with existing API
 */
export async function revokeMemberResourceAccess(teamId: number, userId: number, resourceType: ResourceType, resourceId: number, _createdBy?: number): Promise<boolean> {
  return await revokeMemberResourcePermission(teamId, userId, resourceType, resourceId);
}

/**
 * Get all resources of a specific type that a team member has access to
 * @param teamId Team ID
 * @param userId User ID
 * @param resourceType Resource type
 * @returns Array of resource IDs
 */
export async function getMemberAccessibleResources(teamId: number, userId: number, resourceType: ResourceType): Promise<number[]> {
  const permissions = await storage.getMemberResourcePermissionsByTeamAndUser(teamId, userId, resourceType);
  return permissions.map(permission => permission.resourceId);
}