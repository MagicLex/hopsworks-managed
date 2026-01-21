// API Response Types

export interface ApiError {
  error: string;
  details?: string;
}

export interface ApiSuccess<T = unknown> {
  message?: string;
  [key: string]: T | string | undefined;
}

// Hopsworks Types
export interface HopsworksProject {
  id: number;
  name: string;
  namespace: string;
  description?: string;
  created?: string;
  creator?: string;
}

export interface HopsworksUser {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  numActiveProjects?: number;
}

// Kubernetes Metrics Types
export interface KubernetesProject {
  namespace: string;
  projectName: string;
  projectId: number;
  resources: {
    cpuCores: number;
    memoryGB: number;
  };
  pods: Array<{
    name: string;
    cpuCores: number;
    memoryGB: number;
  }>;
}

export interface KubernetesMetrics {
  userId: string;
  projects: KubernetesProject[];
  totals: {
    cpuCores: number;
    memoryGB: number;
    storageGB: number;
  };
  timestamp: string;
}

// Collection Types
export interface CollectionResult {
  message: string;
  result?: {
    results: {
      successful: number;
      failed: number;
      errors: string[];
    };
  };
}

// Test Results Types
export interface HopsworksTestResult {
  status: number;
  data: {
    test: string;
    timestamp: string;
    cluster: {
      id: string;
      name: string;
      api_url: string;
      status: string;
    };
    user: {
      id: string;
      email: string;
    };
    hopsworksData: Record<string, unknown>;
    kubernetesMetrics?: {
      available: boolean;
      userMetrics?: KubernetesMetrics;
      error?: string;
      note: string;
    };
  };
  timestamp: string;
  error?: string;
}

// User Metrics Types
export interface UserMetricsResult {
  status: number;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      cluster: string;
    };
    consumption: {
      compute: {
        cpuHours: number;
        gpuHours: number;
        instances: unknown[];
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
    };
    projects: HopsworksProject[];
    hopsworksUser?: {
      username: string;
    };
    historicalUsage?: Array<{
      date: string;
      cpu_hours: number;
      gpu_hours: number;
      storage_gb: number;
      total_cost: number;
    }>;
    historicalTotals?: {
      cpu_hours: number;
      gpu_hours: number;
      storage_gb_months: number;
      api_calls: number;
      total_cost: number;
    };
  };
  timestamp: string;
  error?: string;
}