// Hopsworks team and project management functions

import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from './hopsworks-api';
import { validateProject } from './hopsworks-validation';

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
 * FOR OAUTH USERS: This uses group mappings which is the ONLY way that works
 */
export async function addUserToProject(
  credentials: HopsworksCredentials,
  projectName: string,
  username: string,
  role: 'Data owner' | 'Data scientist' | 'Observer' = 'Data scientist'
): Promise<void> {
  // VALIDATE PROJECT EXISTS FIRST
  const project = await validateProject(credentials, projectName);
  if (!project) {
    throw new Error(`Project '${projectName}' does not exist in Hopsworks`);
  }
  
  // OAuth users MUST use group mappings - individual user adds don't work
  // Create a unique group for this specific user-project combination
  const userGroup = `user_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  console.log(`Adding user ${username} to project ${projectName} (id: ${project.id}) via group mapping ${userGroup}`);
  
  // Use the group mapping endpoint - this is what actually works
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
        group: [userGroup], // Array of group names
        projectRole: role,
        groupType: 'OAUTH'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to create group mapping for ${username}:`, errorText);
    
    // Check if it's a project not found error
    if (errorText.includes('404') || errorText.includes('Not Found')) {
      throw new Error(`Project '${projectName}' not found or inaccessible`);
    }
    
    throw new Error(`Failed to add user to project via group mapping: ${response.statusText} - ${errorText}`);
  }
  
  console.log(`Successfully added ${username} to ${projectName} as ${role} via group ${userGroup}`);
}

// createGroupMapping removed - use addUserToProject which now uses group mappings internally

/**
 * Get all projects from the cluster
 * Since we use an admin API key, this should return all projects
 */
export async function getUserProjects(
  credentials: HopsworksCredentials,
  username: string
): Promise<any[]> {
  try {
    // Try admin endpoint to get ALL projects
    const adminResponse = await fetch(
      `${credentials.apiUrl}${ADMIN_API_BASE}/projects`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      }
    );
    
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      // Return all projects for now - we can filter by owner later if needed
      return adminData.items || adminData || [];
    }
  } catch (error) {
    console.error('Failed to fetch from admin endpoint:', error);
  }

  try {
    // Fallback: try regular project endpoint
    const response = await fetch(
      `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Handle both array response and object with items
      return Array.isArray(data) ? data : (data.items || []);
    }
  } catch (error) {
    console.error('Failed to fetch from project endpoint:', error);
  }

  // If all else fails, return empty array
  console.log(`No projects found for user ${username}`);
  return [];
}

// addTeamMemberToOwnerProjects removed - use addUserToProject directly

// createTeamProject removed - use addUserToProject directly for each member