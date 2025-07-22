import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Modal } from 'tailwind-quartz';
import { Terminal, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmation === 'DELETE') {
      // TODO: Call API to delete user data from Supabase
      // TODO: Delete user from Auth0
      await signOut();
      router.push('/');
    }
  };

  return (
    <Box className="min-h-screen bg-[#0a0f0a] text-gray-100">
      <Box className="max-w-2xl mx-auto p-8">
        <Link href="/dashboard">
          <Button intent="ghost" className="font-mono text-sm mb-6">
            <ArrowLeft size={16} className="mr-2" />
            BACK TO DASHBOARD
          </Button>
        </Link>

        <Flex align="center" gap={12} className="mb-8">
          <Terminal size={24} className="text-[#1eb182]" />
          <Title as="h1" className="text-2xl font-mono uppercase">ACCOUNT SETTINGS</Title>
        </Flex>

        <Card className="bg-[#111511] border-grayShade2 p-6 mb-6">
          <Title as="h2" className="text-lg font-mono mb-4">ACCOUNT INFORMATION</Title>
          <Flex direction="column" gap={8}>
            <Box>
              <Text className="font-mono text-sm text-gray-400">EMAIL</Text>
              <Text className="font-mono">{user.email}</Text>
            </Box>
            <Box>
              <Text className="font-mono text-sm text-gray-400">USER ID</Text>
              <Text className="font-mono text-xs">{user.sub}</Text>
            </Box>
          </Flex>
        </Card>

        <Card className="bg-[#111511] border-red-900 p-6">
          <Flex align="center" gap={12} className="mb-4">
            <AlertTriangle size={20} className="text-red-500" />
            <Title as="h2" className="text-lg font-mono uppercase text-red-500">DANGER ZONE</Title>
          </Flex>
          <Text className="font-mono text-sm text-gray-400 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>
          <Button 
            intent="secondary"
            className="font-mono uppercase border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={() => setShowDeleteModal(true)}
          >
            DELETE ACCOUNT
          </Button>
        </Card>
      </Box>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="sm"
        className="font-mono"
        title={
          <Flex align="center" gap={12}>
            <AlertTriangle size={20} className="text-red-500" />
            <Title as="span" className="text-lg uppercase">DELETE ACCOUNT</Title>
          </Flex>
        }
      >
        <Flex direction="column" gap={16}>
          <Text className="font-mono text-sm">
            This will permanently delete your account and all associated data. 
            Your cluster access will be immediately revoked.
          </Text>
          
          <Box>
            <Text className="font-mono text-sm text-gray-400 mb-2">
              Type DELETE to confirm:
            </Text>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full p-2 bg-[#111511] border border-grayShade2 rounded font-mono text-sm"
              placeholder="Type DELETE"
            />
          </Box>

          <Flex gap={12} justify="end">
            <Button 
              onClick={() => setShowDeleteModal(false)}
              intent="secondary"
              className="font-mono text-sm uppercase"
            >
              CANCEL
            </Button>
            <Button 
              intent="primary"
              className="font-mono text-sm uppercase bg-red-500 hover:bg-red-600"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE'}
            >
              DELETE ACCOUNT
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Box>
  );
}