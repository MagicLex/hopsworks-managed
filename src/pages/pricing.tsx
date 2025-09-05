import React, { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { Box, Title, Text, Flex, Card, Button } from 'tailwind-quartz';
import { usePricing } from '@/contexts/PricingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Cpu, HardDrive, Database, Server, Activity } from 'lucide-react';

export default function Pricing() {
  const { pricing, loading } = usePricing();
  const { signIn } = useAuth();
  
  // Calculator state - defaults based on typical ML project
  // ~8 hours/day * 22 workdays = 176 CPU hours/month for development
  const [cpuHours, setCpuHours] = useState(176);
  // 16GB RAM typical for data processing * 176 hours = 2816 GB-hours
  const [ramGbHours, setRamGbHours] = useState(2816);
  // Feature store online serving data
  const [storageOnlineGb, setStorageOnlineGb] = useState(100);
  // Historical features, training data, model artifacts
  const [storageOfflineGb, setStorageOfflineGb] = useState(1000);

  const calculateMonthlyCost = () => {
    const cpu = cpuHours * pricing.cpu_hour;
    const ram = ramGbHours * pricing.ram_gb_hour;
    const onlineStorage = storageOnlineGb * pricing.storage_online_gb;
    const offlineStorage = storageOfflineGb * pricing.storage_offline_gb;
    
    return cpu + ram + onlineStorage + offlineStorage;
  };

  const monthlyCost = calculateMonthlyCost();
  const computeCreditsUsed = monthlyCost / pricing.compute_credits;

  return (
    <>
      <Head>
        <title>Pricing - Hopsworks Managed</title>
        <meta name="description" content="Simple, transparent pricing for Hopsworks. Pay only for what you use." />
      </Head>
      <Layout className="py-16 px-5">
        <Box className="max-w-6xl mx-auto">
          <Box className="mb-12">
            <Title className="text-2xl mb-2">
              Pricing
            </Title>
            <Text className="text-sm text-gray-600">
              Pay only for what you use. No hidden fees.
            </Text>
          </Box>

          {/* Current Rates */}
          <Flex direction="column" gap={20} className="mb-12">
            <Card className="p-6">
              <Title as="h3" className="text-base mb-4">Base Rates</Title>
              <Flex direction="column" gap={12}>
                <Flex justify="between" align="center" className="pb-3 border-b border-gray-100">
                  <Flex align="center" gap={8}>
                    <Activity size={16} className="text-gray-400" />
                    <Text className="text-sm">Compute Credits</Text>
                  </Flex>
                  <Text className="text-sm font-mono font-semibold">${pricing.compute_credits.toFixed(2)}/credit</Text>
                </Flex>
                <Flex justify="between" align="center" className="pb-3 border-b border-gray-100">
                  <Flex align="center" gap={8}>
                    <Database size={16} className="text-gray-400" />
                    <Text className="text-sm">Online Storage</Text>
                  </Flex>
                  <Text className="text-sm font-mono font-semibold">${pricing.storage_online_gb.toFixed(2)}/GB/month</Text>
                </Flex>
                <Flex justify="between" align="center" className="pb-3 border-b border-gray-100">
                  <Flex align="center" gap={8}>
                    <HardDrive size={16} className="text-gray-400" />
                    <Text className="text-sm">Offline Storage</Text>
                  </Flex>
                  <Text className="text-sm font-mono font-semibold">${pricing.storage_offline_gb.toFixed(2)}/GB/month</Text>
                </Flex>
              </Flex>
            </Card>

            <Card className="p-6">
              <Title as="h3" className="text-base mb-4">Compute Resources</Title>
              <Flex direction="column" gap={12}>
                <Flex justify="between" align="center" className="pb-3 border-b border-gray-100">
                  <Flex align="center" gap={8}>
                    <Cpu size={16} className="text-gray-400" />
                    <Text className="text-sm">CPU Hour</Text>
                  </Flex>
                  <Text className="text-sm font-mono font-semibold">${pricing.cpu_hour.toFixed(4)}/hour</Text>
                </Flex>
                <Flex justify="between" align="center" className="pb-3 border-b border-gray-100">
                  <Flex align="center" gap={8}>
                    <Server size={16} className="text-gray-400" />
                    <Text className="text-sm">RAM GB Hour</Text>
                  </Flex>
                  <Text className="text-sm font-mono font-semibold">${pricing.ram_gb_hour.toFixed(4)}/GB-hour</Text>
                </Flex>
              </Flex>
            </Card>
          </Flex>

          {/* Cost Calculator */}
          <Card className="p-6">
            <Title as="h3" className="text-base mb-6">Cost Calculator</Title>
            
            {/* Presets */}
            <Box className="mb-6">
              <Text className="text-sm text-gray-600 mb-3">Quick presets:</Text>
              <Flex gap={8} className="flex-wrap">
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    // Small team: 1-2 people
                    setCpuHours(176);
                    setRamGbHours(2816);
                    setStorageOnlineGb(100);
                    setStorageOfflineGb(1000);
                  }}
                  className="text-xs"
                >
                  Small Team (1-2 people)
                </Button>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    // Medium team: 5-10 people
                    setCpuHours(880); // 5 people × 176
                    setRamGbHours(14080); // 5 people × 2816
                    setStorageOnlineGb(500);
                    setStorageOfflineGb(5000);
                  }}
                  className="text-xs"
                >
                  Medium Team (5-10 people)
                </Button>
              </Flex>
            </Box>
            
            <Box className="grid md:grid-cols-2 gap-6 mb-8">
              <Box>
                <label className="block text-sm text-gray-600 mb-2">
                  CPU Hours/month
                </label>
                <input
                  type="number"
                  value={cpuHours}
                  onChange={(e) => setCpuHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:border-blue-400"
                />
                <Text className="text-xs text-gray-500 mt-1 font-mono">
                  ${(cpuHours * pricing.cpu_hour).toFixed(2)}/month
                </Text>
              </Box>
              
              <Box>
                <label className="block text-sm text-gray-600 mb-2">
                  RAM GB-Hours/month
                </label>
                <input
                  type="number"
                  value={ramGbHours}
                  onChange={(e) => setRamGbHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:border-blue-400"
                />
                <Text className="text-xs text-gray-500 mt-1 font-mono">
                  ${(ramGbHours * pricing.ram_gb_hour).toFixed(2)}/month
                </Text>
              </Box>
              
              <Box>
                <label className="block text-sm text-gray-600 mb-2">
                  Online Storage (GB)
                </label>
                <input
                  type="number"
                  value={storageOnlineGb}
                  onChange={(e) => setStorageOnlineGb(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:border-blue-400"
                />
                <Text className="text-xs text-gray-500 mt-1 font-mono">
                  ${(storageOnlineGb * pricing.storage_online_gb).toFixed(2)}/month
                </Text>
              </Box>
              
              <Box>
                <label className="block text-sm text-gray-600 mb-2">
                  Offline Storage (GB)
                </label>
                <input
                  type="number"
                  value={storageOfflineGb}
                  onChange={(e) => setStorageOfflineGb(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:border-blue-400"
                />
                <Text className="text-xs text-gray-500 mt-1 font-mono">
                  ${(storageOfflineGb * pricing.storage_offline_gb).toFixed(2)}/month
                </Text>
              </Box>
            </Box>
            
            {/* Total Cost Display */}
            <Box className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <Flex justify="between" align="center" className="mb-4">
                <Text className="text-sm text-gray-600">Estimated Monthly Cost</Text>
                <Text className="text-2xl font-mono font-bold">
                  ${monthlyCost.toFixed(2)}
                </Text>
              </Flex>
              
              <Flex justify="between" align="center" className="pt-4 border-t border-gray-100">
                <Text className="text-xs text-gray-500">Compute Credits Used</Text>
                <Text className="text-sm font-mono font-semibold">{computeCreditsUsed.toFixed(2)} credits</Text>
              </Flex>
            </Box>
          </Card>

          {/* CTA */}
          <Flex justify="center" gap={16} className="mt-12">
            <Button 
              intent="primary"
              size="md"
              onClick={() => signIn(undefined, 'signup')}
            >
              Get Started
            </Button>
            <Button 
              intent="secondary"
              size="md"
              onClick={() => window.open('https://www.hopsworks.ai/contact/main', '_blank')}
            >
              Contact Sales
            </Button>
          </Flex>
        </Box>
      </Layout>
    </>
  );
}