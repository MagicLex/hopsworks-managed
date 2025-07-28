// Hopsworks API integration
// Based on patterns from hopsworks-cloud

export const HOPSWORKS_API_BASE = '/hopsworks-api/api';

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
  // Search for user by OAuth subject
  const response = await fetch(
    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/users?filter=subject:${auth0Id}`,
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
  return data.items?.[0] || null;
}