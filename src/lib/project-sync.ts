import { createClient } from '@supabase/supabase-js';
import { getHopsworksUserByAuth0Id, getUserProjects } from './hopsworks-api';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProjectSyncResult {
  success: boolean;
  projectsFound: number;
  projectsSynced: number;
  error?: string;
}

/**
 * Syncs a user's projects from Hopsworks to our database
 * This is CRITICAL for billing accuracy as we bill per project
 */
export async function syncUserProjects(userId: string): Promise<ProjectSyncResult> {
  try {
    // Get user with cluster assignment
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        email,
        hopsworks_username,
        account_owner_id,
        user_hopsworks_assignments (
          hopsworks_clusters (
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return { 
        success: false, 
        projectsFound: 0, 
        projectsSynced: 0, 
        error: 'User not found' 
      };
    }

    // Skip team members - they get access via project_member_roles
    if (userData.account_owner_id) {
      return { 
        success: true, 
        projectsFound: 0, 
        projectsSynced: 0 
      };
    }

    // Check for cluster assignment
    if (!userData.user_hopsworks_assignments?.[0]?.hopsworks_clusters) {
      return { 
        success: false, 
        projectsFound: 0, 
        projectsSynced: 0, 
        error: 'No cluster assignment' 
      };
    }

    const clusterData = userData.user_hopsworks_assignments[0].hopsworks_clusters;
    const cluster = Array.isArray(clusterData) ? clusterData[0] : clusterData;
    
    if (!cluster || !userData.hopsworks_username) {
      return { 
        success: false, 
        projectsFound: 0, 
        projectsSynced: 0, 
        error: 'Missing cluster or username' 
      };
    }

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    // Get Hopsworks user
    const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, userData.email);
    if (!hopsworksUser) {
      return { 
        success: false, 
        projectsFound: 0, 
        projectsSynced: 0, 
        error: 'User not found in Hopsworks' 
      };
    }

    // Get user's projects from Hopsworks
    const projects = await getUserProjects(credentials, userData.hopsworks_username, hopsworksUser.id);
    
    if (projects.length === 0) {
      // User has no projects, clean up any stale entries
      await supabaseAdmin
        .from('user_projects')
        .delete()
        .eq('user_id', userId);
      
      return { 
        success: true, 
        projectsFound: 0, 
        projectsSynced: 0 
      };
    }

    // Prepare projects for upsert
    // Note: Kubernetes namespaces are just the project name (e.g., 'hellomot', not 'project-hellomot')
    const projectsToUpsert = projects.map(p => ({
      user_id: userId,
      project_id: p.id,
      project_name: p.name,
      namespace: p.name, // Use actual K8s namespace name
      status: 'active' as const,
      last_seen_at: new Date().toISOString()
    }));

    // Get existing project IDs for this user
    const { data: existingProjects } = await supabaseAdmin
      .from('user_projects')
      .select('project_id')
      .eq('user_id', userId);

    const existingProjectIds = new Set(existingProjects?.map(p => p.project_id) || []);
    const currentProjectIds = new Set(projects.map(p => p.id));

    // Mark projects as inactive if they no longer exist in Hopsworks (keep for audit trail)
    const projectsToDeactivate = Array.from(existingProjectIds).filter(id => !currentProjectIds.has(id));
    if (projectsToDeactivate.length > 0) {
      await supabaseAdmin
        .from('user_projects')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .in('project_id', projectsToDeactivate);
      
      console.log(`Marked ${projectsToDeactivate.length} projects as inactive for user ${userId}`);
    }

    // Upsert current projects
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('user_projects')
      .upsert(projectsToUpsert, { 
        onConflict: 'user_id,project_id',
        ignoreDuplicates: false 
      })
      .select();

    if (upsertError) {
      console.error('Failed to sync projects:', upsertError);
      return { 
        success: false, 
        projectsFound: projects.length, 
        projectsSynced: 0, 
        error: upsertError.message 
      };
    }

    return { 
      success: true, 
      projectsFound: projects.length, 
      projectsSynced: upsertData?.length || 0 
    };

  } catch (error) {
    console.error('Project sync error:', error);
    return { 
      success: false, 
      projectsFound: 0, 
      projectsSynced: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Syncs all team member projects for an account owner
 * This ensures team members have access to the right projects
 */
export async function syncTeamMemberProjects(accountOwnerId: string): Promise<ProjectSyncResult> {
  try {
    // Get all team members
    const { data: teamMembers } = await supabaseAdmin
      .from('users')
      .select('id, hopsworks_username')
      .eq('account_owner_id', accountOwnerId)
      .not('hopsworks_username', 'is', null);

    if (!teamMembers || teamMembers.length === 0) {
      return { 
        success: true, 
        projectsFound: 0, 
        projectsSynced: 0 
      };
    }

    let totalFound = 0;
    let totalSynced = 0;

    // Sync each team member
    for (const member of teamMembers) {
      const result = await syncUserProjects(member.id);
      totalFound += result.projectsFound;
      totalSynced += result.projectsSynced;
    }

    return { 
      success: true, 
      projectsFound: totalFound, 
      projectsSynced: totalSynced 
    };

  } catch (error) {
    console.error('Team sync error:', error);
    return { 
      success: false, 
      projectsFound: 0, 
      projectsSynced: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}