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
 * FOR OAUTH USERS: Use group mappings via admin endpoint
 * FALLBACK: Try direct project member endpoint if group mapping fails
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

  // Get user email from username (OAuth users have email-based identifiers)
  const userResponse = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      }
    }
  );

  if (!userResponse.ok) {
    throw new Error(`User ${username} not found in Hopsworks`);
  }

  const userData = await userResponse.json();
  const userEmail = userData.email;

  console.log(`Adding user ${username} (${userEmail}) to project ${projectName} (id: ${project.id}) as ${role}`);

  // Try the project members endpoint directly (works with OAuth users)
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/projectMembers/${encodeURIComponent(userEmail)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectTeam: role
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to add user to project:`, errorText);

    // Check if it's a project not found error
    if (errorText.includes('404') || errorText.includes('Not Found')) {
      throw new Error(`Project '${projectName}' not found or inaccessible`);
    }

    // Check if user is already a member
    if (errorText.includes('already') || errorText.includes('exist')) {
      console.log(`User ${username} is already a member of ${projectName}`);
      return; // Not an error if already member
    }

    throw new Error(`Failed to add user to project: ${response.statusText} - ${errorText}`);
  }

  console.log(`Successfully added ${username} to ${projectName} as ${role}`);
}

// createGroupMapping removed - use addUserToProject which now uses group mappings internally

/**
 * Get projects owned by a specific user
 * Filters projects by owner identifier (email or username)
 * Note: Hopsworks stores project.owner as email for OAuth users
 */
export async function getUserProjects(
  credentials: HopsworksCredentials,
  ownerIdentifier: string
): Promise<any[]> {
  try {
    // Get ALL projects via admin endpoint
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
      const allProjects = adminData.items || adminData || [];

      // Filter to only projects owned by this identifier (email or username)
      const userProjects = allProjects.filter((project: any) => {
        // owner can be an object {username: "foo"} or a string "foo"
        const projectOwner = typeof project.owner === 'object'
          ? project.owner?.username
          : project.owner;

        // Debug: log first project to see structure
        if (allProjects.indexOf(project) === 0) {
          console.log('Sample project structure:', JSON.stringify({
            name: project.name,
            owner: project.owner,
            ownerType: typeof project.owner,
            extractedOwner: projectOwner
          }));
        }

        return projectOwner === ownerIdentifier;
      });

      console.log(`Found ${userProjects.length} projects owned by ${ownerIdentifier} (out of ${allProjects.length} total)`);
      return userProjects;
    }
  } catch (error) {
    console.error('Failed to fetch from admin endpoint:', error);
  }

  try {
    // Fallback: try regular project endpoint (already filtered by user auth)
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
      const projects = Array.isArray(data) ? data : (data.items || []);

      // Filter by owner just in case
      return projects.filter((project: any) => {
        const projectOwner = typeof project.owner === 'object'
          ? project.owner?.username
          : project.owner;
        return projectOwner === ownerIdentifier;
      });
    }
  } catch (error) {
    console.error('Failed to fetch from project endpoint:', error);
  }

  // If all else fails, return empty array
  console.log(`No projects found for owner ${ownerIdentifier}`);
  return [];
}

// addTeamMemberToOwnerProjects removed - use addUserToProject directly

// createTeamProject removed - use addUserToProject directly for each member