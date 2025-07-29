import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { testHopsworksConnection, ADMIN_API_BASE, HOPSWORKS_API_BASE } from '../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, clusterId } = req.body;

  if (!userId || !clusterId) {
    return res.status(400).json({ error: 'userId and clusterId are required' });
  }

  try {
    // Get cluster credentials
    const { data: cluster, error: clusterError } = await supabase
      .from('hopsworks_clusters')
      .select('*')
      .eq('id', clusterId)
      .single();

    if (clusterError || !cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Import the Hopsworks API functions
    const { 
      getHopsworksUserByAuth0Id, 
      getUserProjects,
      getAllUsers,
      getAllProjects
    } = await import('../../../lib/hopsworks-api');

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    const results: any = {
      test: 'hopsworks-connection',
      timestamp: new Date().toISOString(),
      cluster: {
        id: cluster.id,
        name: cluster.name,
        api_url: cluster.api_url,
        status: cluster.status
      },
      user: {
        id: user.id,
        email: user.email,
        hopsworks_project_id: user.hopsworks_project_id || 'not_set'
      },
      hopsworksData: {}
    };

    try {
      // Get Hopsworks user by email (since Auth0 IDs aren't stored in Hopsworks)
      const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, user.email);
      results.hopsworksData.user = hopsworksUser;

      if (hopsworksUser) {
        // Get user's projects
        try {
          const projects = await getUserProjects(credentials, hopsworksUser.username);
          results.hopsworksData.projects = projects;
          results.hopsworksData.projectCount = projects.length;
          
          // Get detailed project information with metrics
          if (projects.length > 0) {
            results.hopsworksData.projectDetails = [];
            
            for (const project of projects) {
              try {
                // Get project details
                const projectDetailResponse = await fetch(
                  `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}`,
                  {
                    headers: {
                      'Authorization': `ApiKey ${credentials.apiKey}`
                    }
                  }
                );
                
                if (projectDetailResponse.ok) {
                  const projectDetail = await projectDetailResponse.json();
                  
                  // Try to get feature stores for the project
                  const featureStoreResponse = await fetch(
                    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/featurestores`,
                    {
                      headers: {
                        'Authorization': `ApiKey ${credentials.apiKey}`
                      }
                    }
                  );
                  
                  let featureStoreData = null;
                  if (featureStoreResponse.ok) {
                    featureStoreData = await featureStoreResponse.json();
                  }
                  
                  // Try to get datasets for the project
                  const datasetResponse = await fetch(
                    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/dataset`,
                    {
                      headers: {
                        'Authorization': `ApiKey ${credentials.apiKey}`
                      }
                    }
                  );
                  
                  let datasetData = null;
                  if (datasetResponse.ok) {
                    datasetData = await datasetResponse.json();
                  }
                  
                  // Try to get jobs for the project
                  const jobsResponse = await fetch(
                    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/jobs`,
                    {
                      headers: {
                        'Authorization': `ApiKey ${credentials.apiKey}`
                      }
                    }
                  );
                  
                  let jobsData = null;
                  if (jobsResponse.ok) {
                    jobsData = await jobsResponse.json();
                  }
                  
                  results.hopsworksData.projectDetails.push({
                    ...projectDetail,
                    featureStores: featureStoreData,
                    datasets: datasetData,
                    jobs: jobsData
                  });
                }
              } catch (detailError) {
                console.error(`Error fetching details for project ${project.id}:`, detailError);
              }
            }
          }
        } catch (projectError) {
          results.hopsworksData.projectsError = projectError instanceof Error ? projectError.message : 'Failed to fetch projects';
        }
      }
    } catch (apiError) {
      results.hopsworksData.userLookupError = apiError instanceof Error ? apiError.message : 'Failed to fetch user';
    }

    // Get cluster statistics
    try {
      const allUsers = await getAllUsers(credentials, `ApiKey ${credentials.apiKey}`);
      results.hopsworksData.totalUsers = allUsers.length;
      results.hopsworksData.activeUsers = allUsers.filter((u: any) => u.status === 2).length;
    } catch (statsError) {
      results.hopsworksData.statsError = statsError instanceof Error ? statsError.message : 'Failed to fetch stats';
    }

    // Test monitoring endpoints for metrics
    try {
      // Try admin monitoring metrics endpoint
      const monitoringResponse = await fetch(`${credentials.apiUrl}${HOPSWORKS_API_BASE}/admin/monitoring/metrics`, {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      });
      results.hopsworksData.monitoring = {
        status: monitoringResponse.status,
        statusText: monitoringResponse.statusText
      };
      if (monitoringResponse.ok) {
        const contentType = monitoringResponse.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          results.hopsworksData.monitoring.data = await monitoringResponse.json();
        } else {
          results.hopsworksData.monitoring.data = 'Non-JSON response';
        }
      }
    } catch (monitoringError) {
      results.hopsworksData.monitoringError = monitoringError instanceof Error ? monitoringError.message : 'Failed to test monitoring';
    }

    // Try Prometheus federation endpoint
    try {
      const prometheusResponse = await fetch(`${credentials.apiUrl}:9089/api/prometheus/federate`, {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      });
      results.hopsworksData.prometheus = {
        status: prometheusResponse.status,
        statusText: prometheusResponse.statusText,
        note: 'Prometheus typically runs on port 9089'
      };
    } catch (prometheusError) {
      results.hopsworksData.prometheusError = prometheusError instanceof Error ? prometheusError.message : 'Failed to test Prometheus';
    }

    // Test audit log endpoint (for user activity metrics)
    try {
      const auditResponse = await fetch(`${credentials.apiUrl}${ADMIN_API_BASE}/audit`, {
        headers: {
          'Authorization': `ApiKey ${credentials.apiKey}`
        }
      });
      results.hopsworksData.audit = {
        status: auditResponse.status,
        statusText: auditResponse.statusText,
        note: 'Audit logs can be used to track user activity'
      };
    } catch (auditError) {
      results.hopsworksData.auditError = auditError instanceof Error ? auditError.message : 'Failed to test audit endpoint';
    }

    // Try to get project quota/usage information
    if (results.hopsworksData.projects && results.hopsworksData.projects.length > 0) {
      const firstProject = results.hopsworksData.projects[0];
      try {
        // Check if there's a quota endpoint
        const quotaResponse = await fetch(`${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${firstProject.id}/quotas`, {
          headers: {
            'Authorization': `ApiKey ${credentials.apiKey}`
          }
        });
        if (quotaResponse.ok) {
          results.hopsworksData.sampleProjectQuota = await quotaResponse.json();
        }
      } catch (quotaError) {
        console.error('Quota endpoint error:', quotaError);
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error testing Hopsworks connection:', error);
    return res.status(500).json({ 
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function testHopsworksHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}