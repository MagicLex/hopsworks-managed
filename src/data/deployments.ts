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
    id: 'payg',
    name: 'Pay-As-You-Go',
    monthlyPrice: 0,
    yearlyPrice: 0,
    buttonStyle: 'primary',
    specs: {
      compute: ['Spark/Flink/Pandas engines', 'Dynamic compute', 'Auto-scaling workers'],
      storage: ['RonDB sub-ms latency', 'Delta/Hudi/Iceberg', 'Version-controlled features'],
      capabilities: ['Airflow orchestration', 'JupyterLab + notebooks', 'KServe model serving', 'Feature transformations', 'Drift monitoring', 'JDBC/Cloud connectors'],
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,
    yearlyPrice: 0,
    buttonStyle: 'enterprise',
    specs: {
      compute: ['Dedicated clusters', 'A100/H100 GPUs', 'Multi-region failover'],
      storage: ['Dedicated RonDB cluster', 'Custom retention', 'Private S3/ADLS/GCS'],
      capabilities: ['VPC peering', 'SAML/LDAP SSO', 'Custom SLAs', 'On-premise deploy', '24/7 support', 'Professional services'],
    },
  },
];