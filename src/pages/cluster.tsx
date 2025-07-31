import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { Server, Copy, ExternalLink, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { defaultBillingRates } from '@/config/billing-rates';

interface InstanceData {
  name: string;
  status: string;
  endpoint: string;
  plan: string;
  created: string | null;
}

interface UsageData {
  cpuHours: number;
  gpuHours: number;
  storageGB: number;
}

export default function Cluster() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState('');
  const { data: instance, loading: instanceLoading } = useApiData<InstanceData>('/api/instance');
  const { data: usage, loading: usageLoading } = useApiData<UsageData>('/api/usage');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || instanceLoading || usageLoading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  // Default values if data is not available
  const instanceData = instance || {
    name: 'Hopsworks Instance',
    status: 'Not Started',
    endpoint: '',
    plan: 'Pay-as-you-go',
    created: null
  };

  const usageData = usage || {
    cpuHours: 0,
    gpuHours: 0,
    storageGB: 0
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <>
      <Head>
        <title>Hopsworks Instance - Access Your ML Platform</title>
        <meta name="description" content="Access your Hopsworks instance. Feature store, ML pipelines, and model deployment on pay-as-you-go infrastructure." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" className="text-sm mb-6">
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Title as="h1" className="text-2xl mb-8">Hopsworks Instance</Title>

          {/* Quick Access Button */}
          <Card className="p-6 mb-6 bg-green-50 border-green-200">
            <Flex justify="between" align="center">
              <Box>
                <Title as="h3" className="text-lg mb-2">Access Your Hopsworks Instance</Title>
                <Text className="text-sm text-gray-600">
                  Feature store, model registry, and ML pipelines - all in one place
                </Text>
              </Box>
              <Button 
                intent="primary" 
                className="text-lg px-6 py-3"
                onClick={() => {
                  if (instanceData.endpoint) {
                    // Redirect to auto-OAuth URL for automatic login with Auth0
                    const autoOAuthUrl = `${instanceData.endpoint}/autoOAuth?providerName=Auth0`;
                    window.open(autoOAuthUrl, '_blank');
                  } else {
                    alert('No cluster assigned yet. Please contact support.');
                  }
                }}
                disabled={!instanceData.endpoint}
              >
                Launch Hopsworks →
              </Button>
            </Flex>
          </Card>

          {/* Instance Status */}
          <Card className="p-6 mb-6">
            <Flex justify="between" align="start" className="mb-4">
              <Flex align="center" gap={12}>
                <Server size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">{instanceData.name}</Title>
              </Flex>
              {instanceData.status === 'Active' ? (
                <Badge variant="success">
                  <CheckCircle size={14} className="mr-1" />
                  {instanceData.status}
                </Badge>
              ) : (
                <Badge variant="warning">
                  {instanceData.status}
                </Badge>
              )}
            </Flex>

            <Box className="mb-4">
              <Text className="text-sm text-gray-600 mb-2">Current Usage (Pay-as-you-go)</Text>
              <Flex gap={16} className="text-sm">
                <Box>
                  <Text className="text-gray-600">CPU Credits</Text>
                  <Text className="font-semibold">{usageData.cpuHours.toFixed(0)} hours</Text>
                </Box>
              </Flex>
            </Box>

            <Flex gap={24} className="text-sm">
              <Box>
                <Text className="text-gray-600">Plan</Text>
                <Text>{instanceData.plan}</Text>
              </Box>
              <Box>
                <Text className="text-gray-600">Created</Text>
                <Text>{instanceData.created ? new Date(instanceData.created).toLocaleDateString() : 'Not started'}</Text>
              </Box>
            </Flex>
          </Card>


          {/* Quick Start */}
          <Card className="p-6 mb-6">
            <Title as="h3" className="text-lg mb-4">Quick Start</Title>
            
            <Text className="text-sm text-gray-600 mb-4">
              Connect to your instance using the Hopsworks Python client:
            </Text>

            <Card variant="readOnly" className="relative">
              <Button
                intent="ghost"
                className="absolute top-2 right-2 text-xs"
                onClick={() => {
                  const code = `import hopsworks
import pandas as pd

# Login with host
project = hopsworks.login(
    host="${instanceData?.endpoint || 'https://your-hopsworks-instance.com'}"
)
fs = project.get_feature_store()

# Load your data (example)
features = pd.DataFrame({
    'user_id': [1, 2, 3, 1, 2],
    'order_id': [100, 101, 102, 103, 104],
    'order_value': [10.5, 25.2, 12.6, 8.8, 30.0],
    'order_date': pd.to_datetime(['2024-06-01', '2024-06-02', '2024-06-03', '2024-06-02', '2024-06-04'])
})
    
# Create feature group
fg = fs.get_or_create_feature_group(
    name='user_features',
    version=1,
    primary_key=['user_id'],
    online=True,
    description='User features based on order history'
)

# Insert features into the Feature Store
fg.insert(features)`;
                  navigator.clipboard.writeText(code);
                  setCopied('quickstart');
                  setTimeout(() => setCopied(''), 2000);
                }}
              >
                {copied === 'quickstart' ? (
                  <Flex align="center" gap={4}>
                    <CheckCircle size={12} />
                    Copied!
                  </Flex>
                ) : (
                  <Flex align="center" gap={4}>
                    <Copy size={12} />
                    Copy
                  </Flex>
                )}
              </Button>
              <pre className="overflow-x-auto p-4 text-sm bg-gray-900 text-gray-300 rounded">
                <code>
                  <span className="text-purple-400">import</span> <span className="text-green-400">hopsworks</span>
                  {'\n\n'}
                  <span className="text-gray-500"># Login via browser (SSO)</span>
                  {'\n'}
                  <span className="text-blue-300">connection</span> = <span className="text-green-400">hopsworks</span>.<span className="text-yellow-300">login</span>(
                  {'\n    '}
                  <span className="text-orange-300">host</span>=<span className="text-green-300">&quot;{instanceData?.endpoint || 'your-hopsworks-instance.com'}&quot;</span>
                  {'\n'}
                  )
                  {'\n\n'}
                  <span className="text-gray-500"># Get the feature store</span>
                  {'\n'}
                  <span className="text-blue-300">fs</span> = <span className="text-blue-300">connection</span>.<span className="text-yellow-300">get_feature_store</span>()
                  {'\n\n'}
                  <span className="text-gray-500"># Create a new feature group</span>
                  {'\n'}
                  <span className="text-blue-300">fg</span> = <span className="text-blue-300">fs</span>.<span className="text-yellow-300">create_feature_group</span>(
                  {'\n    '}
                  <span className="text-orange-300">name</span>=<span className="text-green-300">&quot;sales_features&quot;</span>,
                  {'\n    '}
                  <span className="text-orange-300">version</span>=<span className="text-purple-300">1</span>
                  {'\n'}
                  )
                </code>
              </pre>
            </Card>

            <Flex gap={12} className="mt-4">
              <Button 
                intent="primary" 
                onClick={() => window.open('https://docs.hopsworks.ai', '_blank')}
              >
                View Documentation →
              </Button>
              <Button 
                intent="secondary" 
                onClick={() => {
                  if (instanceData.endpoint) {
                    // Redirect to auto-OAuth URL for automatic login with Auth0
                    const autoOAuthUrl = `${instanceData.endpoint}/autoOAuth?providerName=Auth0`;
                    window.open(autoOAuthUrl, '_blank');
                  } else {
                    alert('No cluster assigned yet. Please contact support.');
                  }
                }}
                disabled={!instanceData.endpoint}
              >
                Launch Instance →
              </Button>
            </Flex>
          </Card>

          {/* Pricing Info */}
          <Card className="p-6">
            <Title as="h3" className="text-lg mb-4">Pay-As-You-Go Pricing</Title>
            
            <Flex direction="column" gap={12} className="text-sm">
              <Flex justify="between">
                <Text className="text-gray-600">CPU Usage</Text>
                <Text>${defaultBillingRates.cpuHourRate} / hour</Text>
              </Flex>
            </Flex>

            <Text className="text-sm text-gray-600 mt-4">
              View detailed usage and costs in <Link href="/billing" className="text-[#1eb182] hover:underline">Billing →</Link>
            </Text>
          </Card>
        </Box>
      </Box>
    </>
  );
}