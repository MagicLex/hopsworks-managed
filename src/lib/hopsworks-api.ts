// Hopsworks API integration
// Based on patterns from hopsworks-cloud

export const HOPSWORKS_API_BASE = '/hopsworks-api/api';
export const ADMIN_API_BASE = '/hopsworks-api/api/admin';

interface HopsworksCredentials {
  apiUrl: string;
  apiKey: string;
}

interface HopsworksUser {
  username: string;
  email: string;
  id: number;
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
  auth0Id: string
): Promise<string> {
  const response = await fetch(`${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/users`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${credentials.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountType: 'REMOTE_ACCOUNT_TYPE',
      type: 'OAUTH2',
      clientId: process.env.AUTH0_CLIENT_ID,
      subject: auth0Id,
      email,
      givenName: firstName,
      surname: lastName,
      maxNumProjects: 1,
      status: 'ACTIVATED'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create Hopsworks user: ${response.statusText}`);
  }

  const data = await response.json();
  return data.username;
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
    })
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Project name already exists');
    }
    throw new Error(`Failed to create project: ${response.statusText}`);
  }
}

/**
 * Get user's projects
 */
export async function getUserProjects(
  credentials: HopsworksCredentials,
  username: string
): Promise<HopsworksProject[]> {
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/users/${username}/projects`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch user projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
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
      }
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
 */
export async function getHopsworksUserByAuth0Id(
  credentials: HopsworksCredentials,
  auth0Id: string
): Promise<HopsworksUser | null> {
  // First try to get all users and find by Auth0 ID
  // The filter syntax might not work as expected
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users`,
    {
      headers: {
        'Authorization': `ApiKey ${credentials.apiKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }

  const data = await response.json();
  const users = data.items || [];
  
  // Log first few users to see the structure
  console.log('Sample user structure:', users[0]);
  
  // Try to find user by Auth0 ID in various possible fields
  const user = users.find((u: any) => 
    u.subject === auth0Id || 
    u.oauth2Subject === auth0Id ||
    u.remoteUser === auth0Id ||
    (u.accountType === 'REMOTE_ACCOUNT_TYPE' && u.email === auth0Id) // Sometimes auth0Id might be stored differently
  );
  
  return user || null;
}

/**
 * Admin login to get auth token
 */
export async function adminLogin(
  credentials: HopsworksCredentials,
  adminEmail: string,
  adminPassword: string
): Promise<string> {
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `email=${encodeURIComponent(adminEmail)}&password=${encodeURIComponent(adminPassword)}`
    }
  );

  if (!response.ok) {
    throw new Error(`Admin login failed: ${response.statusText}`);
  }

  // Extract auth token from response
  const authHeader = response.headers.get('authorization');
  if (!authHeader) {
    throw new Error('No authorization header in login response');
  }

  return authHeader;
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
      }
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
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Get user's projects by username
 */
export async function getUserProjectsByUsername(
  credentials: HopsworksCredentials,
  authToken: string,
  username: string
): Promise<HopsworksProject[]> {
  const response = await fetch(
    `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}/projects`,
    {
      headers: {
        'Authorization': authToken
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch user projects: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Test API connection and fetch user data
 */
export async function testHopsworksConnection(
  credentials: HopsworksCredentials,
  userId: string
): Promise<any> {
  try {
    // For now, return a test response structure
    // In production, you would use admin credentials to login first
    const testData: any = {
      connectionTest: {
        apiUrl: credentials.apiUrl,
        timestamp: new Date().toISOString(),
        status: 'pending'
      },
      userLookup: {
        userId,
        message: 'API key authentication required for actual data'
      },
      availableEndpoints: [
        `${ADMIN_API_BASE}/users`,
        `${ADMIN_API_BASE}/projects`,
        `${ADMIN_API_BASE}/users/{username}/projects`,
        `${HOPSWORKS_API_BASE}/auth/login`
      ]
    };

    // Try a simple ping to test connectivity
    try {
      const pingResponse = await fetch(credentials.apiUrl, {
        method: 'HEAD',
        mode: 'no-cors' // Avoid CORS issues for testing
      });
      testData.connectionTest.status = 'reachable';
    } catch (error) {
      testData.connectionTest.status = 'unreachable';
      testData.connectionTest.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return testData;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}