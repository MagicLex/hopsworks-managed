import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { CreditCard, Trash2, Server, LogOut, Database, Activity, Cpu, HardDrive } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface UsageData {
  cpuHours: number;
  gpuHours: number;
  storageGB: number;
  featureGroups: number;
  modelDeployments: number;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { data: usage, loading: usageLoading } = useApiData<UsageData>('/api/usage');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Dashboard - Hopsworks</title>
        <meta name="description" content="Manage your Hopsworks instance, monitor usage, and access your ML platform resources." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-6xl mx-auto">
          <Title as="h1" className="text-2xl mb-8">User Dashboard</Title>

          <Card className="p-6 mb-6">
            <Text className="text-sm text-gray-600 mb-2">Logged in as</Text>
            <Text className="text-lg">{user.email}</Text>
          </Card>

          {/* Usage Metrics */}
          <Box className="mb-6">
            <Title as="h2" className="text-lg mb-4">Current Usage</Title>
            <Flex gap={16} className="grid grid-cols-1 md:grid-cols-4">
              <Card className="p-4">
                <Flex align="center" gap={8} className="mb-2">
                  <Cpu size={16} className="text-[#1eb182]" />
                  <Text className="text-sm text-gray-600">Hops Credits</Text>
                </Flex>
                <Text className="text-xl font-semibold">
                  {usageLoading ? '...' : (usage?.cpuHours?.toFixed(0) || '0')}
                </Text>
                <Text className="text-xs text-gray-500">CPU hours this month</Text>
              </Card>
              <Card className="p-4">
                <Flex align="center" gap={8} className="mb-2">
                  <HardDrive size={16} className="text-[#1eb182]" />
                  <Text className="text-sm text-gray-600">Storage Used</Text>
                </Flex>
                <Text className="text-xl font-semibold">
                  {usageLoading ? '...' : `${usage?.storageGB?.toFixed(1) || '0'} GB`}
                </Text>
                <Text className="text-xs text-gray-500">current usage</Text>
              </Card>
              <Card className="p-4">
                <Flex align="center" gap={8} className="mb-2">
                  <Database size={16} className="text-[#1eb182]" />
                  <Text className="text-sm text-gray-600">Feature Groups</Text>
                </Flex>
                <Text className="text-xl font-semibold">
                  {usageLoading ? '...' : (usage?.featureGroups || '0')}
                </Text>
                <Text className="text-xs text-gray-500">Active feature groups</Text>
              </Card>
              <Card className="p-4">
                <Flex align="center" gap={8} className="mb-2">
                  <Activity size={16} className="text-[#1eb182]" />
                  <Text className="text-sm text-gray-600">Model Deployments</Text>
                </Flex>
                <Text className="text-xl font-semibold">
                  {usageLoading ? '...' : (usage?.modelDeployments || '0')}
                </Text>
                <Text className="text-xs text-gray-500">Live models</Text>
              </Card>
            </Flex>
          </Box>

          <Flex direction="column" gap={16}>
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Server size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Your Hopsworks Instance</Title>
                <Badge variant="success">Active</Badge>
              </Flex>
              <Text className="text-sm text-gray-600 mb-4">
                Access your feature store, model registry, and ML pipelines
              </Text>
              <Button 
                intent="primary"
                className="uppercase"
                onClick={() => router.push('/cluster')}
              >
                Access Hopsworks →
              </Button>
            </Card>

            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <CreditCard size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Billing</Title>
              </Flex>
              <Text className="text-sm text-gray-600 mb-4">
                View usage, manage Hops Credits and payment methods
              </Text>
              <Link href="/billing">
                <Button 
                  intent="secondary"
                  className="uppercase"
                >
                  Manage Billing →
                </Button>
              </Link>
            </Card>

            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Trash2 size={20} className="text-red-500" />
                <Title as="h2" className="text-lg">Account Settings</Title>
              </Flex>
              <Text className="text-sm text-gray-600 mb-4">
                Manage your account and data
              </Text>
              <Link href="/account">
                <Button 
                  intent="secondary"
                  className="uppercase"
                >
                  Account Settings →
                </Button>
              </Link>
            </Card>
          </Flex>

          <Flex justify="center" className="mt-8">
            <Button 
              intent="ghost" 
              className="text-sm"
              onClick={() => signOut()}
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </Button>
          </Flex>
        </Box>
      </Box>
    </>
  );
}