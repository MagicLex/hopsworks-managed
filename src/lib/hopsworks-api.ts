// Hopsworks API integration
// Based on patterns from hopsworks-cloud

export const HOPSWORKS_API_BASE = '/hopsworks-api/api';
export const ADMIN_API_BASE = '/hopsworks-api/api/admin';

// For self-signed certificates in both dev and production
// This is needed because Hopsworks uses self-signed certs
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Create HTTPS agent for environments that support it
let httpsAgent: any = undefined;
if (typeof process !== 'undefined' && process.versions?.node) {
  const https = require('https');
  httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });
}

interface HopsworksCredentials {
  apiUrl: string;
  apiKey: string;
}

interface HopsworksUser {
  username: string;
  email: string;
  id: number;
  firstname?: string;
  lastname?: string;
  accountType?: string;
  status?: number;
  maxNumProjects?: number;
  numActiveProjects?: number;
  activated?: string;
  twoFactor?: boolean;
  toursState?: number;
  href?: string;
}

interface HopsworksProject {
  id: number;
  name: string;
  owner: string;
  created: string;
}

interface ProjectUsage {
  date: string;
  compute: {
    instances: Array<{
      type: string;
      hours: number;
      cpuHours: number;
      gpuHours: number;
    }>;
  };
  storage: {
    featureStore: number;
    models: number;
    datasets: number;
    total: number;
  };
  apiCalls: {
    featureStore: number;
    modelServing: number;
    jobs: number;
    total: number;
  };
}

/**
 * Create an OAuth user in Hopsworks
 */
export async function createHopsworksOAuthUser(
  credentials: HopsworksCredentials,
  email: string,
  firstName: string,
  lastName: string,
  auth0Id: string,
  maxNumProjects: number = 0
): Promise<HopsworksUser> {
  // Build query parameters - accountType must be in query string
  const params = new URLSearchParams({
    accountType: 'REMOTE_ACCOUNT_TYPE',
    type: 'OAUTH2',
    clientId: process.env.AUTH0_CLIENT_ID!,
    subject: auth0Id,
    email,
    givenName: firstName,
    surname: lastName,
    maxNumProjects: maxNumProjects.toString(),
    status: 'ACTIVATED'
  });
  
  const response = await fetch(`${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/users?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${credentials.apiKey}`
    },
    // @ts-ignore - Node.js fetch doesn't have proper agent typing
    agent: httpsAgent
  });

  if (!response.ok) {
    let errorDetails = response.statusText;
    try {
      const errorBody = await response.text();
      errorDetails = errorBody || response.statusText;
    } catch (e) {
      // Keep original error if can't parse response
    }
    throw new Error(`Failed to create Hopsworks user: ${errorDetails}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Create a project for a user
 */
export async function createHopsworksProject(
  credentials: HopsworksCredentials,
  username: string,
  projectName: string
): Promise<void> {
  const response = await fetch(`${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/projects/createas`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${credentials.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      owner: username,
      projectName,
      services: ['JOBS', 'HIVE', 'KAFKA', 'FEATURESTORE', 'SERVING']
    }),
    // @ts-ignore
    agent: httpsAgent
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Project name already exists');
    }
    throw new Error(`Failed to create project: ${response.statusText}`);
  }
}

/**
 * Get user's projects (both owned and member of)
 */
export async function getUserProjects(
  credentials: HopsworksCredentials,
  username: string,
  userId?: number
): Promise<HopsworksProject[]> {
  try {
    // First try to get projects where user is a member
    const memberUrl = `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}/projects`;
    
    const memberResponse = await fetch(
      memberUrl,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        },
        // @ts-ignore
        agent: httpsAgent
      }
    );
    
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      return memberData.items || [];
    }
  } catch (error) {
    console.error('Error fetching user member projects:', error);
  }

  // Fallback: Fetch all projects and filter by owner
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/projects`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      },
      // @ts-ignore
      agent: httpsAgent
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user projects: ${response.statusText}`);
  }

  const data = await response.json();
  const allProjects = data.items || [];
  
  // Filter projects by creator - need to extract user ID from creator href
  const userProjects = allProjects.filter((project: any) => {
    // Project creator is an object with href like "https://54.36.114.178:28181/hopsworks-api/api/users/10181"
    if (project.creator && project.creator.href) {
      const creatorId = parseInt(project.creator.href.split('/').pop());
      // Match by user ID if provided
      if (userId && creatorId === userId) {
        return true;
      }
    }
    // Fallback to old owner field if it exists (for backward compatibility)
    return project.owner === username;
  });
  
  return userProjects;
}

/**
 * Get project usage for a specific date
 */
export async function getProjectUsage(
  credentials: HopsworksCredentials,
  projectId: number,
  date: string
): Promise<ProjectUsage> {
  // This endpoint needs to be implemented by Hopsworks
  // For now, we'll return mock data structure
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/projects/${projectId}/usage?date=${date}`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      },
      // @ts-ignore
      agent: httpsAgent
    }
  );

  if (!response.ok) {
    // If endpoint doesn't exist yet, return empty usage
    if (response.status === 404) {
      return {
        date,
        compute: { instances: [] },
        storage: { featureStore: 0, models: 0, datasets: 0, total: 0 },
        apiCalls: { featureStore: 0, modelServing: 0, jobs: 0, total: 0 }
      };
    }
    throw new Error(`Failed to fetch project usage: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get user by Auth0 ID
 * @deprecated Use getHopsworksUserByUsername instead when username is known
 */
export async function getHopsworksUserByAuth0Id(
  credentials: HopsworksCredentials,
  auth0Id: string,
  userEmail?: string
): Promise<HopsworksUser | null> {
  // Hopsworks doesn't store Auth0 IDs, so we need to match by email
  // This requires passing the user's email from our database
  if (!userEmail) {
    return null;
  }

  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      },
      // @ts-ignore
      agent: httpsAgent
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  const data = await response.json();
  const users = data.items || [];
  
  // Find user by email and OAuth2 account type
  const user = users.find((u: any) => 
    u.email === userEmail && u.accountType === 'OAUTH2'
  );
  
  return user || null;
}

/**
 * Update user's max number of projects
 */
export async function updateUserProjectLimit(
  credentials: HopsworksCredentials,
  hopsworksUserId: number,
  maxNumProjects: number
): Promise<void> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users/${hopsworksUserId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maxNumProjects
      }),
      // @ts-ignore
      agent: httpsAgent
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update user project limit: ${response.statusText}`);
  }
}

