// Validation and sanitation for Hopsworks operations

import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from './hopsworks-api';

interface HopsworksCredentials {
  apiUrl: string;
  apiKey: string;
}

/**
 * Check if a project exists in Hopsworks
 */
export async function projectExists(
  credentials: HopsworksCredentials,
  projectName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${projectName}`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error(`Failed to check if project ${projectName} exists:`, error);
    return false;
  }
}

/**
 * Get all projects from Hopsworks and return their names and IDs
 */
export async function getAllProjects(
  credentials: HopsworksCredentials
): Promise<Array<{ id: number; name: string; created?: string; owner?: string }>> {
  try {
    // Try admin endpoint first for complete list
    const adminResponse = await fetch(
      `${credentials.apiUrl}${ADMIN_API_BASE}/projects`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      }
    );
    
    if (adminResponse.ok) {
      const data = await adminResponse.json();
      return data.items || data || [];
    }
    
    // Fallback to regular endpoint
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
      return Array.isArray(data) ? data : (data.items || []);
    }
    
    return [];
  } catch (error) {
    console.error('Failed to fetch all projects:', error);
    return [];
  }
}

/**
 * Validate project before operations
 * Returns project info if valid, null if not
 */
export async function validateProject(
  credentials: HopsworksCredentials,
  projectName: string
): Promise<{ id: number; name: string; exists: boolean } | null> {
  try {
    const projects = await getAllProjects(credentials);
    const project = projects.find(p => p.name === projectName);
    
    if (project) {
      return {
        id: project.id,
        name: project.name,
        exists: true
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to validate project ${projectName}:`, error);
    return null;
  }
}

/**
 * Check if user exists in Hopsworks
 */
export async function userExists(
  credentials: HopsworksCredentials,
  username: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${credentials.apiUrl}${ADMIN_API_BASE}/users/${username}`,
      {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error(`Failed to check if user ${username} exists:`, error);
    return false;
  }
}