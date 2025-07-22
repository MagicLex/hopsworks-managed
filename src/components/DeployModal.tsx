import React, { useState } from 'react';
import { X, CreditCard, Zap, Globe, Terminal, User } from 'lucide-react';
import { DeploymentOption } from '@/data/deployments';
import { Modal, Button, Box, Flex, Title, Text, Labeling, Card, Badge, Input, Radio } from 'tailwind-quartz';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from './AuthModal';

interface DeployModalProps {
  isOpen: boolean;
  deployment: DeploymentOption | null;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, deployment, onClose }) => {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState('us-east-1');
  
  if (!deployment) return null;

  const handleStartNow = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      // TODO: Process payment and create Hopsworks resources
      console.log('Processing cluster join for:', user.email, 'Zone:', selectedZone);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="font-mono"
      title={
        <Flex align="center" gap={12}>
          <Terminal size={20} className="text-[#1eb182]" />
          <Title as="span" className="text-lg uppercase">JOIN CLUSTER: {deployment.name}</Title>
        </Flex>
      }
    >

      <Flex direction="column" gap={24}>
        {user && (
          <Card className="border-blue-500 bg-blue-50 p-4">
            <Flex align="center" gap={8} className="mb-2">
              <User size={16} className="text-blue-600" />
              <Title as="h3" className="font-mono text-sm">Logged in as: {user.email}</Title>
            </Flex>
          </Card>
        )}
        
        <Card className="border-[#1eb182] bg-[#e8f5f0] p-4">
          <Flex align="center" gap={8} className="mb-2">
            <Zap size={16} className="text-[#1eb182]" />
            <Title as="h3" className="font-mono text-sm uppercase">Instant Access</Title>
          </Flex>
          <Text className="text-sm font-mono text-gray-700">
            You&apos;ll join the shared {deployment.name} cluster immediately after payment.
            Resources are pre-allocated and ready to use.
          </Text>
        </Card>

        <Card className="p-4">
          <Flex align="center" gap={8} className="mb-3">
            <Globe size={16} className="text-[#1eb182]" />
            <Title as="h3" className="font-mono text-sm uppercase text-gray-600">Select Zone</Title>
          </Flex>
          <Flex direction="column" gap={8}>
            <Box className="p-3 border border-grayShade2 hover:border-[#1eb182] cursor-pointer transition-colors" onClick={() => setSelectedZone('us-east-1')}>
              <Flex gap={12}>
                <Radio 
                  name="zone" 
                  value="us-east-1" 
                  checked={selectedZone === 'us-east-1'}
                  onChange={() => setSelectedZone('us-east-1')}
                  className="accent-[#1eb182]" 
                />
                <Box>
                  <Text className="font-mono text-sm">US-EAST-1</Text>
                  <Labeling className="text-xs" gray>N. Virginia • Lowest latency for Americas</Labeling>
                </Box>
              </Flex>
            </Box>
            <Box className="p-3 border border-grayShade2 hover:border-[#1eb182] cursor-pointer transition-colors" onClick={() => setSelectedZone('eu-west-1')}>
              <Flex gap={12}>
                <Radio 
                  name="zone" 
                  value="eu-west-1" 
                  checked={selectedZone === 'eu-west-1'}
                  onChange={() => setSelectedZone('eu-west-1')}
                  className="accent-[#1eb182]"
                />
                <Box>
                  <Text className="font-mono text-sm">EU-WEST-1</Text>
                  <Labeling className="text-xs" gray>Ireland • GDPR compliant for Europe</Labeling>
                </Box>
              </Flex>
            </Box>
            <Box className="p-3 border border-grayShade2 hover:border-[#1eb182] cursor-pointer transition-colors" onClick={() => setSelectedZone('ap-southeast-1')}>
              <Flex gap={12}>
                <Radio 
                  name="zone" 
                  value="ap-southeast-1"
                  checked={selectedZone === 'ap-southeast-1'}
                  onChange={() => setSelectedZone('ap-southeast-1')} 
                  className="accent-[#1eb182]"
                />
                <Box>
                  <Text className="font-mono text-sm">AP-SOUTHEAST-1</Text>
                  <Labeling className="text-xs" gray>Singapore • Optimized for Asia-Pacific</Labeling>
                </Box>
              </Flex>
            </Box>
          </Flex>
        </Card>

        <Card className="p-4">
          <Flex align="center" gap={8} className="mb-3">
            <CreditCard size={16} className="text-[#1eb182]" />
            <Title as="h3" className="font-mono text-sm uppercase text-gray-600">Payment Method</Title>
          </Flex>
          <Flex direction="column" gap={12}>
            <Input
              label="Card Number"
              placeholder="4242 4242 4242 4242"
              className="font-mono text-sm"
            />
            <Flex gap={12}>
              <Input
                label="Expiry"
                placeholder="MM/YY"
                className="font-mono text-sm"
              />
              <Input
                label="CVC"
                placeholder="123"
                className="font-mono text-sm"
              />
            </Flex>
          </Flex>
        </Card>

        <Card variant="readOnly" className="p-4">
          <Title as="h3" className="font-mono text-sm uppercase text-gray-600 mb-3">Billing Summary</Title>
          <Flex direction="column" gap={8}>
            <Flex justify="between">
              <Labeling className="font-mono">{deployment.name} Cluster Access</Labeling>
              <Text className="font-mono">${deployment.monthlyPrice}/mo</Text>
            </Flex>
            <Box className="pt-2 border-t border-grayShade2">
              <Flex justify="between">
                <Labeling bold className="font-mono">Total Due Now</Labeling>
                <Badge variant="primary" className="font-mono font-semibold">${deployment.monthlyPrice}</Badge>
              </Flex>
            </Box>
          </Flex>
        </Card>
      </Flex>

      <Flex gap={12} justify="end" className="mt-8">
        <Button 
          onClick={onClose}
          intent="secondary"
          className="font-mono text-sm uppercase"
        >
          Cancel
        </Button>
        <Button 
          intent="primary"
          className="font-mono text-sm uppercase"
          onClick={handleStartNow}
        >
          {user ? 'Start Now' : 'Sign In to Continue'}
        </Button>
      </Flex>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // After successful auth, process the cluster join
          handleStartNow();
        }}
      />
    </Modal>
  );
};