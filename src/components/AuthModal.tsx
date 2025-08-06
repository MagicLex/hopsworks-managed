import React, { useState } from 'react';
import { Modal, Button, Input, Flex, Box, Title, Text, Labeling, Card } from 'tailwind-quartz';
import { User, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, mode = 'signup' }) => {
  const { signIn } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(mode);

  const handleSignIn = () => {
    // Auth0 will handle the authentication flow
    signIn();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <LogIn size={20} />
          <Title as="span">{authMode === 'signin' ? 'Log In to Hopsworks' : 'Sign Up for Hopsworks'}</Title>
        </Flex>
      }
    >
      <Flex direction="column" gap={24}>
        <Card className="border-[#1eb182] bg-[#e8f5f0] p-4">
          <Text className="text-sm">
            {authMode === 'signin' 
              ? 'Welcome back! Sign in to access your Hopsworks instance.'
              : 'Create a new account to start using Hopsworks. No credit card required to sign up.'}
          </Text>
        </Card>

        <Flex direction="column" gap={16}>
          <Button
            intent="primary"
            size="md"
            onClick={handleSignIn}
            className="w-full"
          >
            {authMode === 'signin' ? 'Log In with Auth0' : 'Sign Up with Auth0'}
          </Button>
          
          <Text className="text-center text-sm text-gray-600">
            {authMode === 'signin' 
              ? "Don't have an account? "
              : "Already have an account? "}
            <Button
              intent="ghost"
              size="md"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-[#1eb182] hover:underline p-0 h-auto"
            >
              {authMode === 'signin' ? 'Sign Up' : 'Log In'}
            </Button>
          </Text>
          
          <Button
            intent="ghost"
            size="md"
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </Button>
        </Flex>

        <Labeling gray className="text-xs text-center">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Labeling>
      </Flex>
    </Modal>
  );
};