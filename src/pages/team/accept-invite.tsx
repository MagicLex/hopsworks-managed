import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Box, Flex, Card, Title, Text, Button, Badge } from 'tailwind-quartz';
import { AlertTriangle, UserPlus, Clock, Check } from 'lucide-react';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

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
              <Button intent="ghost" size="md">Go to homepage</Button>
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

        {/* Legal consent checkboxes */}
        <Box className="space-y-3 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <Box className="relative mt-0.5">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="sr-only peer"
              />
              <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                termsAccepted
                  ? 'bg-[#1eb182] border-[#1eb182]'
                  : 'border-gray-300 group-hover:border-gray-400'
              }`}>
                {termsAccepted && <Check size={14} className="text-white" />}
              </Box>
            </Box>
            <Text className="text-sm text-gray-700">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-[#1eb182] hover:underline">Terms of Service</Link>,{' '}
              <Link href="/aup" target="_blank" className="text-[#1eb182] hover:underline">Acceptable Use Policy</Link>,{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-[#1eb182] hover:underline">Privacy Policy</Link>
            </Text>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <Box className="relative mt-0.5">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="sr-only peer"
              />
              <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                marketingConsent
                  ? 'bg-[#1eb182] border-[#1eb182]'
                  : 'border-gray-300 group-hover:border-gray-400'
              }`}>
                {marketingConsent && <Check size={14} className="text-white" />}
              </Box>
            </Box>
            <Text className="text-sm text-gray-600">
              I would like to receive product updates and marketing communications (optional)
            </Text>
          </label>
        </Box>

        <Box className="space-y-3">
          <Button
            intent="primary"
            size="md"
            className="w-full"
            disabled={!termsAccepted}
            onClick={() => {
              // Store consent in sessionStorage to persist through Auth0 flow
              sessionStorage.setItem('terms_accepted', 'true');
              sessionStorage.setItem('marketing_consent', marketingConsent ? 'true' : 'false');
              // Redirect to Auth0 login
              window.location.href = invite.loginUrl;
            }}
          >
            Accept Invitation
          </Button>
          <Link href="/" className="block">
            <Button intent="ghost" size="md" className="w-full">
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