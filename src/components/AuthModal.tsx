import React, { useState } from 'react';
import { Modal, Button, Input, Flex, Box, Title, Text, Labeling, Alert, Tab, Tabs } from 'tailwind-quartz';
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
      size="sm"
      title={
        <Flex align="center" gap={8}>
          {activeTab === 'signin' ? <LogIn size={20} /> : <User size={20} />}
          <Title as="span">Join Hopsworks Cluster</Title>
        </Flex>
      }
    >
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'signin' | 'signup')}>
        <Tab value="signin">Sign In</Tab>
        <Tab value="signup">Sign Up</Tab>
      </Tabs>

      <Box className="mt-6">
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
              <Alert variant="danger" size="sm">
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              intent="primary"
              loading={loading}
              className="w-full"
            >
              {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </Flex>
        </form>

        {activeTab === 'signin' && (
          <Box className="mt-4 text-center">
            <Labeling gray className="text-sm">
              Don't have an account?{' '}
              <Button
                variant="link"
                size="sm"
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