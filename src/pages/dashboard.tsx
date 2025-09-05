import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Modal, Input, Select } from 'tailwind-quartz';
import { CreditCard, Trash2, Server, LogOut, Database, Activity, Cpu, Users, Copy, ExternalLink, CheckCircle, UserPlus, Mail, Download, Calendar, AlertTriangle, TrendingUp, Clock, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ClusterAccessStatus from '@/components/ClusterAccessStatus';
import TeamMemberProjects from '@/components/team/TeamMemberProjects';
import CardSkeleton from '@/components/CardSkeleton';
import { DEFAULT_RATES } from '@/config/billing-rates';
import { usePricing } from '@/contexts/PricingContext';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageData {
  cpuHours: number;
  gpuHours: number;
  ramGbHours?: number;
  storageGB: number;
  featureGroups: number;
  modelDeployments: number;
  lastUpdate?: string;
  projectBreakdown?: Record<string, {
    cpuHours: number;
    gpuHours: number;
    ramGBHours: number;
  }>;
}

interface HopsworksInfo {
  hasCluster: boolean;
  clusterName?: string;
  clusterEndpoint?: string;
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
    status: string;
  }>;
  is_owner: boolean;
}

interface TeamInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  created_at: string;
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
      baseCost: number;
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
    invoice_url?: string;
    pdf_url?: string;
    total?: number;
    currency?: string;
  }>;
  historicalUsage?: Array<{
    date: string;
    cpu_hours: number;
    gpu_hours: number;
    storage_gb: number;
    total_cost: number;
  }>;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { pricing } = usePricing();
  const router = useRouter();
  const { data: usage, loading: usageLoading } = useApiData<UsageData>('/api/usage');
  const { data: hopsworksInfo, loading: hopsworksLoading } = useApiData<HopsworksInfo>('/api/user/hopsworks-info');
  const { data: instance, loading: instanceLoading } = useApiData<InstanceData>('/api/instance');
  const { data: teamData, loading: teamLoading, refetch: refetchTeamData } = useApiData<TeamData>('/api/team/members');
  const { data: billing, loading: billingLoading, refetch: refetchBilling } = useApiData<BillingInfo>('/api/billing');
  const [activeTab, setActiveTab] = useState('cluster');
  const [copied, setCopied] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Data scientist');
  const [autoAssignProjects, setAutoAssignProjects] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Handle tab query parameter
  useEffect(() => {
    if (router.query.tab && typeof router.query.tab === 'string') {
      // Redirect prepaid users away from billing tab
      if (router.query.tab === 'billing' && billing?.billingMode === 'prepaid') {
        setActiveTab('cluster');
      } else {
        setActiveTab(router.query.tab);
      }
    }
  }, [router.query.tab, billing?.billingMode]);

  // Fetch team invites when user and team data is available
  useEffect(() => {
    if (user && teamData?.is_owner) {
      fetchInvites();
    }
  }, [user, teamData]);

  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/team/invite');
      if (!response.ok) throw new Error('Failed to fetch invites');
      const data = await response.json();
      setInvites(data.invites || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  const handleInvite = async () => {
    setInviteError('');
    setInviteLoading(true);
    
    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: inviteEmail,
          projectRole: inviteRole,
          autoAssignProjects 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      await fetchInvites();
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('Data scientist');
      setAutoAssignProjects(true);
    } catch (error: any) {
      setInviteError(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const response = await fetch(`/api/team/members?memberId=${memberId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to remove member');
      
      await refetchTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/team/invite?inviteId=${inviteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to cancel invite');
      
      await fetchInvites();
    } catch (error) {
      console.error('Error canceling invite:', error);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/team/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    alert('Invite link copied to clipboard!');
  };

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
      <Layout className="py-10 px-5">
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
              {billing?.billingMode !== 'prepaid' && (
                <TabsTrigger value="billing">Billing</TabsTrigger>
              )}
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="cluster">
              {/* Cluster Access Status */}
              <Box className="mb-6">
                <ClusterAccessStatus 
                  hasCluster={hopsworksInfo?.hasCluster || false}
                  hasPaymentMethod={billing?.hasPaymentMethod || false}
                  billingMode={billing?.billingMode}
                  clusterName={hopsworksInfo?.clusterName}
                  loading={hopsworksLoading || billingLoading}
                />
              </Box>

              {instance && instance.endpoint ? (
                <>
                  {/* Usage Metrics - moved to top */}
                  <Box className="mb-6">
                    <Title as="h2" className="text-lg mb-4">Current Usage</Title>
                    <Flex gap={16} className="grid grid-cols-1 md:grid-cols-2">
                      {usageLoading ? (
                        <CardSkeleton rows={2} showIcon={false} />
                      ) : (
                        <Card className="p-4">
                          <Flex align="center" gap={8} className="mb-2">
                            <Cpu size={16} className="text-[#1eb182]" />
                            <Text className="text-sm text-gray-600">Credits Used</Text>
                          </Flex>
                          <Text className="text-xl font-semibold">
                            {usage?.cpuHours?.toFixed(0) || '0'}
                          </Text>
                          <Text className="text-xs text-gray-500">This month</Text>
                        </Card>
                      )}
                      {hopsworksLoading ? (
                        <CardSkeleton rows={2} showIcon={false} />
                      ) : hopsworksInfo?.hasHopsworksUser ? (
                        <Card className="p-4">
                          <Flex align="center" gap={8} className="mb-2">
                            <Database size={16} className="text-[#1eb182]" />
                            <Text className="text-sm text-gray-600">Projects</Text>
                          </Flex>
                          <Text className="text-xl font-semibold">
                            {hopsworksInfo?.hopsworksUser?.numActiveProjects || '0'}
                          </Text>
                          <Text className="text-xs text-gray-500">Active projects</Text>
                          {
                            <Box className="mt-3 pt-3 border-t border-gray-100">
                              {hopsworksInfo?.projects && hopsworksInfo.projects.length > 0 ? (
                                <Flex gap={6} className="flex-wrap">
                                  {hopsworksInfo.projects.slice(0, 3).map(project => (
                                    <a
                                      key={project.id}
                                      href={`${instance?.endpoint || hopsworksInfo?.clusterEndpoint || ''}/p/${project.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1eb182]/10 hover:bg-[#1eb182]/20 text-[#1eb182] rounded-full text-sm font-medium transition-colors"
                                    >
                                      <FolderOpen size={14} />
                                      <span>{project.name}</span>
                                      <ExternalLink size={12} />
                                    </a>
                                  ))}
                                  {hopsworksInfo.projects.length > 3 && (
                                    <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full text-sm">
                                      +{hopsworksInfo.projects.length - 3} more
                                    </span>
                                  )}
                                </Flex>
                              ) : (
                                <Text className="text-xs text-gray-500">No projects yet</Text>
                              )}
                            </Box>
                          }
                        </Card>
                      ) : null}
                    </Flex>
                  </Box>

                  {instanceLoading ? (
                    <CardSkeleton rows={4} className="mb-6" />
                  ) : (
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
                              size="md"
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
                        intent={instance.endpoint ? "primary" : "secondary"}
                        size="md"
                        className="uppercase flex-1"
                        disabled={!instance.endpoint}
                        onClick={() => {
                          if (instance.endpoint) {
                            // Redirect to auto-OAuth URL for automatic login with Auth0
                            const autoOAuthUrl = `${instance.endpoint}/autoOAuth?providerName=Auth0`;
                            window.open(autoOAuthUrl, '_blank');
                            
                            // Only trigger sync if user needs it (missing Hopsworks info or payment but no projects)
                            const needsSync = !hopsworksInfo?.hopsworksUser || 
                                            (billing?.hasPaymentMethod && (!hopsworksInfo?.projects || hopsworksInfo.projects.length === 0));
                            
                            if (needsSync) {
                              // Trigger sync-user after 2 seconds to fix maxNumProjects
                              // This allows time for OAuth2 to create the user in Hopsworks
                              setTimeout(async () => {
                                try {
                                  await fetch('/api/auth/sync-user', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({})
                                  });
                                  console.log('Triggered sync-user after Hopsworks access');
                                } catch (error) {
                                  console.error('Failed to trigger sync-user:', error);
                                }
                              }, 2000);
                            }
                          }
                        }}
                      >
                        {instance.endpoint ? 'Access Hopsworks' : 'No Cluster Assigned'}
                      </Button>
                    </Flex>
                    </Card>
                  )}
                  
                  {/* Quick Start Code */}
                  <Card className="p-6 mb-6">
                    <Title as="h3" className="text-lg mb-4">Quick Start - Connect from VS Code</Title>
                    
                    <Text className="text-sm text-gray-600 mb-4">
                      Connect to your Hopsworks cluster from VS Code, Jupyter notebooks, or any local environment:
                    </Text>

                    <Box className="relative">
                      <Button
                        intent="ghost"
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          // Extract host and port from endpoint URL if available
                          let host = '162.19.238.22';
                          let port = 28181;
                          if (instance?.endpoint) {
                            try {
                              const url = new URL(instance.endpoint);
                              host = url.hostname;
                              port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
                            } catch (e) {
                              // Fallback to defaults
                            }
                          }
                          
                          const code = `# Install Hopsworks Python client
!pip install "hopsworks[python]"

# Connect to Hopsworks
import hopsworks

project = hopsworks.login(
    project='mlops_preflight',  # or other project
    host="${host}",
    port=${port},
    api_key_value="your api key"  # Get from Hopsworks UI > Account Settings > API Keys
)

# Access the feature store
fs = project.get_feature_store()

# Example: Read an existing feature group
fg = fs.get_feature_group(
    name="your_feature_group",
    version=1
)

# Read data from the feature group
df = fg.read()
print(f"Connected to {project.name}. Feature group has {len(df)} rows")

# For model serving
ms = project.get_model_serving()

# For model registry
mr = project.get_model_registry()`;
                          navigator.clipboard.writeText(code);
                          setCopied('quickstart');
                          setTimeout(() => setCopied(''), 2000);
                        }}
                      >
                        {copied === 'quickstart' ? (
                          <Flex align="center" gap={4}>
                            <CheckCircle size={14} className="text-green-500" />
                            <Text className="text-xs text-white">Copied!</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap={4}>
                            <Copy size={14} className="text-gray-300" />
                            <Text className="text-xs text-white">Copy</Text>
                          </Flex>
                        )}
                      </Button>
                      <pre className="overflow-x-auto p-4 text-sm bg-gray-900 text-gray-300 rounded">
                        <code>
                          <span className="text-gray-500"># Install Hopsworks Python client</span>
                          {'\n'}
                          <span className="text-yellow-300">!pip install</span> <span className="text-green-300">&quot;hopsworks[python]&quot;</span>
                          {'\n\n'}
                          <span className="text-gray-500"># Connect to Hopsworks</span>
                          {'\n'}
                          <span className="text-purple-400">import</span> <span className="text-green-400">hopsworks</span>
                          {'\n\n'}
                          <span className="text-blue-300">project</span> = <span className="text-green-400">hopsworks</span>.<span className="text-yellow-300">login</span>(
                          {'\n    '}
                          <span className="text-orange-300">project</span>=<span className="text-green-300">&apos;mlops_preflight&apos;</span>,  <span className="text-gray-500"># or other project</span>
                          {'\n    '}
                          <span className="text-orange-300">host</span>=<span className="text-green-300">&quot;{(() => {
                            if (instance?.endpoint) {
                              try {
                                const url = new URL(instance.endpoint);
                                return url.hostname;
                              } catch (e) {}
                            }
                            return '162.19.238.22';
                          })()}&quot;</span>,
                          {'\n    '}
                          <span className="text-orange-300">port</span>=<span className="text-purple-300">{(() => {
                            if (instance?.endpoint) {
                              try {
                                const url = new URL(instance.endpoint);
                                return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
                              } catch (e) {}
                            }
                            return 28181;
                          })()}</span>,
                          {'\n    '}
                          <span className="text-orange-300">api_key_value</span>=<span className="text-green-300">&quot;your api key&quot;</span>  <span className="text-gray-500"># Get from Hopsworks UI &gt; Account Settings &gt; API Keys</span>
                          {'\n'}
                          )
                          {'\n\n'}
                          <span className="text-gray-500"># Access the feature store</span>
                          {'\n'}
                          <span className="text-blue-300">fs</span> = <span className="text-blue-300">project</span>.<span className="text-yellow-300">get_feature_store</span>()
                          {'\n\n'}
                          <span className="text-gray-500"># Example: Read an existing feature group</span>
                          {'\n'}
                          <span className="text-blue-300">fg</span> = <span className="text-blue-300">fs</span>.<span className="text-yellow-300">get_feature_group</span>(
                          {'\n    '}
                          <span className="text-orange-300">name</span>=<span className="text-green-300">&quot;your_feature_group&quot;</span>,
                          {'\n    '}
                          <span className="text-orange-300">version</span>=<span className="text-purple-300">1</span>
                          {'\n'}
                          )
                          {'\n\n'}
                          <span className="text-gray-500"># Read data from the feature group</span>
                          {'\n'}
                          <span className="text-blue-300">df</span> = <span className="text-blue-300">fg</span>.<span className="text-yellow-300">read</span>()
                          {'\n'}
                          <span className="text-purple-400">print</span>(<span className="text-purple-400">f</span><span className="text-green-300">&quot;Connected to {'{project.name}'}. Feature group has {'{len(df)}'} rows&quot;</span>)
                          {'\n\n'}
                          <span className="text-gray-500"># For model serving</span>
                          {'\n'}
                          <span className="text-blue-300">ms</span> = <span className="text-blue-300">project</span>.<span className="text-yellow-300">get_model_serving</span>()
                          {'\n\n'}
                          <span className="text-gray-500"># For model registry</span>
                          {'\n'}
                          <span className="text-blue-300">mr</span> = <span className="text-blue-300">project</span>.<span className="text-yellow-300">get_model_registry</span>()
                        </code>
                      </pre>
                    </Box>
                  </Card>

                </>
              ) : (
                <Box>
                  {/* Empty state - ClusterAccessStatus component above already shows the setup message */}
                </Box>
              )}
            </TabsContent>

            <TabsContent value="team">
              <Box className="space-y-6">
                {teamLoading ? (
                  <>
                    <CardSkeleton rows={4} />
                    <CardSkeleton rows={3} />
                  </>
                ) : teamData?.is_owner ? (
                  <>
                    {/* Team Members Card */}
                    <Card className="p-6">
                      <Flex align="center" gap={12} className="mb-4">
                        <Users size={20} className="text-[#1eb182]" />
                        <Title as="h2" className="text-lg">Team Members</Title>
                        <Badge variant="default">{(teamData.team_members?.length || 0) + 1}</Badge>
                      </Flex>

                      <Flex direction="column" gap={12}>
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
                        {teamData.team_members?.map((member) => (
                          <Card key={member.id} variant="readOnly" className="p-4">
                            <Box>
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
                                  <Button
                                    intent="ghost"
                                    size="md"
                                    onClick={() => handleRemoveMember(member.id)}
                                  >
                                    <Trash2 size={16} className="text-red-500" />
                                  </Button>
                                </Flex>
                              </Flex>
                              {member.hopsworks_username && (
                                <Box className="mt-4">
                                  <TeamMemberProjects
                                    memberId={member.id}
                                    memberEmail={member.email}
                                    memberName={member.name || member.email}
                                    isOwner={true}
                                    ownerId={teamData.account_owner.id}
                                  />
                                </Box>
                              )}
                            </Box>
                          </Card>
                        ))}
                      </Flex>

                      <Box className="mt-4">
                        <Button
                          intent="primary"
                          size="md"
                          onClick={() => setShowInviteModal(true)}
                        >
                          Invite Member
                        </Button>
                      </Box>
                    </Card>

                    {/* Pending Invites */}
                    {invites.length > 0 && (
                      <Card className="p-6">
                        <Flex align="center" gap={12} className="mb-4">
                          <Mail size={20} className="text-[#1eb182]" />
                          <Title as="h2" className="text-lg">Pending Invites</Title>
                          <Badge variant="default">{invites.length}</Badge>
                        </Flex>

                        <Flex direction="column" gap={12}>
                          {invites.map((invite) => {
                            const expiresAt = new Date(invite.expires_at);
                            const isExpired = expiresAt < new Date();
                            
                            return (
                              <Card key={invite.id} variant="readOnly" className="p-4">
                                <Flex justify="between" align="center">
                                  <Box>
                                    <Text className="font-medium">{invite.email}</Text>
                                    <Flex align="center" gap={8} className="mt-1">
                                      <Clock size={12} className="text-gray-500" />
                                      <Text className="text-xs text-gray-500">
                                        {isExpired ? 'Expired' : `Expires ${expiresAt.toLocaleDateString()}`}
                                      </Text>
                                    </Flex>
                                  </Box>
                                  <Flex align="center" gap={8}>
                                    <Button
                                      intent="ghost"
                                      size="md"
                                      onClick={() => copyInviteLink(invite.token)}
                                      disabled={isExpired}
                                    >
                                      <Copy size={16} />
                                    </Button>
                                    <Button
                                      intent="ghost"
                                      size="md"
                                      onClick={() => handleCancelInvite(invite.id)}
                                    >
                                      <Trash2 size={16} className="text-red-500" />
                                    </Button>
                                  </Flex>
                                </Flex>
                              </Card>
                            );
                          })}
                        </Flex>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    {/* Team Member View */}
                    <Card className="p-6 border-blue-200 bg-blue-50">
                      <Text className="text-sm">
                        You are part of <strong>{teamData?.account_owner.email}</strong>&apos;s team. 
                        Your usage is billed to the account owner.
                      </Text>
                    </Card>
                    
                    {/* Show team member's own projects */}
                    <Card className="p-6">
                      <Flex align="center" gap={12} className="mb-4">
                        <FolderOpen size={20} className="text-[#1eb182]" />
                        <Title as="h2" className="text-lg">My Project Access</Title>
                      </Flex>
                      <TeamMemberProjects
                        memberId={user?.sub || ''}
                        memberEmail={user?.email || ''}
                        memberName={user?.name || user?.email || ''}
                        isOwner={false}
                        ownerId={teamData?.account_owner.id || ''}
                      />
                    </Card>

                    {/* Other Team Members */}
                    {teamData?.team_members && teamData.team_members.length > 0 && (
                      <Card className="p-6">
                        <Flex align="center" gap={12} className="mb-4">
                          <Users size={20} className="text-[#1eb182]" />
                          <Title as="h2" className="text-lg">Team Members</Title>
                        </Flex>
                        
                        <Flex direction="column" gap={12}>
                          {/* Owner */}
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

                          {/* Other Members */}
                          {teamData.team_members.map((member) => (
                            <Card key={member.id} variant="readOnly" className="p-4">
                              <Box>
                                <Text className="font-medium">{member.name || member.email}</Text>
                                <Text className="text-sm text-gray-600">{member.email}</Text>
                                {member.hopsworks_username && (
                                  <Text className="text-xs text-gray-500">
                                    Hopsworks: {member.hopsworks_username}
                                  </Text>
                                )}
                              </Box>
                            </Card>
                          ))}
                        </Flex>
                      </Card>
                    )}
                  </>
                )}
              </Box>
            </TabsContent>

            <TabsContent value="billing">
              {billingLoading ? (
                <Box className="space-y-6">
                  <CardSkeleton rows={4} className="border-[#1eb182] border-2" />
                  <CardSkeleton rows={3} />
                  <CardSkeleton rows={5} />
                  <CardSkeleton rows={2} />
                </Box>
              ) : billing ? (
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
                      {/* 30-Day Total Summary */}
                      {billing.historicalUsage && billing.historicalUsage.length > 0 && (
                        <Card className="p-6 mb-6 border-[#1eb182] border-2">
                          <Flex justify="between" align="center">
                            <Box>
                              <Title as="h2" className="text-2xl">Total (30d)</Title>
                              <Text className="text-sm text-gray-600">Rolling 30-day usage cost</Text>
                            </Box>
                            <Text className="text-3xl font-bold text-[#1eb182]">
                              ${billing.historicalUsage.reduce((sum, day) => sum + day.total_cost, 0).toFixed(2)}
                            </Text>
                          </Flex>
                        </Card>
                      )}

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
                              {billing.currentUsage.cpuHours || '0.00'}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              ${billing.currentUsage.currentMonth.cpuCost.toFixed(2)}
                            </Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray-600">Storage GB</Text>
                            <Text className="text-xl font-semibold">
                              {billing.currentUsage.storageGB || '0.00'}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              ${billing.currentUsage.currentMonth.storageCost.toFixed(2)}
                            </Text>
                          </Box>
                          <Box>
                            <Text className="text-sm text-gray-600">Month Total</Text>
                            <Text className="text-xl font-semibold">
                              ${billing.currentUsage.currentMonth.total.toFixed(2)}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              {billing.billingMode === 'prepaid' ? 'This month' : 'Estimated'}
                            </Text>
                          </Box>
                        </Flex>
                        
                        {/* Show base cost if it exists */}
                        {billing.currentUsage.currentMonth.baseCost > 0 && (
                          <Box className="mt-3 pt-3 border-t border-gray-100">
                            <Flex justify="between" align="center">
                              <Text className="text-sm text-gray-600">
                                Infrastructure cost (${(billing.currentUsage.currentMonth.baseCost / (new Date().getDate())).toFixed(2)}/day)
                              </Text>
                              <Text className="text-sm font-medium">
                                ${billing.currentUsage.currentMonth.baseCost.toFixed(2)}
                              </Text>
                            </Flex>
                          </Box>
                        )}
                        
                        {/* Usage collection info */}
                        <Box className="mt-3 pt-3 border-t border-gray-100">
                          <Text className="text-xs text-gray-500">
                            Usage collected hourly from Kubernetes clusters • Last update: {usage?.lastUpdate ? new Date(usage.lastUpdate).toLocaleTimeString() : 'Never'}
                          </Text>
                        </Box>
                      </Card>

                      {/* Usage Trend Chart */}
                      {billing.historicalUsage && billing.historicalUsage.length > 0 && (
                        <Card className="p-6 mb-6">
                          <Flex align="center" gap={12} className="mb-4">
                            <TrendingUp size={20} className="text-[#1eb182]" />
                            <Title as="h2" className="text-lg">Usage Trend (30 Days)</Title>
                          </Flex>
                          
                          <Box className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart 
                                data={billing.historicalUsage.map(day => ({
                                  date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                  cost: day.total_cost,
                                  cpu: day.cpu_hours,
                                  storage: day.storage_gb
                                }))}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#1eb182" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#1eb182" stopOpacity={0.1}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                  dataKey="date" 
                                  tick={{ fontSize: 12 }}
                                  stroke="#6b7280"
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  stroke="#6b7280"
                                  tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                  }}
                                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Daily Cost']}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="cost" 
                                  stroke="#1eb182" 
                                  fillOpacity={1} 
                                  fill="url(#colorCost)" 
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </Box>
                          
                          <Flex gap={16} className="mt-4">
                            <Flex align="center" gap={8}>
                              <Box className="w-3 h-3 bg-[#1eb182] rounded-full" />
                              <Text className="text-xs text-gray-600">Daily Cost</Text>
                            </Flex>
                          </Flex>
                        </Card>
                      )}


                      {/* Removed credit balance UI - prepaid uses invoicing, not credits */}

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
                              size="md"
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
                          <Box className="space-y-3">
                            <Text className="text-sm text-gray-600">No payment methods added yet.</Text>
                            <Button
                              intent="primary"
                              size="md"
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/billing/setup-payment', {
                                    method: 'POST'
                                  });
                                  const data = await response.json();
                                  if (data.checkoutUrl) {
                                    window.location.href = data.checkoutUrl;
                                  } else if (data.portalUrl) {
                                    window.location.href = data.portalUrl;
                                  }
                                } catch (error) {
                                  console.error('Failed to set up payment:', error);
                                }
                              }}
                            >
                              Add Payment Method
                            </Button>
                          </Box>
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
                              {billing.invoices.slice(0, 5).map(invoice => {
                                const statusVariant = 
                                  invoice.status === 'paid' ? 'success' : 
                                  invoice.status === 'open' ? 'warning' :
                                  invoice.status === 'draft' ? 'secondary' :
                                  invoice.status === 'void' ? 'error' : 'secondary';
                                
                                // Check what we actually have
                                console.log('Invoice data:', {
                                  id: invoice.id,
                                  invoice_number: invoice.invoice_number,
                                  status: invoice.status,
                                  invoice_url: invoice.invoice_url,
                                  pdf_url: invoice.pdf_url,
                                  amount: invoice.amount,
                                  total: invoice.total
                                });
                                
                                return (
                                  <Flex key={invoice.id} justify="between" align="center" className="py-2 border-b border-gray-100 last:border-0">
                                    <Box>
                                      {invoice.invoice_url ? (
                                        <a 
                                          href={invoice.invoice_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                          {invoice.invoice_number || 'View Invoice'}
                                        </a>
                                      ) : (
                                        <Text className="text-sm font-medium">{invoice.invoice_number || invoice.id}</Text>
                                      )}
                                      <Text className="text-xs text-gray-500">
                                        {new Date(invoice.created_at).toLocaleDateString()}
                                      </Text>
                                    </Box>
                                    <Flex align="center" gap={12}>
                                      <Text className="text-sm font-medium">
                                        ${(invoice.total ?? invoice.amount ?? 0).toFixed(2)}
                                      </Text>
                                      <Badge variant={statusVariant as any} size="sm">
                                        {invoice.status || 'Unknown'}
                                      </Badge>
                                      {invoice.pdf_url && (
                                        <a 
                                          href={invoice.pdf_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                          title="Download PDF"
                                        >
                                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h6M9 13h6M9 9h4" />
                                          </svg>
                                        </a>
                                      )}
                                    </Flex>
                                  </Flex>
                                );
                              })}
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
                              <Text className="text-sm text-gray-600">Hops Credits</Text>
                              <Text className="text-sm font-medium">${pricing.compute_credits.toFixed(2)} / credit</Text>
                            </Flex>
                          </Card>
                          <Card variant="readOnly" className="p-4">
                            <Flex justify="between">
                              <Text className="text-sm text-gray-600">Online Storage</Text>
                              <Text className="text-sm font-medium">${pricing.storage_online_gb.toFixed(2)} / GB-month</Text>
                            </Flex>
                          </Card>
                          <Card variant="readOnly" className="p-4">
                            <Flex justify="between">
                              <Text className="text-sm text-gray-600">Offline Storage</Text>
                              <Text className="text-sm font-medium">${pricing.storage_offline_gb.toFixed(3)} / GB-month</Text>
                            </Flex>
                          </Card>
                          
                          <Text className="text-xs text-gray-500 mt-2">
                            Usage calculated hourly, billed monthly
                          </Text>
                        </Box>
                      </Card>
                    </>
                  )}
                </>
              ) : null}
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
                  size="md"
                  className="border-red-500 text-red-600 hover:bg-red-50 focus:ring-red-500"
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
                  size="md"
                  onClick={() => signOut()}
                >
                  Sign Out
                </Button>
              </Flex>
            </TabsContent>
          </Tabs>
        </Box>
      </Layout>
      
      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail('');
          setInviteRole('Data scientist');
          setAutoAssignProjects(true);
          setInviteError('');
        }}
        size="sm"
        title="Invite Team Member"
      >
        <Flex direction="column" gap={16}>
          <Text className="text-sm text-gray-600">
            Invite a new member to join your team. They&apos;ll have access to Hopsworks 
            and their usage will be billed to your account.
          </Text>
          
          <Box>
            <Text className="text-sm font-medium mb-2">Email Address</Text>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={inviteLoading}
            />
            {inviteError && (
              <Text className="text-xs text-red-500 mt-1">{inviteError}</Text>
            )}
          </Box>

          <Box>
            <Text className="text-sm font-medium mb-2">Default Project Role</Text>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={inviteLoading}
            >
              <option value="Data scientist">Data scientist</option>
              <option value="Data owner">Data owner</option>
              <option value="Observer">Observer</option>
            </Select>
            <Text className="text-xs text-gray-500 mt-1">
              Role they&apos;ll have when added to your projects
            </Text>
          </Box>

          <Box>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoAssignProjects}
                onChange={(e) => setAutoAssignProjects(e.target.checked)}
                disabled={inviteLoading}
                className="mr-2"
              />
              <Text className="text-sm">
                Automatically add to all my existing projects
              </Text>
            </label>
          </Box>

          <Flex gap={12} justify="end">
            <Button 
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole('Data scientist');
                setAutoAssignProjects(true);
                setInviteError('');
              }}
              intent="secondary"
              size="md"
              disabled={inviteLoading}
            >
              Cancel
            </Button>
            <Button 
              intent="primary"
              size="md"
              onClick={handleInvite}
              disabled={!inviteEmail || inviteLoading}
            >
              {inviteLoading ? 'Sending...' : 'Send Invite'}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
}