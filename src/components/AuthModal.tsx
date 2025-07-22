import React, { useState } from 'react';
import { Modal, Button, Input, Flex, Box, Title, Text, Labeling, Card } from 'tailwind-quartz';
import { User, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          {activeTab === 'signin' ? <LogIn size={20} /> : <User size={20} />}
          <Title as="span">Join Hopsworks Cluster</Title>
        </Flex>
      }
    >
      <Flex gap={8} className="mb-6">
        <Button
          intent={activeTab === 'signin' ? 'primary' : 'ghost'}
          className="flex-1"
          onClick={() => setActiveTab('signin')}
        >
          Sign In
        </Button>
        <Button
          intent={activeTab === 'signup' ? 'primary' : 'ghost'}
          className="flex-1"
          onClick={() => setActiveTab('signup')}
        >
          Sign Up
        </Button>
      </Flex>

      <Box>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap={16}>
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {activeTab === 'signup' && (
              <Labeling gray className="text-xs">
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </Labeling>
            )}

            {error && (
              <Card className="border-red-500 bg-red-50 p-3">
                <Text className="text-sm text-red-700">{error}</Text>
              </Card>
            )}

            <Button
              type="submit"
              intent="primary"
              isLoading={loading}
              className="w-full"
            >
              {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </Flex>
        </form>

        {activeTab === 'signin' && (
          <Box className="mt-4 text-center">
            <Labeling gray className="text-sm">
              Don&apos;t have an account?{' '}
              <Button
                intent="inline"
                onClick={() => setActiveTab('signup')}
              >
                Sign up
              </Button>
            </Labeling>
          </Box>
        )}
      </Box>
    </Modal>
  );
};