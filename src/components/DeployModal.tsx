import React, { useState } from 'react';
import { X, CreditCard, Zap, Globe, Terminal, User, Activity } from 'lucide-react';
import { DeploymentOption } from '@/data/deployments';
import { Modal, Button, Box, Flex, Title, Text, Labeling, Card, Badge, Input } from 'tailwind-quartz';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { useRouter } from 'next/router';

interface DeployModalProps {
  isOpen: boolean;
  deployment: DeploymentOption | null;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, deployment, onClose }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  if (!deployment) return null;

  const handleStartNow = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      // Redirect to billing to add payment method
      router.push('/billing');
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
          <Title as="span" className="text-lg uppercase">Start with Hopsworks</Title>
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
            <Activity size={16} className="text-[#1eb182]" />
            <Title as="h3" className="font-mono text-sm uppercase">Pay-As-You-Go</Title>
          </Flex>
          <Text className="text-sm font-mono text-gray-700">
            Start using Hopsworks immediately. Only pay for what you use.
            No upfront costs, cancel anytime.
          </Text>
        </Card>

        <Card className="p-4">
          <Flex align="center" gap={8} className="mb-3">
            <Zap size={16} className="text-[#1eb182]" />
            <Title as="h3" className="font-mono text-sm uppercase text-gray-600">Technical Capabilities</Title>
          </Flex>
          <Flex direction="column" gap={8}>
            <Text className="font-mono text-sm">✓ RonDB Online Store (&lt;1ms latency)</Text>
            <Text className="font-mono text-sm">✓ Spark, Flink, Pandas compute engines</Text>
            <Text className="font-mono text-sm">✓ Delta Lake, Hudi, Iceberg formats</Text>
            <Text className="font-mono text-sm">✓ Airflow orchestration built-in</Text>
            <Text className="font-mono text-sm">✓ JupyterLab with Python/Spark kernels</Text>
            <Text className="font-mono text-sm">✓ KServe/vLLM model deployment</Text>
            <Text className="font-mono text-sm">✓ Point-in-time correct training data</Text>
            <Text className="font-mono text-sm">✓ BigQuery, Snowflake, S3 connectors</Text>
          </Flex>
        </Card>

        <Card variant="readOnly" className="p-4">
          <Title as="h3" className="font-mono text-sm uppercase text-gray-600 mb-3">Pricing</Title>
          <Flex direction="column" gap={8}>
            <Flex justify="between">
              <Labeling className="font-mono">CPU Usage</Labeling>
              <Text className="font-mono">$0.10/hour</Text>
            </Flex>
            <Flex justify="between">
              <Labeling className="font-mono">GPU Usage (T4)</Labeling>
              <Text className="font-mono">$0.50/hour</Text>
            </Flex>
            <Flex justify="between">
              <Labeling className="font-mono">Storage</Labeling>
              <Text className="font-mono">$0.02/GB/month</Text>
            </Flex>
            <Box className="pt-2 border-t border-grayShade2">
              <Text className="font-mono text-sm text-gray-600">
                {user ? 'Add payment method to get started' : 'Sign up to get started - no credit card required'}
              </Text>
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
          {user ? 'Add Payment Method' : 'Sign Up Free'}
        </Button>
      </Flex>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // After successful auth, redirect to billing
          router.push('/billing');
        }}
      />
    </Modal>
  );
};