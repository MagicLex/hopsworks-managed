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
  const { signIn } = useAuth();

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
          <Title as="span">Join Hopsworks Cluster</Title>
        </Flex>
      }
    >
      <Flex direction="column" gap={24}>
        <Card className="border-[#1eb182] bg-[#e8f5f0] p-4">
          <Text className="text-sm">
            Sign in with your Auth0 account to access Hopsworks clusters. 
            You&apos;ll be redirected to our secure authentication page.
          </Text>
        </Card>

        <Flex direction="column" gap={16}>
          <Button
            intent="primary"
            onClick={handleSignIn}
            className="w-full"
          >
            Sign In with Auth0
          </Button>
          
          <Button
            intent="ghost"
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