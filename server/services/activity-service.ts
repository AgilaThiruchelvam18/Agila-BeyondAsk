/**
 * Activity Service
 * Simple implementation to log user activities
 */

/**
 * Interface for activity log parameters
 */
interface ActivityLogParams {
  teamId: number | null;
  userId: number;
  actionType: string;
  resourceType: string;
  resourceId: string | number;
  details?: any;
}

/**
 * Simple activity service that just logs to console
 * This can be enhanced later to store activity logs in the database
 */
class ActivityService {
  /**
   * Log an activity
   */
  async logActivity(params: ActivityLogParams): Promise<void> {
    // For now, just log to console
    console.log(`[Activity Log] User ${params.userId} ${params.actionType} ${params.resourceType}:${params.resourceId} ${params.teamId ? `in team ${params.teamId}` : ''}`);
    
    if (params.details) {
      console.log(`[Activity Details] ${JSON.stringify(params.details)}`);
    }
    
    // In the future, this could store to database
  }
}

// Create a singleton instance
export const activityService = new ActivityService();