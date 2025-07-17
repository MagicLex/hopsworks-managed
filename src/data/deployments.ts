export interface DeploymentOption {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isRecommended?: boolean;
  buttonStyle?: 'primary' | 'secondary' | 'enterprise';
  specs: {
    compute: string[];
    storage: string[];
    capabilities: string[];
  };
}

export const deploymentOptions: DeploymentOption[] = [
  {
    id: 'serverless',
    name: 'Serverless',
    monthlyPrice: 0,
    yearlyPrice: 0,
    buttonStyle: 'secondary',
    specs: {
      compute: ['Shared resources', 'Auto-scaling'],
      storage: ['10GB SSD', '1 Project'],
      capabilities: ['Feature store only', 'No orchestration', 'No Jupyter'],
    },
  },
  {
    id: 'small',
    name: 'Small Cluster',
    monthlyPrice: 250,
    yearlyPrice: 200,
    specs: {
      compute: ['4 vCPUs', '16GB RAM'],
      storage: ['100GB SSD', '5 Projects'],
      capabilities: ['Orchestration', 'Jupyter notebooks', 'T4 GPU optional'],
    },
  },
  {
    id: 'medium',
    name: 'Medium Cluster',
    monthlyPrice: 500,
    yearlyPrice: 400,
    isRecommended: true,
    specs: {
      compute: ['16 vCPUs', '64GB RAM'],
      storage: ['1TB SSD', '25 Projects'],
      capabilities: ['Full platform', 'Jupyter + VS Code', '2x A10G GPUs'],
    },
  },
  {
    id: 'large',
    name: 'Large Cluster',
    monthlyPrice: 1000,
    yearlyPrice: 800,
    buttonStyle: 'enterprise',
    specs: {
      compute: ['64 vCPUs', '256GB RAM'],
      storage: ['10TB SSD', 'Unlimited Projects'],
      capabilities: ['Unlimited Models', '4x A100 GPUs'],
    },
  },
];