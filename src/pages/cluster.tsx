import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
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

  // Cluster data
  const cluster = {
    name: 'Demo Hopsworks Cluster',
    status: 'Running',
    endpoint: 'https://demo.hops.works',
    apiKey: 'Contact admin for API key',
    region: 'EU-Central',
    created: '2025-07-15',
    specs: {
      nodes: 3,
      cpu: '24 vCPUs',
      memory: '48 GB',
      storage: '500 GB SSD'
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" className="text-sm mb-6">
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Title as="h1" className="text-2xl mb-8">Cluster Access</Title>

          {/* Quick Access Button */}
          <Card className="p-6 mb-6 bg-green-50 border-green-200">
            <Flex justify="between" align="center">
              <Box>
                <Title as="h3" className="text-lg mb-2">Ready to Access Your Cluster</Title>
                <Text className="text-sm text-gray-600">
                  Click below to access your Hopsworks cluster. You&apos;ll be automatically authenticated.
                </Text>
              </Box>
              <Button 
                intent="primary" 
                className="text-lg px-6 py-3"
                onClick={() => window.open(cluster.endpoint, '_blank')}
              >
                Access Hopsworks →
              </Button>
            </Flex>
          </Card>

          {/* Cluster Status */}
          <Card className="p-6 mb-6">
            <Flex justify="between" align="start" className="mb-4">
              <Flex align="center" gap={12}>
                <Server size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">{cluster.name}</Title>
              </Flex>
              <Badge variant="success">
                <CheckCircle size={14} className="mr-1" />
                {cluster.status}
              </Badge>
            </Flex>

            <Flex gap={24} className="text-sm">
              <Box>
                <Text className="text-gray-600">Region</Text>
                <Text>{cluster.region}</Text>
              </Box>
              <Box>
                <Text className="text-gray-600">Created</Text>
                <Text>{cluster.created}</Text>
              </Box>
              <Box>
                <Text className="text-gray-600">Nodes</Text>
                <Text>{cluster.specs.nodes}</Text>
              </Box>
            </Flex>
          </Card>

          {/* Connection Details */}
          <Card className="p-6 mb-6">
            <Title as="h3" className="text-lg mb-4">Connection Details</Title>
            
            <Flex direction="column" gap={16}>
              <Box>
                <Text className="text-sm text-gray-600 mb-2">Cluster Endpoint</Text>
                <Card variant="readOnly" className="p-3">
                  <Flex justify="between" align="center">
                    <Text className="text-sm">{cluster.endpoint}</Text>
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
              Connect to your cluster using the Hopsworks Python client:
            </Text>

            <Card variant="readOnly" className="p-4 text-sm">
              <pre className="overflow-x-auto">
{`import hopsworks

# Login via browser (SSO)
connection = hopsworks.login(
    host="${cluster.endpoint}"
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
                Access Cluster →
              </Button>
            </Flex>
          </Card>

          {/* Resources */}
          <Card className="p-6">
            <Title as="h3" className="text-lg mb-4">Cluster Resources</Title>
            
            <Flex gap={16} className="flex-wrap">
              <Badge variant="primary">{cluster.specs.cpu}</Badge>
              <Badge variant="primary">{cluster.specs.memory} RAM</Badge>
              <Badge variant="primary">{cluster.specs.storage}</Badge>
            </Flex>

            <Text className="text-sm text-gray-600 mt-4">
              Need more resources? <Link href="/billing" className="text-[#1eb182] hover:underline">Upgrade your plan →</Link>
            </Text>
          </Card>
        </Box>
      </Box>
    </>
  );
}