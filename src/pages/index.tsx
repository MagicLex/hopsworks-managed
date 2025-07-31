import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { BillingToggle } from '@/components/BillingToggle';
import { DeploymentCard } from '@/components/DeploymentCard';
import { deploymentOptions, DeploymentOption } from '@/data/deployments';
import Navbar from '@/components/Navbar';
import { DeployModal } from '@/components/DeployModal';
import { Box, Title, Text, Flex } from 'tailwind-quartz';
import { useAuth } from '@/contexts/AuthContext';
import { defaultBillingRates } from '@/config/billing-rates';

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);
  
  const handleDeploy = (deployment: DeploymentOption) => {
    if (deployment.buttonStyle === 'enterprise') {
      window.open('https://www.hopsworks.ai/contact/main', '_blank');
    } else if (deployment.id === 'serverless') {
      window.open('https://app.hopsworks.ai/', '_blank');
    } else {
      setSelectedDeployment(deployment);
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Head>
        <title>Hopsworks - Pay-As-You-Go ML Platform | Feature Store & MLOps</title>
        <meta name="description" content={`Start using Hopsworks instantly. Enterprise-grade feature store, ML pipelines, and model deployment. Pay only for what you use - $${defaultBillingRates.cpuHourRate}/CPU hour. No upfront costs.`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://managed.hopsworks.ai/" />
        <meta property="og:title" content="Hopsworks - Pay-As-You-Go ML Platform" />
        <meta property="og:description" content="Enterprise-grade feature store and ML platform. Start instantly, pay only for what you use." />
        <meta property="og:image" content="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/60917a423cdde50b5a00feeb_og-hopsworks.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://managed.hopsworks.ai/" />
        <meta property="twitter:title" content="Hopsworks - Pay-As-You-Go ML Platform" />
        <meta property="twitter:description" content="Enterprise-grade feature store and ML platform. Start instantly, pay only for what you use." />
        <meta property="twitter:image" content="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/60917a423cdde50b5a00feeb_og-hopsworks.png" />
        
        {/* Schema.org for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Hopsworks",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "priceSpecification": [
                  {
                    "@type": "UnitPriceSpecification",
                    "price": String(defaultBillingRates.cpuHourRate),
                    "priceCurrency": "USD",
                    "unitText": "CPU hour"
                  }
                ]
              },
              "description": "Enterprise-grade feature store, ML pipelines, and model deployment platform. Pay-as-you-go pricing with no upfront costs.",
              "url": "https://managed.hopsworks.ai",
              "featureList": [
                "Feature Store",
                "Model Registry", 
                "ML Pipelines",
                "Real-time Feature Serving",
                "Jupyter Notebooks",
                "Model Deployment",
                "Auto-scaling Infrastructure"
              ],
              "screenshot": "https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/60917a423cdde50b5a00feeb_og-hopsworks.png",
              "creator": {
                "@type": "Organization",
                "name": "Hopsworks",
                "url": "https://www.hopsworks.ai"
              }
            })
          }}
        />
      </Head>
      
      <Navbar />
      
      <Box as="main" className="min-h-screen py-10 px-5">
        <Box className="max-w-6xl mx-auto">
          <Box className="mb-8">
            <Title className="text-2xl mb-2">
              Start with Hopsworks
            </Title>
            <Text className="text-sm text-gray-600">
              The complete ML platform - feature store, pipelines, and deployment. Pay only for what you use.
            </Text>
          </Box>
          
          
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