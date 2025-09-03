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
import { DEFAULT_RATES } from '@/config/billing-rates';
import { usePricing } from '@/hooks/usePricing';

export default function Home() {
  const { pricing } = usePricing();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [corporateRef, setCorporateRef] = useState<string | null>(null);
  const [corporateError, setCorporateError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check for corporate_ref in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('corporate_ref');
    if (ref) {
      // Validate the corporate ref exists
      fetch('/api/auth/validate-corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: ref, checkDealOnly: true }) // Just checking if deal exists
      })
        .then(res => {
          if (res.status === 404) {
            setCorporateError(`Invalid corporate reference: ${ref}. Please contact your Hopsworks representative or use the regular sign-up.`);
            // Remove invalid ref from URL
            window.history.replaceState({}, '', window.location.pathname);
          } else if (res.ok) {
            setCorporateRef(ref);
            // Store in sessionStorage for persistence
            sessionStorage.setItem('corporate_ref', ref);
          }
        })
        .catch(err => {
          console.error('Failed to validate corporate ref:', err);
          setCorporateError('Unable to validate corporate reference. Please try again or contact support.');
        });
    }
  }, []);

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
        <meta name="description" content={`Start using Hopsworks instantly. Enterprise-grade feature store, ML pipelines, and model deployment. Pay only for what you use - $${pricing.compute_credits.toFixed(2)}/credit. No upfront costs.`} />
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
                    "price": String(pricing.compute_credits),
                    "priceCurrency": "USD",
                    "unitText": "credit"
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
          {corporateError && (
            <Box className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-red-700">{corporateError}</Text>
            </Box>
          )}
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
        corporateRef={corporateRef}
      />
    </>
  );
}