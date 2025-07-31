import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Box, Flex, Card, Title, Text, Button, Badge } from 'tailwind-quartz';
import { AlertTriangle, UserPlus, Clock } from 'lucide-react';

interface InviteDetails {
  email: string;
  invitedBy: string;
  expiresAt: string;
  loginUrl: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/team/accept-invite?token=${token}`)
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || 'Failed to load invite');
          });
        }
        return res.json();
      })
      .then(data => {
        setInvite(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <Flex align="center" justify="center" className="min-h-screen bg-gray-50">
        <Box className="text-center">
          <Box className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <Text className="mt-4 text-gray-600">Loading invite...</Text>
        </Box>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-8">
          <Box className="text-center">
            <Box className="mb-4 flex justify-center">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </Box>
            <Title as="h2" className="text-2xl mb-2">Invalid Invite</Title>
            <Text className="text-gray-600 mb-6">{error}</Text>
            <Link href="/">
              <Button intent="ghost">Go to homepage</Button>
            </Link>
          </Box>
        </Card>
      </Box>
    );
  }

  if (!invite) return null;

  const expiresIn = new Date(invite.expiresAt).getTime() - new Date().getTime();
  const daysLeft = Math.floor(expiresIn / (1000 * 60 * 60 * 24));

  return (
    <Box className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full p-8">
        <Box className="text-center mb-6">
          <Box className="mb-4 flex justify-center">
            <UserPlus className="h-12 w-12 text-primary" />
          </Box>
          <Title as="h1" className="text-2xl">Team Invitation</Title>
        </Box>

        <Box className="space-y-4 mb-6">
          <Box>
            <Text className="text-sm text-gray-600">You&apos;ve been invited by</Text>
            <Text className="font-medium">{invite.invitedBy}</Text>
          </Box>

          <Box>
            <Text className="text-sm text-gray-600">To join with email</Text>
            <Text className="font-medium">{invite.email}</Text>
          </Box>

          {daysLeft > 0 && (
            <Flex align="center" className="mt-4">
              <Clock className="h-4 w-4 text-gray-500 mr-2" />
              <Text className="text-sm text-gray-600">
                Expires in <span className="font-medium text-gray-900">{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>
              </Text>
            </Flex>
          )}
        </Box>

        <Box className="space-y-3">
          <a href={invite.loginUrl} className="block">
            <Button intent="primary" className="w-full text-lg">
              Accept Invitation
            </Button>
          </a>
          <Link href="/" className="block">
            <Button intent="ghost" className="w-full">
              Cancel
            </Button>
          </Link>
        </Box>

        <Box className="mt-6 p-4 bg-gray-100 rounded-md">
          <Text className="text-sm text-gray-600">
            By accepting this invitation, you&apos;ll join the team and your usage will be billed to the account owner.
          </Text>
        </Box>
      </Card>
    </Box>
  );
}