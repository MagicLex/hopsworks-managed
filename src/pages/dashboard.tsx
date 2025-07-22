import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card } from 'tailwind-quartz';
import { CreditCard, Trash2, Server, LogOut } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  return (
    <>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Title as="h1" className="text-2xl mb-8">User Dashboard</Title>

          <Card className="p-6 mb-6">
            <Text className="text-sm text-gray-600 mb-2">Logged in as</Text>
            <Text className="text-lg">{user.email}</Text>
          </Card>

          <Flex direction="column" gap={16}>
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Server size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Cluster Access</Title>
              </Flex>
              <Text className="text-sm text-gray-600 mb-4">
                Join your Hopsworks managed cluster
              </Text>
              <Button 
                intent="primary"
                className="uppercase"
                onClick={() => router.push('/cluster')}
              >
                Access Cluster →
              </Button>
            </Card>

            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <CreditCard size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Billing</Title>
              </Flex>
              <Text className="text-sm text-gray-600 mb-4">
                Manage your subscription and payment methods
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