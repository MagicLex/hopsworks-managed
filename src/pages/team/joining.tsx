import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Text } from 'tailwind-quartz';
import { CheckCircle, XCircle } from 'lucide-react';

export default function JoiningTeamPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { token } = router.query;
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Joining team...');

  useEffect(() => {
    if (!user || !token) return;

    // Get consent from sessionStorage (stored before Auth0 redirect)
    const termsAccepted = sessionStorage.getItem('terms_accepted') === 'true';
    const marketingConsent = sessionStorage.getItem('marketing_consent') === 'true';

    // Process the team invitation
    fetch('/api/team/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, termsAccepted, marketingConsent })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('error');
          setMessage(data.error);
          // Clear sync flag so AuthContext can re-evaluate on next navigation
          sessionStorage.removeItem('user_synced_session');
        } else {
          // Only clear consent AFTER successful join
          sessionStorage.removeItem('terms_accepted');
          sessionStorage.removeItem('marketing_consent');

          setStatus('success');
          setMessage('Successfully joined the team!');
          // Redirect to dashboard after 2 seconds
          // Add joined=true param to skip billing check on first load
          setTimeout(() => {
            router.push('/dashboard?joined=true');
          }, 2000);
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage('Failed to join team. Please try again.');
        // Clear sync flag so AuthContext can re-evaluate on next navigation
        sessionStorage.removeItem('user_synced_session');
      });
  }, [user, token, router]);

  return (
    <Flex align="center" justify="center" className="min-h-screen bg-gray-50">
      <Box className="text-center">
        {status === 'processing' && (
          <>
            <Box className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <Text className="mt-4 text-gray-600">{message}</Text>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <Text className="mt-4 text-gray-800 font-medium">{message}</Text>
            <Text className="mt-2 text-sm text-gray-600">Redirecting to dashboard...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <Text className="mt-4 text-gray-800 font-medium">{message}</Text>
            <Text className="mt-2 text-sm text-gray-600">
              Ask the team owner to send you a new invite, or{' '}
              <button
                onClick={() => signOut()}
                className="text-primary hover:underline"
              >
                sign out and try again
              </button>
            </Text>
          </>
        )}
      </Box>
    </Flex>
  );
}