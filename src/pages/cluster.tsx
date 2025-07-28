import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { Server, Copy, ExternalLink, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Cluster() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  // Instance data
  const instance = {
    name: 'My Hopsworks Instance',
    status: 'Running',
    endpoint: 'https://demo.hops.works',
    plan: 'Pay-as-you-go',
    created: '2025-07-15',
    usage: {
      cpuCredits: 245,
      gpuCredits: 12,
      storageCredits: 85,
      storageUsed: '42.3 GB',
      storageTotal: '250 GB'
    }
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
                onClick={() => window.open(instance.endpoint, '_blank')}
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
                <Title as="h2" className="text-lg">{instance.name}</Title>
              </Flex>
              <Badge variant="success">
                <CheckCircle size={14} className="mr-1" />
                {instance.status}
              </Badge>
            </Flex>

            <Box className="mb-4">
              <Text className="text-sm text-gray-600 mb-2">Current Usage (Pay-as-you-go)</Text>
              <Flex gap={16} className="text-sm">
                <Box>
                  <Text className="text-gray-600">CPU Credits</Text>
                  <Text className="font-semibold">{instance.usage.cpuCredits} hours</Text>
                </Box>
                <Box>
                  <Text className="text-gray-600">GPU Credits</Text>
                  <Text className="font-semibold">{instance.usage.gpuCredits} hours</Text>
                </Box>
                <Box>
                  <Text className="text-gray-600">Storage Credits</Text>
                  <Text className="font-semibold">{instance.usage.storageCredits} GB-hours</Text>
                </Box>
              </Flex>
            </Box>

            <Flex gap={24} className="text-sm">
              <Box>
                <Text className="text-gray-600">Plan</Text>
                <Text>{instance.plan}</Text>
              </Box>
              <Box>
                <Text className="text-gray-600">Created</Text>
                <Text>{instance.created}</Text>
              </Box>
              <Box>
                <Text className="text-gray-600">Storage</Text>
                <Text>{instance.usage.storageUsed} / {instance.usage.storageTotal}</Text>
              </Box>
            </Flex>
          </Card>

          {/* Connection Details */}
          <Card className="p-6 mb-6">
            <Title as="h3" className="text-lg mb-4">Connection Details</Title>
            
            <Flex direction="column" gap={16}>
              <Box>
                <Text className="text-sm text-gray-600 mb-2">Instance URL</Text>
                <Card variant="readOnly" className="p-3">
                  <Flex justify="between" align="center">
                    <Text className="text-sm">{instance.endpoint}</Text>
                    <Flex gap={8}>
                      <Button 
                        intent="ghost" 
                        className="text-sm"
                        onClick={() => copyToClipboard(cluster.endpoint, 'endpoint')}
                      >
                        {copied === 'endpoint' ? <CheckCircle size={16} /> : <Copy size={16} />}
                      </Button>
                      <Button 
                        intent="ghost" 
                        className="text-sm"
                        onClick={() => window.open(cluster.endpoint, '_blank')}
                      >
                        <ExternalLink size={16} />
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              </Box>

              <Box>
                <Text className="text-sm text-gray-600 mb-2">Authentication</Text>
                <Card variant="readOnly" className="p-3">
                  <Text className="text-sm">Single Sign-On via Auth0</Text>
                </Card>
                <Text className="text-xs text-gray-500 mt-2">
                  You&apos;ll be automatically logged in using your current credentials
                </Text>
              </Box>
            </Flex>
          </Card>

          {/* Quick Start */}
          <Card className="p-6 mb-6">
            <Title as="h3" className="text-lg mb-4">Quick Start</Title>
            
            <Text className="text-sm text-gray-600 mb-4">
              Connect to your instance using the Hopsworks Python client:
            </Text>

            <Card variant="readOnly" className="p-4 text-sm">
              <pre className="overflow-x-auto">
{`import hopsworks

# Login via browser (SSO)
connection = hopsworks.login(
    host="${instance.endpoint}"
)

# Get the feature store
fs = connection.get_feature_store()

# Create a new feature group
fg = fs.create_feature_group(
    name="sales_features",
    version=1
)`}
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
                onClick={() => window.open(cluster.endpoint, '_blank')}
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
                <Text>$0.10 / hour</Text>
              </Flex>
              <Flex justify="between">
                <Text className="text-gray-600">GPU Usage (T4)</Text>
                <Text>$0.50 / hour</Text>
              </Flex>
              <Flex justify="between">
                <Text className="text-gray-600">Storage</Text>
                <Text>$0.02 / GB / month</Text>
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