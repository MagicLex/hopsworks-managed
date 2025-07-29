import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../../middleware/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_API_BASE, HOPSWORKS_API_BASE } from '../../../../lib/hopsworks-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Get user details with cluster assignment
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        user_hopsworks_assignments!inner (
          hopsworks_cluster_id,
          hopsworks_clusters (
            id,
            name,
            api_url,
            api_key
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cluster = user.user_hopsworks_assignments?.[0]?.hopsworks_clusters;
    if (!cluster) {
      return res.status(400).json({ error: 'User has no cluster assignment' });
    }

    const credentials = {
      apiUrl: cluster.api_url,
      apiKey: cluster.api_key
    };

    // Import Hopsworks API functions
    const { getHopsworksUserByAuth0Id, getUserProjects } = await import('../../../../lib/hopsworks-api');

    const metrics: any = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        cluster: cluster.name
      },
      consumption: {
        compute: {
          cpuHours: 0,
          gpuHours: 0,
          instances: []
        },
        storage: {
          featureStore: 0,
          models: 0,
          datasets: 0,
          total: 0
        },
        apiCalls: {
          featureStore: 0,
          modelServing: 0,
          jobs: 0,
          total: 0
        }
      },
      projects: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Get Hopsworks user
      const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, user.email);
      
      if (hopsworksUser) {
        metrics.hopsworksUser = {
          username: hopsworksUser.username,
          id: hopsworksUser.id,
          status: hopsworksUser.status,
          numActiveProjects: hopsworksUser.numActiveProjects
        };

        // Get user's projects - try different approaches
        let projects: any[] = [];
        
        // First try the admin endpoint
        try {
          projects = await getUserProjects(credentials, hopsworksUser.username);
        } catch (e) {
          console.log('Admin endpoint failed, trying alternative approach');
          
          // Try getting all projects from admin endpoint
          try {
            const allProjectsResponse = await fetch(
              `${credentials.apiUrl}${ADMIN_API_BASE}/projects`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );
            
            if (allProjectsResponse.ok) {
              const allProjects = await allProjectsResponse.json();
              const projectList = allProjects.items || [];
              
              // Filter projects where the user is the creator
              const userProjects = projectList.filter((project: any) => {
                // The creator href ends with the user ID
                const creatorId = project.creator?.href?.split('/').pop();
                return creatorId === String(hopsworksUser.id);
              });
              
              // If no projects found as creator, try to get project members
              if (userProjects.length === 0 && hopsworksUser.numActiveProjects > 0) {
                // User has projects but is not the creator, they must be a member
                // We'll need to check each project's members
                console.log(`User ${hopsworksUser.username} has ${hopsworksUser.numActiveProjects} projects but is not creator of any`);
              }
              
              projects = userProjects.map((project: any) => ({
                id: project.id,
                name: project.name,
                created: project.created,
                paymentType: project.paymentType,
                lastQuotaUpdate: project.lastQuotaUpdate
              }));
              
              console.log(`Found ${projects.length} projects where user ${hopsworksUser.username} is creator`);
          } catch (altError) {
            console.error('Alternative project fetch failed:', altError);
            projects = [];
          }
        }
        
        for (const project of projects) {
          const projectMetrics: any = {
            id: project.id,
            name: project.name,
            created: project.created,
            datasets: [],
            featureStores: [],
            jobs: [],
            models: []
          };

          // Fetch project details
          try {
            const projectResponse = await fetch(
              `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );

            if (projectResponse.ok) {
              const projectData = await projectResponse.json();
              projectMetrics.quotas = projectData.quotas;
              projectMetrics.services = projectData.services;
            }
          } catch (e) {
            console.error(`Failed to fetch project ${project.id} details:`, e);
          }

          // Fetch datasets and calculate storage
          try {
            const datasetResponse = await fetch(
              `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/dataset?offset=0&limit=100`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );

            if (datasetResponse.ok) {
              const datasetData = await datasetResponse.json();
              projectMetrics.datasets = datasetData.items || [];
              
              // Calculate total dataset size
              let datasetSize = 0;
              for (const dataset of projectMetrics.datasets) {
                if (dataset.size) {
                  datasetSize += dataset.size;
                }
              }
              metrics.consumption.storage.datasets += datasetSize;
            }
          } catch (e) {
            console.error(`Failed to fetch datasets for project ${project.id}:`, e);
          }

          // Fetch feature stores
          try {
            const fsResponse = await fetch(
              `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/featurestores`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );

            if (fsResponse.ok) {
              const fsData = await fsResponse.json();
              projectMetrics.featureStores = fsData.items || fsData || [];
              
              // Try to get feature groups for each feature store
              for (const fs of projectMetrics.featureStores) {
                try {
                  const fgResponse = await fetch(
                    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/featurestores/${fs.featurestoreId || fs.id}/featuregroups`,
                    {
                      headers: {
                        'Authorization': `ApiKey ${credentials.apiKey}`
                      }
                    }
                  );
                  
                  if (fgResponse.ok) {
                    const fgData = await fgResponse.json();
                    fs.featureGroups = fgData.items || [];
                  }
                } catch (e) {
                  console.error(`Failed to fetch feature groups:`, e);
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch feature stores for project ${project.id}:`, e);
          }

          // Fetch jobs
          try {
            const jobsResponse = await fetch(
              `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/jobs?offset=0&limit=100`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );

            if (jobsResponse.ok) {
              const jobsData = await jobsResponse.json();
              projectMetrics.jobs = jobsData.items || [];
              
              // Count API calls from jobs
              metrics.consumption.apiCalls.jobs += projectMetrics.jobs.length;
              
              // Try to get job executions for compute hours
              for (const job of projectMetrics.jobs.slice(0, 5)) { // Limit to first 5 jobs
                try {
                  const execResponse = await fetch(
                    `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/jobs/${job.id}/executions?offset=0&limit=10`,
                    {
                      headers: {
                        'Authorization': `ApiKey ${credentials.apiKey}`
                      }
                    }
                  );
                  
                  if (execResponse.ok) {
                    const execData = await execResponse.json();
                    job.recentExecutions = execData.items || [];
                    
                    // Calculate compute hours from executions
                    for (const exec of job.recentExecutions) {
                      if (exec.duration) {
                        const hours = exec.duration / 3600000; // Convert ms to hours
                        metrics.consumption.compute.cpuHours += hours;
                      }
                    }
                  }
                } catch (e) {
                  console.error(`Failed to fetch job executions:`, e);
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch jobs for project ${project.id}:`, e);
          }

          // Fetch model registry
          try {
            const modelsResponse = await fetch(
              `${credentials.apiUrl}${HOPSWORKS_API_BASE}/project/${project.id}/modelregistries`,
              {
                headers: {
                  'Authorization': `ApiKey ${credentials.apiKey}`
                }
              }
            );

            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              projectMetrics.modelRegistries = modelsData.items || modelsData || [];
            }
          } catch (e) {
            console.error(`Failed to fetch models for project ${project.id}:`, e);
          }

          metrics.projects.push(projectMetrics);
        }

        // Calculate totals
        metrics.consumption.storage.total = 
          metrics.consumption.storage.featureStore + 
          metrics.consumption.storage.models + 
          metrics.consumption.storage.datasets;
        
        metrics.consumption.apiCalls.total = 
          metrics.consumption.apiCalls.featureStore + 
          metrics.consumption.apiCalls.modelServing + 
          metrics.consumption.apiCalls.jobs;
          
        // Add debug info
        metrics.debug = {
          projectsFound: projects.length,
          projectsFetched: metrics.projects.length,
          hopsworksUsername: hopsworksUser.username
        };
      }

      // Get historical usage from our database
      const { data: historicalUsage } = await supabase
        .from('usage_daily')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      if (historicalUsage) {
        metrics.historicalUsage = historicalUsage;
        
        // Calculate totals from historical data
        metrics.historicalTotals = historicalUsage.reduce((acc, day) => ({
          cpu_hours: acc.cpu_hours + (day.cpu_hours || 0),
          gpu_hours: acc.gpu_hours + (day.gpu_hours || 0),
          storage_gb_months: acc.storage_gb_months + (day.storage_gb_months || 0),
          api_calls: acc.api_calls + (day.api_calls || 0),
          total_cost: acc.total_cost + (day.total_cost || 0)
        }), {
          cpu_hours: 0,
          gpu_hours: 0,
          storage_gb_months: 0,
          api_calls: 0,
          total_cost: 0
        });
      }

    } catch (error) {
      console.error('Error fetching user metrics:', error);
      metrics.error = error instanceof Error ? error.message : 'Failed to fetch metrics';
    }

    return res.status(200).json(metrics);
  } catch (error) {
    console.error('Error in user usage handler:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default function userUsageHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAdmin(req, res, handler);
}