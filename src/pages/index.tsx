import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { BillingToggle } from '@/components/BillingToggle';
import { DeploymentCard } from '@/components/DeploymentCard';
import { deploymentOptions, DeploymentOption } from '@/data/deployments';
import Layout from '@/components/Layout';
import { DeployModal } from '@/components/DeployModal';
import { Box, Title, Text, Flex } from 'tailwind-quartz';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_RATES } from '@/config/billing-rates';
import { usePricing } from '@/contexts/PricingContext';
import { MatrixText } from '@/components/MatrixText';

export default function Home() {
  const { pricing } = usePricing();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [corporateRef, setCorporateRef] = useState<string | null>(null);
  const [corporateCompanyName, setCorporateCompanyName] = useState<string | null>(null);
  const [corporateLogo, setCorporateLogo] = useState<string | null>(null);
  const [corporateError, setCorporateError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for corporate_ref in URL params
    const ref = urlParams.get('corporate_ref');
    if (ref) {
      // Validate the corporate ref exists
      fetch('/api/auth/validate-corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: ref, checkDealOnly: true }) // Just checking if deal exists
      })
        .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
        .then(({ ok, status, data }) => {
          if (status === 404) {
            setCorporateError(`Invalid corporate reference: ${ref}`);
            // Remove invalid ref from URL
            window.history.replaceState({}, '', window.location.pathname);
          } else if (ok && data.valid) {
            setCorporateRef(ref);
            setCorporateCompanyName(data.companyName || data.dealName);
            setCorporateLogo(data.companyLogo || (data.companyDomain ? `https://logo.clearbit.com/${data.companyDomain}` : null));
            // Store in sessionStorage for persistence
            sessionStorage.setItem('corporate_ref', ref);
          }
        })
        .catch(err => {
          console.error('Failed to validate corporate ref:', err);
          setCorporateError('Unable to validate corporate reference. Please try again or contact support.');
        });
    }

    // Check for promo code in URL params
    const promo = urlParams.get('promo');
    if (promo) {
      // Validate the promo code
      fetch('/api/auth/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promo })
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setPromoCode(data.promoCode); // Use normalized code
            // Store in sessionStorage for persistence
            sessionStorage.setItem('promo_code', data.promoCode);
          } else {
            setPromoError(data.error || 'Invalid promotional code');
            // Remove invalid promo from URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        })
        .catch(err => {
          console.error('Failed to validate promo code:', err);
          setPromoError('Unable to validate promotional code. Please try again or contact support.');
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
        <link rel="canonical" href="https://run.hopsworks.ai/" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://run.hopsworks.ai/" />
        <meta property="og:title" content="Hopsworks - Pay-As-You-Go ML Platform" />
        <meta property="og:description" content="Enterprise-grade feature store and ML platform. Start instantly, pay only for what you use." />
        <meta property="og:image" content="https://cdn.prod.website-files.com/5f6353590bb01cacbcecfbac/60917a423cdde50b5a00feeb_og-hopsworks.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://run.hopsworks.ai/" />
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
              "url": "https://run.hopsworks.ai",
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
      
      <Layout className="py-16 px-5">
        <Box className="max-w-6xl mx-auto">
          {(corporateRef || corporateError) && (
            <Box className={`mb-6 p-4 rounded-lg border ${
              corporateError
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              {corporateError ? (
                <Text className="text-red-700 font-mono text-sm">
                  ❌ {corporateError}
                </Text>
              ) : (
                <Flex align="center" gap={12}>
                  {corporateLogo && (
                    <img
                      src={corporateLogo}
                      alt={corporateCompanyName || ''}
                      className="h-10 w-10 object-contain rounded"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <Flex direction="column" gap={4}>
                    <Text className="text-green-700 font-mono text-sm font-semibold">
                      ✓ Welcome {corporateCompanyName}
                    </Text>
                    <Text className="text-green-600 font-mono text-xs">
                      Full platform access unlocked. Sign in with your {corporateCompanyName && (corporateCompanyName.toLowerCase().includes('inc') || corporateCompanyName.toLowerCase().includes('corp') || corporateCompanyName.toLowerCase().includes('ltd')) ? 'company' : corporateCompanyName} email.
                    </Text>
                  </Flex>
                </Flex>
              )}
            </Box>
          )}
          {(promoCode || promoError) && (
            <Box className={`mb-6 p-4 rounded-lg border ${
              promoError
                ? 'bg-red-50 border-red-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              {promoError ? (
                <Text className="text-red-700 font-mono text-sm">
                  ❌ {promoError}
                </Text>
              ) : (
                <Flex direction="column" gap={4}>
                  <Text className="text-blue-700 font-mono text-sm font-semibold">
                    ✓ Promotional Code Applied: {promoCode}
                  </Text>
                  <Text className="text-blue-600 font-mono text-xs">
                    Full platform access unlocked. No payment required.
                  </Text>
                </Flex>
              )}
            </Box>
          )}
          <Box className="mb-12">
            <Title className="text-2xl mb-2">
              Start with Hopsworks
            </Title>
            <Text className="text-sm text-gray-600 mb-2">
              <MatrixText text="Storage" /> for features & AI data — <MatrixText text="Compute" /> for training & inference — <MatrixText text="Query" /> for analytics & serving
            </Text>
            <Text className="text-xs text-gray-500 font-mono">
              Pay only for what you use.
            </Text>
          </Box>
          
          
          <Flex direction="column" gap={20}>
            {deploymentOptions.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                isYearly={isYearly}
                onDeploy={handleDeploy}
                isCorporate={!!(corporateRef || promoCode)}
              />
            ))}
          </Flex>
        </Box>
      </Layout>
      
      <DeployModal
        isOpen={isModalOpen}
        deployment={selectedDeployment}
        onClose={() => setIsModalOpen(false)}
        corporateRef={corporateRef}
        promoCode={promoCode}
      />
    </>
  );
}