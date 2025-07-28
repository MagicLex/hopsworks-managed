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
      compute: ['Shared CPU', '4GB Memory per Job', 'Limited compute time'],
      storage: ['10GB Storage', '100K Features', 'Basic performance'],
      capabilities: ['Feature Store', 'Model Registry', 'Community Support', 'No GPUs', 'Limited API calls'],
    },
  },
  {
    id: 'payg',
    name: 'Pay-As-You-Go',
    monthlyPrice: 0,
    yearlyPrice: 0,
    buttonStyle: 'primary',
    specs: {
      compute: ['$0.10 per CPU hour', '$0.50 per GPU hour (T4)', 'Auto-scaling'],
      storage: ['$0.02 per GB/month', 'Unlimited features', 'NVMe SSD performance'],
      capabilities: ['Full Hopsworks Platform', 'Feature Store & Model Registry', 'ML Pipelines & Training', 'Jupyter & VS Code', 'Real-time Serving', 'Standard Support'],
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    buttonStyle: 'enterprise',
    specs: {
      compute: ['Custom sizing', 'Dedicated resources', 'Multi-region'],
      storage: ['Custom storage tiers', 'Unlimited features', 'Enterprise SLAs'],
      capabilities: ['All Pay-As-You-Go features', 'A100 GPUs available', 'Private cloud deployment', 'On-premise option', '24/7 Premium Support', 'Custom integrations'],
    },
  },
];