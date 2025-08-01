import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Modal, Input } from 'tailwind-quartz';
import { CreditCard, Trash2, Server, LogOut, Database, Activity, Cpu, Users, Copy, ExternalLink, CheckCircle, UserPlus, Mail, Download, Calendar, AlertTriangle } from 'lucide-react';
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

interface InstanceData {
  name: string;
  status: string;
  endpoint: string;
  plan: string;
  created: string | null;
}

interface TeamData {
  account_owner: {
    id: string;
    email: string;
    name: string;
  };
  team_members: Array<{
    id: string;
    email: string;
    name: string;
    created_at: string;
    last_login_at: string;
    hopsworks_username: string;
    hopsworks_project_id: number;
    status: string;
  }>;
  is_owner: boolean;
}

interface BillingInfo {
  billingMode: 'prepaid' | 'postpaid' | 'team';
  hasPaymentMethod: boolean;
  isTeamMember?: boolean;
  accountOwner?: {
    email: string;
    name?: string;
  };
  paymentMethodDetails?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  };
  subscriptionStatus?: string;
  prepaidEnabled: boolean;
  currentUsage: {
    cpuHours: string;
    storageGB: string;
    currentMonth: {
      cpuCost: number;
      storageCost: number;
      total: number;
    };
  };
  creditBalance?: {
    total: number;
    purchased: number;
    free: number;
  };
  invoices: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { data: usage, loading: usageLoading } = useApiData<UsageData>('/api/usage');
  const { data: hopsworksInfo, loading: hopsworksLoading } = useApiData<HopsworksInfo>('/api/user/hopsworks-info');
  const { data: instance, loading: instanceLoading } = useApiData<InstanceData>('/api/instance');
  const { data: teamData, loading: teamLoading } = useApiData<TeamData>('/api/team/members');
  const { data: billing, loading: billingLoading } = useApiData<BillingInfo>('/api/billing');
  const [activeTab, setActiveTab] = useState('cluster');
  const [copied, setCopied] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Handle tab query parameter
  useEffect(() => {
    if (router.query.tab && typeof router.query.tab === 'string') {
      setActiveTab(router.query.tab);
    }
  }, [router.query.tab]);

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
          {/* Team Member Banner */}
          {billing?.isTeamMember && (
            <Card className="p-4 mb-6 border-blue-200 bg-blue-50">
              <Flex align="center" gap={12}>
                <Users size={20} className="text-blue-600" />
                <Box className="flex-1">
                  <Text className="text-sm text-blue-800">
                    You are part of <strong>{billing.accountOwner?.name || billing.accountOwner?.email}</strong>&apos;s team. 
                    Your usage is billed to the account owner.
                  </Text>
                </Box>
              </Flex>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="cluster">Cluster</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="cluster">
              {/* Cluster Access Status */}
              <Box className="mb-6">
                <ClusterAccessStatus 
                  hasCluster={hopsworksInfo?.hasCluster || false}
                  hasPaymentMethod={billing?.hasPaymentMethod || false}
                  clusterName={hopsworksInfo?.clusterName}
                />
              </Box>


              {instance ? (
                <>
                  <Card className="p-6 mb-6">
                    <Flex align="center" gap={12} className="mb-4">
                      <Server size={20} className="text-[#1eb182]" />
                      <Title as="h2" className="text-lg">Your Hopsworks Instance</Title>
                      <Badge variant={instance.status === 'active' ? 'success' : 'default'}>
                        {instance.status || 'Unknown'}
                      </Badge>
                    </Flex>
                    
                    <Box className="space-y-3">
                      <Flex justify="between">
                        <Text className="text-sm text-gray-600">Instance Name</Text>
                        <Text className="text-sm font-medium">{instance.name}</Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text className="text-sm text-gray-600">Plan</Text>
                        <Text className="text-sm font-medium">{instance.plan}</Text>
                      </Flex>
                      
                      {instance.created && (
                        <Flex justify="between">
                          <Text className="text-sm text-gray-600">Created</Text>
                          <Text className="text-sm font-medium">
                            {new Date(instance.created).toLocaleDateString()}
                          </Text>
                        </Flex>
                      )}
                      
                      <Box className="pt-3 border-t border-gray-100">
                        <Flex justify="between" align="center">
                          <Text className="text-sm text-gray-600">Endpoint</Text>
                          <Flex gap={8}>
                            <Text className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
                              {instance.endpoint}
                            </Text>
                            <Button
                              intent="ghost"
                              className="p-1"
                              onClick={() => {
                                navigator.clipboard.writeText(instance.endpoint);
                                setCopied('endpoint');
                                setTimeout(() => setCopied(''), 2000);
                              }}
                            >
                              {copied === 'endpoint' ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </Button>
                          </Flex>
                        </Flex>
                      </Box>
                    </Box>
                    
                    <Flex gap={12} className="mt-6">
                      <Button 
                        intent="primary"
                        className="uppercase flex-1"
                        onClick={() => {
                          // Redirect to auto-OAuth URL for automatic login with Auth0
                          const autoOAuthUrl = `${instance.endpoint}/autoOAuth?providerName=Auth0`;
                          window.open(autoOAuthUrl, '_blank');
                        }}
                      >
                        <ExternalLink size={16} className="mr-2" />
                        Access Hopsworks
                      </Button>
                    </Flex>
                  </Card>
                  
                  {/* Quick Start Code */}
                  <Card className="p-6 mb-6">
                    <Title as="h3" className="text-lg mb-4">Quick Start</Title>
                    
                    <Text className="text-sm text-gray-600 mb-4">
                      Connect to your instance using the Hopsworks Python client:
                    </Text>

                    <Card variant="readOnly" className="relative">
                      <Button
                        intent="ghost"
                        className="absolute top-2 right-2 text-xs p-1"
                        onClick={() => {
                          const code = `# Feature Pipeline (Hopsworks)
import hopsworks

# Login with host
project = hopsworks.login(
    host="${instance?.endpoint || 'https://your-hopsworks-instance.com'}"
)
fs = project.get_feature_store()

# Create feature group
fg = fs.get_or_create_feature_group(
    name='user_features',
    version=1,
    primary_key=['user_id'],
    online=True,
    description='User features based on order history'
)

print(f"Feature group '{fg.name}' created/retrieved successfully")`;
                          navigator.clipboard.writeText(code);
                          setCopied('quickstart');
                          setTimeout(() => setCopied(''), 2000);
                        }}
                      >
                        {copied === 'quickstart' ? (
                          <Flex align="center" gap={4}>
                            <CheckCircle size={12} />
                            <Text className="text-xs">Copied!</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap={4}>
                            <Copy size={12} />
                            <Text className="text-xs">Copy</Text>
                          </Flex>
                        )}
                      </Button>
                      <pre className="overflow-x-auto p-4 text-sm bg-gray-900 text-gray-300 rounded">
                        <code>
                          <span className="text-gray-500"># Feature Pipeline (Hopsworks)</span>
                          {'\n'}
                          <span className="text-purple-400">import</span> <span className="text-green-400">hopsworks</span>
                          {'\n\n'}
                          <span className="text-gray-500"># Login with host</span>
                          {'\n'}
                          <span className="text-blue-300">project</span> = <span className="text-green-400">hopsworks</span>.<span className="text-yellow-300">login</span>(
                          {'\n    '}
                          <span className="text-orange-300">host</span>=<span className="text-green-300">&quot;{instance?.endpoint || 'your-hopsworks-instance.com'}&quot;</span>
                          {'\n'}
                          )
                          {'\n'}
                          <span className="text-blue-300">fs</span> = <span className="text-blue-300">project</span>.<span className="text-yellow-300">get_feature_store</span>()
                          {'\n\n'}
                          <span className="text-gray-500"># Create feature group</span>
                          {'\n'}
                          <span className="text-blue-300">fg</span> = <span className="text-blue-300">fs</span>.<span className="text-yellow-300">get_or_create_feature_group</span>(
                          {'\n    '}
                          <span className="text-orange-300">name</span>=<span className="text-green-300">&apos;user_features&apos;</span>,
                          {'\n    '}
                          <span className="text-orange-300">version</span>=<span className="text-purple-300">1</span>,
                          {'\n    '}
                          <span className="text-orange-300">primary_key</span>=[<span className="text-green-300">&apos;user_id&apos;</span>],
                          {'\n    '}
                          <span className="text-orange-300">online</span>=<span className="text-purple-300">True</span>,
                          {'\n    '}
                          <span className="text-orange-300">description</span>=<span className="text-green-300">&apos;User features based on order history&apos;</span>
                          {'\n'}
                          )
                          {'\n\n'}
                          <span className="text-purple-400">print</span>(<span className="text-purple-400">f</span><span className="text-green-300">&quot;Feature group &apos;{'{fg.name}'}&apos; created/retrieved successfully&quot;</span>)
                        </code>
                      </pre>
                    </Card>
                  </Card>

                  {/* Usage Metrics */}
                  <Box className="mb-6">
                    <Title as="h2" className="text-lg mb-4">Current Usage</Title>
                    <Flex gap={16} className="grid grid-cols-1 md:grid-cols-2">
                      <Card className="p-4">
                        <Flex align="center" gap={8} className="mb-2">
                          <Cpu size={16} className="text-[#1eb182]" />
                          <Text className="text-sm text-gray-600">CPU Hours</Text>
                        </Flex>
                        <Text className="text-xl font-semibold">
                          {usageLoading ? '...' : (usage?.cpuHours?.toFixed(0) || '0')}
                        </Text>
                        <Text className="text-xs text-gray-500">This month</Text>
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
                </>
              ) : (
                <Card className="p-6">
                  <Title as="h2" className="text-lg mb-4">No Cluster Assigned</Title>
                  <Text className="text-sm text-gray-600 mb-4">
                    Please add a payment method to get started with your Hopsworks cluster.
                  </Text>
                  <Button
                    intent="primary"
                    onClick={() => setActiveTab('billing')}
                  >
                    Add Payment Method
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="team">
              {teamData?.is_owner ? (
                // Account owner view
                <Card className="p-6">
                  <Flex align="center" gap={12} className="mb-4">
                    <Users size={20} className="text-[#1eb182]" />
                    <Title as="h2" className="text-lg">Team Members</Title>
                    <Badge variant="default">{(teamData.team_members?.length || 0) + 1}</Badge>
                  </Flex>
                  
                  {teamLoading ? (
                    <Text className="text-sm text-gray-600">Loading team members...</Text>
                  ) : (
                    <Box className="space-y-3">
                      {/* Account Owner */}
                      <Card variant="readOnly" className="p-4">
                        <Flex justify="between" align="center">
                          <Box>
                            <Flex align="center" gap={8}>
                              <Text className="font-medium">{teamData.account_owner.name || teamData.account_owner.email}</Text>
                              <Badge variant="primary" size="sm">Owner</Badge>
                            </Flex>
                            <Text className="text-sm text-gray-600">{teamData.account_owner.email}</Text>
                          </Box>
                        </Flex>
                      </Card>

                      {/* Team Members */}
                      {teamData.team_members && teamData.team_members.length > 0 ? (
                        teamData.team_members.map(member => (
                          <Card key={member.id} variant="readOnly" className="p-4">
                            <Flex justify="between" align="center">
                              <Box>
                                <Text className="font-medium">{member.name || member.email}</Text>
                                <Text className="text-sm text-gray-600">{member.email}</Text>
                                {member.hopsworks_username && (
                                  <Text className="text-xs text-gray-500">
                                    Hopsworks: {member.hopsworks_username}
                                  </Text>
                                )}
                              </Box>
                              <Flex align="center" gap={12}>
                                {member.last_login_at && (
                                  <Text className="text-xs text-gray-500">
                                    Last login: {new Date(member.last_login_at).toLocaleDateString()}
                                  </Text>
                                )}
                                <Badge variant={member.status === 'active' ? 'success' : 'default'} size="sm">
                                  {member.status}
                                </Badge>
                              </Flex>
                            </Flex>
                          </Card>
                        ))
                      ) : (
                        <Text className="text-sm text-gray-600 mt-4">No team members yet.</Text>
                      )}
                    </Box>
                  )}
                  
                  <Flex gap={12} className="mt-6">
                    <Button
                      intent="primary"
                      onClick={() => setShowInviteModal(true)}
                    >
                      <UserPlus size={16} className="mr-2" />
                      Invite Member
                    </Button>
                    <Link href="/team">
                      <Button intent="secondary">
                        Manage Team
                      </Button>
                    </Link>
                  </Flex>
                </Card>
              ) : (
                // Team member view
                <Card className="p-6">
                  <Flex align="center" gap={12} className="mb-4">
                    <Users size={20} className="text-[#1eb182]" />
                    <Title as="h2" className="text-lg">Team Information</Title>
                  </Flex>
                  
                  <Card className="p-4 border-blue-200 bg-blue-50">
                    <Text className="text-sm text-blue-800">
                      You are part of <strong>{teamData?.account_owner.name || teamData?.account_owner.email}</strong>&apos;s team.
                    </Text>
                    <Text className="text-xs text-blue-700 mt-2">
                      Your usage is billed to the account owner. Contact them for billing or team management.
                    </Text>
                  </Card>

                  {/* Show other team members */}
                  {teamData?.team_members && teamData.team_members.length > 1 && (
                    <Box className="mt-6">
                      <Text className="text-sm font-medium mb-3">Other Team Members</Text>
                      <Box className="space-y-2">
                        {teamData.team_members.filter(m => m.id !== user?.sub).map(member => (
                          <Card key={member.id} variant="readOnly" className="p-3">
                            <Box>
                              <Text className="text-sm font-medium">{member.name || member.email}</Text>
                              <Text className="text-xs text-gray-600">{member.email}</Text>
                            </Box>
                          </Card>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Card>
              )}
            </TabsContent>

            <TabsContent value="billing">
              {billing && (
                <>
                  {/* Team member billing notice */}
                  {billing.isTeamMember ? (
                    <Card className="p-6 border-blue-200 bg-blue-50">
                      <Flex align="center" gap={12}>
                        <Users size={20} className="text-blue-600" />
                        <Box className="flex-1">
                          <Text className="text-sm text-blue-800">
                            Your usage is billed to <strong>{billing.accountOwner?.name || billing.accountOwner?.email}</strong>. 
                            Contact your account owner for billing information.
                          </Text>
                        </Box>
                      </Flex>
                    </Card>
                  ) : (
                    <>
                      {/* Low balance warnings */}
                      {!billing.hasPaymentMethod && billing.billingMode === 'postpaid' && (
                        <Card className="p-6 mb-6 border-yellow-500 bg-yellow-50">
                          <Flex align="center" gap={12}>
                            <AlertTriangle size={20} className="text-yellow-600" />
                            <Box>
                              <Title as="h3" className="text-sm">Add Payment Method Required</Title>
                              <Text className="text-xs text-gray-600">
                                Add a credit card to start using Hopsworks resources
                              </Text>
                            </Box>
                          </Flex>
                        </Card>
                      )}
                      
                      {billing.billingMode === 'prepaid' && billing.creditBalance && billing.creditBalance.total < 10 && (
                        <Card className="p-6 mb-6 border-yellow-500 bg-yellow-50">
                          <Flex align="center" gap={12}>
                            <AlertTriangle size={20} className="text-yellow-600" />
                            <Box>
                              <Title as="h3" className="text-sm">Low Credit Balance</Title>
                              <Text className="text-xs text-gray-600">
                                Your credit balance is running low. Purchase more credits to avoid service interruption.
                              </Text>
                            </Box>
                          </Flex>
                        </Card>
                      )}

                      {/* Current Month Usage */}
                      <Card className="p-6 mb-6">
                        <Flex align="center" gap={12} className="mb-4">
                          <Activity size={20} className="text-[#1eb182]" />
                          <Title as="h2" className="text-lg">Current Month Usage</Title>
                        </Flex>
                        
                        <Flex gap={16} className="grid grid-cols-1 md:grid-cols-3 mb-4">
                          <Box>
                            <Text className="text-sm text-gray-600">CPU Hours</Text>
                            <Text className="text-xl font-semibold">
                              {billing.currentUsage.cpuHours || '0'}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              ${(parseFloat(billing.currentUsage.cpuHours || '0') * 1).toFixed(2)}
                            </Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray-600">Storage GB</Text>
                            <Text className="text-xl font-semibold">
                              {billing.currentUsage.storageGB || '0'}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              ${(parseFloat(billing.currentUsage.storageGB || '0') * 0.03).toFixed(2)}
                            </Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray-600">Total</Text>
                            <Text className="text-xl font-semibold">
                              ${billing.currentUsage.currentMonth.total.toFixed(2)}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              {billing.billingMode === 'prepaid' ? 'This month' : 'Estimated'}
                            </Text>
                          </Box>
                        </Flex>
                      </Card>

                      {/* Credit Balance for Prepaid Users */}
                      {billing.billingMode === 'prepaid' && billing.prepaidEnabled && billing.creditBalance && (
                        <Card className="p-6 mb-6">
                          <Flex align="center" gap={12} className="mb-4">
                            <CreditCard size={20} className="text-[#1eb182]" />
                            <Title as="h2" className="text-lg">Credit Balance</Title>
                          </Flex>
                          
                          <Flex gap={16} className="grid grid-cols-1 md:grid-cols-3 mb-4">
                            <Box>
                              <Text className="text-sm text-gray-600">Total Balance</Text>
                              <Text className="text-xl font-semibold">${billing.creditBalance.total.toFixed(2)}</Text>
                            </Box>
                            <Box>
                              <Text className="text-sm text-gray-600">Purchased Credits</Text>
                              <Text className="text-xl font-semibold">${billing.creditBalance.purchased.toFixed(2)}</Text>
                            </Box>
                            <Box>
                              <Text className="text-sm text-gray-600">Free Credits</Text>
                              <Text className="text-xl font-semibold">${billing.creditBalance.free.toFixed(2)}</Text>
                            </Box>
                          </Flex>
                          
                          <Button 
                            intent="primary"
                            onClick={async () => {
                              const response = await fetch('/api/billing/purchase-credits', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ amount: 50 })
                              });
                              const data = await response.json();
                              if (data.checkoutUrl) {
                                window.location.href = data.checkoutUrl;
                              }
                            }}
                          >
                            Purchase More Credits
                          </Button>
                        </Card>
                      )}

                      {/* Payment Method */}
                      <Card className="p-6 mb-6">
                        <Flex align="center" gap={12} className="mb-4">
                          <CreditCard size={20} className="text-[#1eb182]" />
                          <Title as="h2" className="text-lg">Payment Method</Title>
                        </Flex>
                        
                        {billing.hasPaymentMethod ? (
                          <Box className="space-y-3">
                            {billing.paymentMethodDetails?.card && (
                              <Card variant="readOnly" className="p-4">
                                <Flex justify="between" align="center">
                                  <Flex align="center" gap={12}>
                                    <CreditCard size={18} className="text-gray-500" />
                                    <Box>
                                      <Text className="text-sm font-medium capitalize">
                                        {billing.paymentMethodDetails.card.brand} •••• {billing.paymentMethodDetails.card.last4}
                                      </Text>
                                      <Text className="text-xs text-gray-500">
                                        Expires {String(billing.paymentMethodDetails.card.expMonth).padStart(2, '0')}/{billing.paymentMethodDetails.card.expYear}
                                      </Text>
                                    </Box>
                                  </Flex>
                                  <Badge variant="success" size="sm">Active</Badge>
                                </Flex>
                              </Card>
                            )}
                            {!billing.paymentMethodDetails && (
                              <Text className="text-sm text-gray-600">Payment method on file</Text>
                            )}
                            <Button
                              intent="ghost"
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/billing/setup-payment', {
                                    method: 'POST'
                                  });
                                  const data = await response.json();
                                  if (data.portalUrl) {
                                    window.open(data.portalUrl, '_blank');
                                  }
                                } catch (error) {
                                  console.error('Failed to open billing portal:', error);
                                }
                              }}
                            >
                              Manage Payment Methods
                            </Button>
                          </Box>
                        ) : (
                          <Text className="text-sm text-gray-600">No payment methods added yet.</Text>
                        )}
                      </Card>

                      {/* Invoices */}
                      {billing.hasPaymentMethod && (
                        <Card className="p-6 mb-6">
                          <Flex align="center" gap={12} className="mb-4">
                            <Calendar size={20} className="text-[#1eb182]" />
                            <Title as="h2" className="text-lg">Recent Invoices</Title>
                          </Flex>
                          
                          {billing.invoices && billing.invoices.length > 0 ? (
                            <Box className="space-y-2">
                              {billing.invoices.slice(0, 5).map(invoice => (
                                <Flex key={invoice.id} justify="between" align="center" className="py-2 border-b border-gray-100 last:border-0">
                                  <Box>
                                    <Text className="text-sm font-medium">{invoice.invoice_number}</Text>
                                    <Text className="text-xs text-gray-500">
                                      {new Date(invoice.created_at).toLocaleDateString()}
                                    </Text>
                                  </Box>
                                  <Flex align="center" gap={12}>
                                    <Text className="text-sm font-medium">${invoice.amount.toFixed(2)}</Text>
                                    <Badge variant="success" size="sm">{invoice.status}</Badge>
                                  </Flex>
                                </Flex>
                              ))}
                            </Box>
                          ) : (
                            <Text className="text-sm text-gray-500">No invoices yet</Text>
                          )}
                        </Card>
                      )}

                      {/* Pricing Info */}
                      <Card className="p-6">
                        <Title as="h2" className="text-lg mb-4">Pay-As-You-Go Pricing</Title>
                        
                        <Box className="space-y-3">
                          <Card variant="readOnly" className="p-4">
                            <Flex justify="between">
                              <Text className="text-sm text-gray-600">CPU Usage</Text>
                              <Text className="text-sm font-medium">$1.00 / hour</Text>
                            </Flex>
                          </Card>
                          <Card variant="readOnly" className="p-4">
                            <Flex justify="between">
                              <Text className="text-sm text-gray-600">Storage</Text>
                              <Text className="text-sm font-medium">$0.03 / GB / month</Text>
                            </Flex>
                          </Card>
                          
                          <Text className="text-xs text-gray-500 mt-2">
                            Usage is calculated hourly and billed monthly. No minimum commitment.
                          </Text>
                        </Box>
                      </Card>
                    </>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <Card className="p-6 mb-6">
                <Title as="h2" className="text-lg mb-4">Account Information</Title>
                <Flex direction="column" gap={12}>
                  <Box>
                    <Text className="text-sm text-gray-600">Email</Text>
                    <Text className="font-medium">{user.email}</Text>
                  </Box>
                  <Box>
                    <Text className="text-sm text-gray-600">User ID</Text>
                    <Text className="text-xs font-mono">{user.sub}</Text>
                  </Box>
                </Flex>
              </Card>
              
              <Card className="p-6 mb-6">
                <Flex align="center" gap={12} className="mb-4">
                  <Trash2 size={20} className="text-red-500" />
                  <Title as="h2" className="text-lg">Danger Zone</Title>
                </Flex>
                <Text className="text-sm text-gray-600 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </Text>
                <Button 
                  intent="secondary"
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      try {
                        const response = await fetch('/api/account/delete', { method: 'DELETE' });
                        if (response.ok) {
                          await signOut();
                        } else {
                          alert('Failed to delete account. Please try again.');
                        }
                      } catch (error) {
                        alert('Failed to delete account. Please try again.');
                      }
                    }
                  }}
                >
                  Delete Account
                </Button>
              </Card>

              <Flex justify="center">
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
      
      {/* Invite Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Box className="p-6">
          <Title as="h2" className="text-lg mb-4">Invite Team Member</Title>
          <Text className="text-sm text-gray-600 mb-4">
            They&apos;ll receive an email invitation to join your Hopsworks team.
          </Text>
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="mb-4"
          />
          {inviteError && (
            <Text className="text-sm text-red-500 mb-4">{inviteError}</Text>
          )}
          <Flex gap={12} justify="end">
            <Button
              intent="ghost"
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteError('');
              }}
            >
              Cancel
            </Button>
            <Button
              intent="primary"
              disabled={!inviteEmail || inviteLoading}
              onClick={async () => {
                setInviteError('');
                setInviteLoading(true);
                try {
                  const response = await fetch('/api/team/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: inviteEmail })
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.error || 'Failed to send invite');
                  }
                  setShowInviteModal(false);
                  setInviteEmail('');
                  // Optionally refresh team members
                } catch (error: any) {
                  setInviteError(error.message || 'Failed to send invite');
                } finally {
                  setInviteLoading(false);
                }
              }}
            >
              {inviteLoading ? 'Sending...' : 'Send Invite'}
            </Button>
          </Flex>
        </Box>
      </Modal>
    </>
  );
}