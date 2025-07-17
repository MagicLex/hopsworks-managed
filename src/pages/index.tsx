import React, { useState } from 'react';
import Head from 'next/head';
import { BillingToggle } from '@/components/BillingToggle';
import { DeploymentCard } from '@/components/DeploymentCard';
import { deploymentOptions, DeploymentOption } from '@/data/deployments';

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  
  const handleDeploy = (deployment: DeploymentOption) => {
    console.log(`Initiating deployment: ${deployment.name}`);
  };

  return (
    <>
      <Head>
        <title>Hopsworks Deployment Configuration</title>
        <meta name="description" content="Choose the infrastructure that matches your workload requirements" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <main className="min-h-screen py-10 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-gray-900 mb-2">
              Select Deployment Configuration
            </h1>
            <p className="text-sm text-gray-600">
              Choose the infrastructure that matches your workload requirements
            </p>
          </div>
          
          <BillingToggle 
            isYearly={isYearly} 
            onToggle={() => setIsYearly(!isYearly)} 
          />
          
          <div className="flex flex-col gap-4">
            {deploymentOptions.map((deployment) => (
              <DeploymentCard
                key={deployment.id}
                deployment={deployment}
                isYearly={isYearly}
                onDeploy={handleDeploy}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}