import React, { useState } from 'react';
import { X, CreditCard, Zap, Globe, Terminal, User, Activity } from 'lucide-react';
import { DeploymentOption } from '@/data/deployments';
import { Modal, Button, Box, Flex, Title, Text, Labeling, Card, Badge, Input } from 'tailwind-quartz';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { DEFAULT_RATES } from '@/config/billing-rates';
import { usePricing } from '@/contexts/PricingContext';
import posthog from 'posthog-js';

interface DeployModalProps {
  isOpen: boolean;
  deployment: DeploymentOption | null;
  onClose: () => void;
  corporateRef?: string | null;
  promoCode?: string | null;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, deployment, onClose, corporateRef, promoCode }) => {
  const { user, signIn } = useAuth();
  const router = useRouter();
  const { pricing } = usePricing();

  if (!deployment) return null;

  const handleStartNow = () => {
    // Track deploy modal action
    posthog.capture('deploy_modal_opened', {
      hasCorporateRef: !!corporateRef,
      hasPromoCode: !!promoCode,
      isAuthenticated: !!user,
      deployment: deployment?.id,
    });

    if (!user) {
      // Track signup initiated
      posthog.capture('signup_initiated', {
        source: 'deploy_modal',
        hasCorporateRef: !!corporateRef,
        hasPromoCode: !!promoCode,
      });
      // Pass corporate ref or promo code if present, use signup mode
      signIn(corporateRef || undefined, promoCode || undefined, 'signup');
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
              <Labeling className="font-mono">Hops Credits</Labeling>
              <Text className="font-mono">${pricing.compute_credits.toFixed(2)}/credit</Text>
            </Flex>
            <Box className="pt-2 border-t border-grayShade2">
              <Text className="font-mono text-sm text-gray-600">
                {user ? 'Add payment method to get started' : 'Sign up and add payment method to get started'}
              </Text>
            </Box>
          </Flex>
        </Card>
      </Flex>

      <Flex gap={12} justify="end" className="mt-8">
        <Button 
          onClick={onClose}
          intent="secondary"
          size="md"
          className="font-mono uppercase"
        >
          Cancel
        </Button>
        <Button 
          intent="primary"
          size="md"
          className="font-mono uppercase"
          onClick={handleStartNow}
        >
          {user ? 'Add Payment Method' : 'Sign Up'}
        </Button>
      </Flex>
    </Modal>
  );
};