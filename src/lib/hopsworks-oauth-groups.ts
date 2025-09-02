// Hopsworks OAuth Group Management
// This is the PROPER way to manage team access to projects

import { ADMIN_API_BASE } from './hopsworks-api';

interface HopsworksCredentials {
  apiUrl: string;
  apiKey: string;
}

/**
 * Create or update OAuth group mapping for a project
 * This is the recommended way to manage team access
 * 
 * Example: Map all users in "team-owner-123" group to "Data scientist" role in "ml_project"
 */
export async function createProjectGroupMapping(
  credentials: HopsworksCredentials,
  projectName: string,
  groupName: string,
  role: 'Data owner' | 'Data scientist' | 'Observer' = 'Data scientist'
): Promise<void> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/group/mapping/bulk`,
    {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectName,
        group: [groupName], // Array of group names
        projectRole: role,
        groupType: 'OAUTH'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create group mapping: ${response.statusText} - ${errorText}`);
  }
}

/**
 * Create team group mappings for all owner's projects
 * This maps a team group to all projects owned by an account
 */
export async function createTeamGroupMappings(
  credentials: HopsworksCredentials,
  ownerUserId: string,
  projects: Array<{ name: string; id: number }>,
  defaultRole: 'Data owner' | 'Data scientist' | 'Observer' = 'Data scientist'
): Promise<{ success: boolean; mappedProjects: string[]; errors: string[] }> {
  const groupName = `team_${ownerUserId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const mappedProjects: string[] = [];
  const errors: string[] = [];

  for (const project of projects) {
    try {
      await createProjectGroupMapping(credentials, project.name, groupName, defaultRole);
      mappedProjects.push(project.name);
      console.log(`Created group mapping for ${groupName} -> ${project.name} as ${defaultRole}`);
    } catch (error: any) {
      errors.push(`Failed to map ${project.name}: ${error.message}`);
      console.error(`Failed to create mapping for project ${project.name}:`, error);
    }
  }

  return {
    success: mappedProjects.length > 0,
    mappedProjects,
    errors
  };
}

/**
 * Remove group mapping for a project
 */
export async function removeProjectGroupMapping(
  credentials: HopsworksCredentials,
  projectName: string,
  groupName: string
): Promise<void> {
  // Note: This endpoint might not exist, need to check Hopsworks API
  // For now, we can only add mappings, not remove them
  console.warn('Remove group mapping not yet implemented - check Hopsworks API');
}

/**
 * Get all group mappings for a project
 */
export async function getProjectGroupMappings(
  credentials: HopsworksCredentials,
  projectName: string
): Promise<any[]> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/group/mapping?projectName=${projectName}`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch group mappings: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.items || data || [];
}