/**
 * Get user by username (more efficient than by email)
 */
export async function getHopsworksUserByUsername(
  credentials: HopsworksCredentials,
  username: string
): Promise<HopsworksUser | null> {
  try {
    const response = await fetch(
      `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        },
        // @ts-ignore
        agent: httpsAgent
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch user ${username}:`, error);
    return null;
  }
}


/**
 * Get all users (admin endpoint)
 */
export async function getAllUsers(
  credentials: HopsworksCredentials,
  authToken: string
): Promise<HopsworksUser[]> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users`,
    {
      headers: {
        'Authorization': authToken
      },
      // @ts-ignore
      agent: httpsAgent
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Get all projects (admin endpoint)
 */
export async function getAllProjects(
  credentials: HopsworksCredentials,
  authToken: string
): Promise<HopsworksProject[]> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/projects`,
    {
      headers: {
        'Authorization': authToken
      },
      // @ts-ignore
      agent: httpsAgent
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  const data = await response.json();
  const projects = data.items || [];
  
  // Fetch owner details for each project
  for (const project of projects) {
    if (project.creator?.href) {
      // Extract user ID from href
      const userIdMatch = project.creator.href.match(/\/users\/(\d+)$/);
      if (userIdMatch) {
        const userId = userIdMatch[1];
        try {
          const userResponse = await fetch(
            `${credentials.apiUrl}${ADMIN_API_BASE}/users/${userId}`,
            {
              headers: {
                'Authorization': authToken
              },
              // @ts-ignore
              agent: httpsAgent
            }
          );
          if (userResponse.ok) {
            const userData = await userResponse.json();
            project.owner = userData.username;
          }
        } catch (error) {
          console.error(`Failed to fetch user ${userId} for project ${project.name}:`, error);
        }
      }
    }
  }
  
  return projects;
}


