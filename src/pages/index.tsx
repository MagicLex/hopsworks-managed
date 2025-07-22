import React, { useState } from 'react';
import Head from 'next/head';
import { BillingToggle } from '@/components/BillingToggle';
import { DeploymentCard } from '@/components/DeploymentCard';
import { deploymentOptions, DeploymentOption } from '@/data/deployments';
import Navbar from '@/components/Navbar';
import { DeployModal } from '@/components/DeployModal';
import { Box, Title, Text, Flex } from 'tailwind-quartz';

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const handleDeploy = (deployment: DeploymentOption) => {
    if (deployment.buttonStyle === 'enterprise') {
      window.open('https://www.hopsworks.ai/contact/main', '_blank');
    } else if (deployment.monthlyPrice === 0) {
      window.open('https://app.hopsworks.ai/', '_blank');
    } else {
      setSelectedDeployment(deployment);
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Head>
        <title>Hopsworks Deployment Configuration</title>
        <meta name="description" content="Choose the infrastructure that matches your workload requirements" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Navbar />
      
      <Box as="main" className="min-h-screen py-10 px-5">
        <Box className="max-w-6xl mx-auto">
          <Box className="mb-8">
            <Title className="text-2xl mb-2">
              Select Deployment Configuration
            </Title>
            <Text className="text-sm text-gray-600">
              Choose the infrastructure that matches your workload requirements
            </Text>
          </Box>
          
          <BillingToggle 
            isYearly={isYearly} 
            onToggle={() => setIsYearly(!isYearly)} 
          />
          
          <Flex direction="column" gap={16}>
            {deploymentOptions.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                isYearly={isYearly}
                onDeploy={handleDeploy}
              />
            ))}
          </Flex>
        </Box>
      </Box>
      
      <DeployModal 
        isOpen={isModalOpen}
        deployment={selectedDeployment}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}