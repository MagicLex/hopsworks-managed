import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Modal, Input } from 'tailwind-quartz';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

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
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
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
    <>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-2xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" className="text-sm mb-6">
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Title as="h1" className="text-2xl mb-8">Account Settings</Title>

          <Card className="p-6 mb-6">
            <Title as="h2" className="text-lg mb-4">Account Information</Title>
            <Flex direction="column" gap={8}>
              <Box>
                <Text className="text-sm text-gray-600">Email</Text>
                <Text>{user.email}</Text>
              </Box>
              <Box>
                <Text className="text-sm text-gray-600">User ID</Text>
                <Text className="text-xs">{user.sub}</Text>
              </Box>
            </Flex>
          </Card>

          <Card className="p-6 border-red-200">
            <Flex align="center" gap={12} className="mb-4">
              <AlertTriangle size={20} className="text-red-500" />
              <Title as="h2" className="text-lg text-red-500">Danger Zone</Title>
            </Flex>
            <Text className="text-sm text-gray-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <Button 
              intent="secondary"
              className="border-red-500 text-red-500 hover:bg-red-50"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </Button>
          </Card>
        </Box>
      </Box>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="sm"
        title={
          <Flex align="center" gap={12}>
            <AlertTriangle size={20} className="text-red-500" />
            <Title as="span" className="text-lg">Delete Account</Title>
          </Flex>
        }
      >
        <Flex direction="column" gap={16}>
          <Text className="text-sm">
            This will permanently delete your account and all associated data. 
            Your cluster access will be immediately revoked.
          </Text>
          
          <Box>
            <Text className="text-sm text-gray-600 mb-2">
              Type DELETE to confirm:
            </Text>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE"
            />
          </Box>

          <Flex gap={12} justify="end">
            <Button 
              onClick={() => setShowDeleteModal(false)}
              intent="secondary"
              className="text-sm"
            >
              Cancel
            </Button>
            <Button 
              intent="primary"
              className="text-sm bg-red-500 hover:bg-red-600"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE'}
            >
              Delete Account
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
}