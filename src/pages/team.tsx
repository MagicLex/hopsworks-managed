import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Input, Badge, Modal, Select } from 'tailwind-quartz';
import { Users, UserPlus, Trash2, Copy, ArrowLeft, Mail, Clock } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import TeamMemberProjects from '@/components/team/TeamMemberProjects';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string;
  hopsworks_username: string;
  hopsworks_project_id: number;
  status: string;
}

interface TeamInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  created_at: string;
}

interface TeamData {
  account_owner: {
    id: string;
    email: string;
    name: string;
  };
  team_members: TeamMember[];
  is_owner: boolean;
}

export default function Team() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Data scientist');
  const [autoAssignProjects, setAutoAssignProjects] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchTeamData();
      fetchInvites();
    }
  }, [user]);

  const fetchTeamData = async () => {
    try {
      const response = await fetch('/api/team/members');
      if (!response.ok) throw new Error('Failed to fetch team data');
      const data = await response.json();
      setTeamData(data);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

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

      // Refresh invites list
      await fetchInvites();
      setShowInviteModal(false);
      setInviteEmail('');
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
      
      // Refresh team data
      await fetchTeamData();
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
      
      // Refresh invites
      await fetchInvites();
    } catch (error) {
      console.error('Error canceling invite:', error);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/team/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    // Show some feedback that it was copied
    alert('Invite link copied to clipboard!');
  };

  if (authLoading || loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  const isOwner = teamData?.is_owner || false;
  const teamMembers = teamData?.team_members || [];

  return (
    <>
      <Head>
        <title>Team Management - Hopsworks</title>
        <meta name="description" content="Manage your team members and invitations" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" size="md" className="mb-6">
              Back to Dashboard
            </Button>
          </Link>

          <Flex justify="between" align="center" className="mb-8">
            <Title as="h1" className="text-2xl">Team Management</Title>
            {isOwner && (
              <Button 
                intent="primary" 
                size="md"
                onClick={() => setShowInviteModal(true)}
              >
                Invite Member
              </Button>
            )}
          </Flex>

          {!isOwner && (
            <Card className="p-6 mb-6 border-blue-200 bg-blue-50">
              <Text className="text-sm">
                You are part of <strong>{teamData?.account_owner.email}</strong>&apos;s team. 
                Your usage is billed to the account owner.
              </Text>
            </Card>
          )}

          {/* Team Members */}
          <Card className="p-6 mb-6">
            <Flex align="center" gap={12} className="mb-4">
              <Users size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg">Team Members</Title>
              <Badge variant="default">{teamMembers.length + 1}</Badge>
            </Flex>

            <Flex direction="column" gap={12}>
              {/* Account Owner */}
              <Card variant="readOnly" className="p-4">
                <Flex justify="between" align="center">
                  <Box>
                    <Flex align="center" gap={8}>
                      <Text className="font-medium">{teamData?.account_owner.name || teamData?.account_owner.email}</Text>
                      <Badge variant="primary" size="sm">Owner</Badge>
                    </Flex>
                    <Text className="text-sm text-gray-600">{teamData?.account_owner.email}</Text>
                  </Box>
                </Flex>
              </Card>

              {/* Team Members */}
              {teamMembers.map((member) => (
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
                        {isOwner && (
                          <Button
                            intent="ghost"
                            size="md"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                    {member.hopsworks_username && (
                      <TeamMemberProjects
                        memberId={member.id}
                        memberEmail={member.email}
                        memberName={member.name || member.email}
                        isOwner={isOwner}
                        ownerId={teamData?.account_owner.id || ''}
                      />
                    )}
                  </Box>
                </Card>
              ))}
            </Flex>
          </Card>

          {/* Pending Invites */}
          {isOwner && invites.length > 0 && (
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
        </Box>
      </Box>

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