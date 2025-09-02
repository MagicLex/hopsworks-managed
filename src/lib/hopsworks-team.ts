// Hopsworks team and project management functions

import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from './hopsworks-api';

// Disable SSL verification for self-signed certificates
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

interface HopsworksCredentials {
  apiUrl: string;
  apiKey: string;
}

/**
 * Add a user to a project with a specific role
 */
export async function addUserToProject(
  credentials: HopsworksCredentials,
  projectName: string,
  username: string,
  role: 'Data owner' | 'Data scientist' | 'Data engineer' = 'Data scientist'
): Promise<void> {
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${projectName}/projectMembers`,
    {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        projectRole: role
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add user to project: ${response.statusText} - ${errorText}`);
  }
}

/**
 * Create group mapping for OAuth users
 * This allows automatic project access based on OAuth groups
 */
export async function createGroupMapping(
  credentials: HopsworksCredentials,
  projectName: string,
  groupNames: string[],
  role: 'Data owner' | 'Data scientist' | 'Data engineer' = 'Data scientist'
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
        group: groupNames,
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
 * Get all projects for a user
 */
export async function getUserProjects(
  credentials: HopsworksCredentials,
  username: string
): Promise<any[]> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}/projects`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch user projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Add team member to owner's default project
 */
export async function addTeamMemberToOwnerProjects(
  credentials: HopsworksCredentials,
  teamMemberUsername: string,
  ownerUsername: string,
  role: 'Data scientist' | 'Data engineer' = 'Data scientist'
): Promise<{ success: boolean; projects: string[] }> {
  try {
    // Get owner's projects
    const ownerProjects = await getUserProjects(credentials, ownerUsername);
    
    if (ownerProjects.length === 0) {
      console.log(`Owner ${ownerUsername} has no projects yet`);
      return { success: false, projects: [] };
    }

    const addedToProjects: string[] = [];
    
    // Add team member to each of owner's projects
    for (const project of ownerProjects) {
      try {
        await addUserToProject(credentials, project.name, teamMemberUsername, role);
        addedToProjects.push(project.name);
        console.log(`Added ${teamMemberUsername} to project ${project.name} as ${role}`);
      } catch (error) {
        console.error(`Failed to add ${teamMemberUsername} to project ${project.name}:`, error);
      }
    }

    return { 
      success: addedToProjects.length > 0, 
      projects: addedToProjects 
    };
  } catch (error) {
    console.error('Failed to add team member to owner projects:', error);
    return { success: false, projects: [] };
  }
}

/**
 * Create a shared team project
 */
export async function createTeamProject(
  credentials: HopsworksCredentials,
  ownerUsername: string,
  projectName: string,
  teamMembers: { username: string; role?: string }[]
): Promise<void> {
  // First create the project (owner already has it from hopsworks-api.ts createHopsworksProject)
  
  // Then add all team members
  for (const member of teamMembers) {
    try {
      await addUserToProject(
        credentials, 
        projectName, 
        member.username, 
        (member.role as any) || 'Data scientist'
      );
      console.log(`Added ${member.username} to team project ${projectName}`);
    } catch (error) {
      console.error(`Failed to add ${member.username} to team project:`, error);
    }
  }
}