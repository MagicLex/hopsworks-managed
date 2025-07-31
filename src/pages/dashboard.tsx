import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from 'tailwind-quartz';
import { CreditCard, Trash2, Server, LogOut, Database, Activity, Cpu, Users } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ClusterAccessStatus from '@/components/ClusterAccessStatus';

interface UsageData {
  cpuHours: number;
  gpuHours: number;
  storageGB: number;
  featureGroups: number;
  modelDeployments: number;
}

interface HopsworksInfo {
  hasCluster: boolean;
  clusterName?: string;
  hasHopsworksUser?: boolean;
  hopsworksUser?: {
    username: string;
    email: string;
    accountType: string;
    status: number;
    maxNumProjects: number;
    numActiveProjects: number;
    activated: string;
  };
  projects?: Array<{
    id: number;
    name: string;
    owner: string;
    created: string;
  }>;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { data: usage, loading: usageLoading } = useApiData<UsageData>('/api/usage');
  const { data: hopsworksInfo, loading: hopsworksLoading } = useApiData<HopsworksInfo>('/api/user/hopsworks-info');
  const [activeTab, setActiveTab] = useState('overview');

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
          <Flex justify="between" align="center" className="mb-8">
            <Title as="h1" className="text-2xl">Dashboard</Title>
            <Card className="p-4">
              <Text className="text-sm text-gray-600">Logged in as {user.email}</Text>
            </Card>
          </Flex>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="cluster">Cluster</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {/* Cluster Access Status */}
              <Box className="mb-6">
                <ClusterAccessStatus 
                  hasCluster={hopsworksInfo?.hasCluster || false}
                  hasPaymentMethod={false} // TODO: Get this from billing API
                  clusterName={hopsworksInfo?.clusterName}
                />
              </Box>

              {/* Usage Metrics */}
              <Box className="mb-6">
                <Title as="h2" className="text-lg mb-4">Current Usage</Title>
                <Flex gap={16} className="grid grid-cols-1 md:grid-cols-2">
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
                  {hopsworksInfo?.hasHopsworksUser && (
                    <Card className="p-4">
                      <Flex align="center" gap={8} className="mb-2">
                        <Database size={16} className="text-[#1eb182]" />
                        <Text className="text-sm text-gray-600">Projects</Text>
                      </Flex>
                      <Text className="text-xl font-semibold">
                        {hopsworksLoading ? '...' : (hopsworksInfo?.hopsworksUser?.numActiveProjects || '0')}
                      </Text>
                      <Text className="text-xs text-gray-500">Active projects</Text>
                    </Card>
                  )}
                </Flex>
              </Box>

              {hopsworksInfo?.projects && hopsworksInfo.projects.length > 0 && (
                <Card className="p-6">
                  <Flex align="center" gap={12} className="mb-4">
                    <Database size={20} className="text-[#1eb182]" />
                    <Title as="h2" className="text-lg">Your Projects</Title>
                  </Flex>
                  <Box className="space-y-2">
                    {hopsworksInfo.projects.map(project => (
                      <Flex key={project.id} justify="between" align="center" className="py-2 border-b border-gray-100 last:border-0">
                        <Box>
                          <Text className="font-medium">{project.name}</Text>
                          <Text className="text-xs text-gray-500">Created {new Date(project.created).toLocaleDateString()}</Text>
                        </Box>
                        <Badge variant="default" size="sm">ID: {project.id}</Badge>
                      </Flex>
                    ))}
                  </Box>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="cluster">
              {hopsworksInfo?.hasCluster ? (
                <Card className="p-6">
                  <Flex align="center" gap={12} className="mb-4">
                    <Server size={20} className="text-[#1eb182]" />
                    <Title as="h2" className="text-lg">Your Hopsworks Cluster</Title>
                    {hopsworksInfo?.hasHopsworksUser && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </Flex>
                  {hopsworksInfo?.clusterName && (
                    <Text className="text-sm font-medium mb-2">{hopsworksInfo.clusterName}</Text>
                  )}
                  {hopsworksInfo?.hasHopsworksUser && hopsworksInfo?.hopsworksUser && (
                    <Text className="text-sm text-gray-600 mb-2">
                      Username: {hopsworksInfo.hopsworksUser.username}
                    </Text>
                  )}
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
              ) : (
                <Card className="p-6">
                  <Title as="h2" className="text-lg mb-4">No Cluster Assigned</Title>
                  <Text className="text-sm text-gray-600">
                    Please add a payment method to get started with your Hopsworks cluster.
                  </Text>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="team">
              <Card className="p-6">
                <Flex align="center" gap={12} className="mb-4">
                  <Users size={20} className="text-[#1eb182]" />
                  <Title as="h2" className="text-lg">Team Management</Title>
                </Flex>
                <Text className="text-sm text-gray-600 mb-4">
                  Manage team members and invitations
                </Text>
                <Link href="/team">
                  <Button 
                    intent="primary"
                    className="uppercase"
                  >
                    Manage Team →
                  </Button>
                </Link>
              </Card>
            </TabsContent>

            <TabsContent value="billing">
              <Card className="p-6">
                <Flex align="center" gap={12} className="mb-4">
                  <CreditCard size={20} className="text-[#1eb182]" />
                  <Title as="h2" className="text-lg">Billing & Usage</Title>
                </Flex>
                <Text className="text-sm text-gray-600 mb-4">
                  View usage, manage Hops Credits and payment methods
                </Text>
                <Link href="/billing">
                  <Button 
                    intent="primary"
                    className="uppercase"
                  >
                    Manage Billing →
                  </Button>
                </Link>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
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
            </TabsContent>
          </Tabs>
        </Box>
      </Box>
    </>
  );
}