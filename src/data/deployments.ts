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
      capabilities: ['5 Models max', 'Community support'],
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
      capabilities: ['25 Models', 'T4 GPU optional'],
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
      capabilities: ['100 Models', '2x A10G GPUs'],
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