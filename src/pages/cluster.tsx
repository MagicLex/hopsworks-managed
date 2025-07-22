import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { Terminal, Server, Copy, ExternalLink, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

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
      <Box className="min-h-screen bg-[#0a0f0a] text-gray-100 flex items-center justify-center">
        <Text className="font-mono">LOADING...</Text>
      </Box>
    );
  }

  if (!user) return null;

  // Mock cluster data
  const cluster = {
    name: 'STARTER-CLUSTER-US-EAST-1',
    status: 'RUNNING',
    endpoint: 'https://starter-us-east-1.hopsworks.ai',
    apiKey: 'hw_sk_1234567890abcdef',
    region: 'US-EAST-1',
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
    <Box className="min-h-screen bg-[#0a0f0a] text-gray-100">
      <Box className="max-w-4xl mx-auto p-8">
        <Link href="/dashboard">
          <Button intent="ghost" className="font-mono text-sm mb-6">
            <ArrowLeft size={16} className="mr-2" />
            BACK TO DASHBOARD
          </Button>
        </Link>

        <Flex align="center" gap={12} className="mb-8">
          <Terminal size={24} className="text-[#1eb182]" />
          <Title as="h1" className="text-2xl font-mono uppercase">CLUSTER ACCESS</Title>
        </Flex>

        {/* Cluster Status */}
        <Card className="bg-[#111511] border-grayShade2 p-6 mb-6">
          <Flex justify="between" align="start" className="mb-4">
            <Flex align="center" gap={12}>
              <Server size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg font-mono uppercase">{cluster.name}</Title>
            </Flex>
            <Badge variant="success" className="font-mono">
              <CheckCircle size={14} className="mr-1" />
              {cluster.status}
            </Badge>
          </Flex>

          <Flex gap={24} className="text-sm font-mono">
            <Box>
              <Text className="text-gray-400">REGION</Text>
              <Text>{cluster.region}</Text>
            </Box>
            <Box>
              <Text className="text-gray-400">CREATED</Text>
              <Text>{cluster.created}</Text>
            </Box>
            <Box>
              <Text className="text-gray-400">NODES</Text>
              <Text>{cluster.specs.nodes}</Text>
            </Box>
          </Flex>
        </Card>

        {/* Connection Details */}
        <Card className="bg-[#111511] border-grayShade2 p-6 mb-6">
          <Title as="h3" className="text-lg font-mono uppercase mb-4">CONNECTION DETAILS</Title>
          
          <Flex direction="column" gap={16}>
            <Box>
              <Text className="font-mono text-sm text-gray-400 mb-2">CLUSTER ENDPOINT</Text>
              <Card className="bg-[#0a0f0a] border-grayShade2 p-3">
                <Flex justify="between" align="center">
                  <Text className="font-mono text-sm">{cluster.endpoint}</Text>
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
              <Text className="font-mono text-sm text-gray-400 mb-2">API KEY</Text>
              <Card className="bg-[#0a0f0a] border-grayShade2 p-3">
                <Flex justify="between" align="center">
                  <Text className="font-mono text-sm">hw_sk_••••••••••••••••</Text>
                  <Button 
                    intent="ghost" 
                    className="text-sm"
                    onClick={() => copyToClipboard(cluster.apiKey, 'apikey')}
                  >
                    {copied === 'apikey' ? <CheckCircle size={16} /> : <Copy size={16} />}
                  </Button>
                </Flex>
              </Card>
            </Box>
          </Flex>
        </Card>

        {/* Quick Start */}
        <Card className="bg-[#111511] border-grayShade2 p-6 mb-6">
          <Title as="h3" className="text-lg font-mono uppercase mb-4">QUICK START</Title>
          
          <Text className="font-mono text-sm text-gray-400 mb-4">
            Connect to your cluster using the Hopsworks Python client:
          </Text>

          <Card className="bg-[#0a0f0a] border-grayShade2 p-4 font-mono text-sm">
            <pre className="overflow-x-auto">
{`import hopsworks

connection = hopsworks.login(
    host="${cluster.endpoint}",
    api_key_value="${cluster.apiKey}"
)

# Get the feature store
fs = connection.get_feature_store()

# List all feature groups
fs.get_feature_groups()`}
            </pre>
          </Card>

          <Flex gap={12} className="mt-4">
            <Button 
              intent="primary" 
              className="font-mono uppercase"
              onClick={() => window.open('https://docs.hopsworks.ai', '_blank')}
            >
              VIEW DOCUMENTATION →
            </Button>
            <Button 
              intent="secondary" 
              className="font-mono uppercase"
              onClick={() => window.open(`${cluster.endpoint}/jupyter`, '_blank')}
            >
              OPEN JUPYTER →
            </Button>
          </Flex>
        </Card>

        {/* Resources */}
        <Card className="bg-[#111511] border-grayShade2 p-6">
          <Title as="h3" className="text-lg font-mono uppercase mb-4">CLUSTER RESOURCES</Title>
          
          <Flex gap={16} wrap="wrap">
            <Badge variant="primary" className="font-mono">{cluster.specs.cpu}</Badge>
            <Badge variant="primary" className="font-mono">{cluster.specs.memory} RAM</Badge>
            <Badge variant="primary" className="font-mono">{cluster.specs.storage}</Badge>
          </Flex>

          <Text className="font-mono text-sm text-gray-400 mt-4">
            Need more resources? <Link href="/billing" className="text-[#1eb182] hover:underline">Upgrade your plan →</Link>
          </Text>
        </Card>
      </Box>
    </Box>
  );
}