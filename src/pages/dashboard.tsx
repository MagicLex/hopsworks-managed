import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card } from 'tailwind-quartz';
import { Terminal, CreditCard, Trash2, Server } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

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

  return (
    <Box className="min-h-screen bg-[#0a0f0a] text-gray-100">
      <Box className="max-w-4xl mx-auto p-8">
        <Flex align="center" gap={12} className="mb-8">
          <Terminal size={24} className="text-[#1eb182]" />
          <Title as="h1" className="text-2xl font-mono uppercase">USER DASHBOARD</Title>
        </Flex>

        <Card className="bg-[#111511] border-grayShade2 p-6 mb-6">
          <Text className="font-mono text-sm text-gray-400 mb-2">LOGGED IN AS</Text>
          <Text className="font-mono text-lg">{user.email}</Text>
        </Card>

        <Flex direction="column" gap={16}>
          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex align="center" gap={12} className="mb-4">
              <Server size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg font-mono uppercase">CLUSTER ACCESS</Title>
            </Flex>
            <Text className="font-mono text-sm text-gray-400 mb-4">
              Join your Hopsworks managed cluster
            </Text>
            <Button 
              intent="primary"
              className="font-mono uppercase"
              onClick={() => router.push('/cluster')}
            >
              ACCESS CLUSTER →
            </Button>
          </Card>

          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex align="center" gap={12} className="mb-4">
              <CreditCard size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg font-mono uppercase">BILLING</Title>
            </Flex>
            <Text className="font-mono text-sm text-gray-400 mb-4">
              Manage your subscription and payment methods
            </Text>
            <Link href="/billing">
              <Button 
                intent="secondary"
                className="font-mono uppercase"
              >
                MANAGE BILLING →
              </Button>
            </Link>
          </Card>

          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex align="center" gap={12} className="mb-4">
              <Trash2 size={20} className="text-red-500" />
              <Title as="h2" className="text-lg font-mono uppercase">ACCOUNT SETTINGS</Title>
            </Flex>
            <Text className="font-mono text-sm text-gray-400 mb-4">
              Manage your account and data
            </Text>
            <Link href="/account">
              <Button 
                intent="secondary"
                className="font-mono uppercase"
              >
                ACCOUNT SETTINGS →
              </Button>
            </Link>
          </Card>
        </Flex>

        <Flex justify="center" className="mt-8">
          <Link href="/">
            <Button intent="ghost" className="font-mono text-sm">
              ← BACK TO HOME
            </Button>
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}