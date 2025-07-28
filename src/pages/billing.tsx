import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useApiData } from '@/hooks/useApiData';
import { Box, Flex, Title, Text, Button, Card, Badge, Input } from 'tailwind-quartz';
import { CreditCard, Download, Calendar, ArrowLeft, Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface BillingData {
  currentUsage: {
    cpuHours: number;
    gpuHours: number;
    storageGB: number;
    currentMonth: {
      cpuCost: number;
      gpuCost: number;
      storageCost: number;
      total: number;
    };
  };
  invoices: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
}

export default function Billing() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const { data: billing, loading: billingLoading } = useApiData<BillingData>('/api/billing');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || billingLoading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  const currentUsage = billing?.currentUsage || {
    cpuHours: 0,
    gpuHours: 0,
    storageGB: 0,
    currentMonth: {
      cpuCost: 0,
      gpuCost: 0,
      storageCost: 0,
      total: 0
    }
  };

  const invoices = billing?.invoices || [];

  return (
    <>
      <Head>
        <title>Billing & Usage - Hopsworks</title>
        <meta name="description" content="Manage your Hopsworks billing, monitor usage, and update payment methods. Pay-as-you-go pricing with transparent costs." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" className="text-sm mb-6">
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Title as="h1" className="text-2xl mb-8">Billing & Usage</Title>

          {!hasPaymentMethod && (
            <Card className="p-6 mb-6 border-yellow-500 bg-yellow-50">
              <Flex align="center" gap={12}>
                <AlertCircle size={20} className="text-yellow-600" />
                <Box>
                  <Title as="h3" className="text-sm">Add Payment Method Required</Title>
                  <Text className="text-xs text-gray-600">
                    Add a credit card to start using Hopsworks resources
                  </Text>
                </Box>
              </Flex>
            </Card>
          )}

          <Flex direction="column" gap={24}>
            {/* Current Month Usage */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Activity size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Current Month Usage</Title>
              </Flex>
              
              <Flex direction="column" gap={16}>
                <Flex gap={16} className="grid grid-cols-1 md:grid-cols-3">
                  <Box>
                    <Text className="text-sm text-gray-600">CPU Hours</Text>
                    <Text className="text-xl">{currentUsage.cpuHours}</Text>
                    <Text className="text-sm text-gray-500">${currentUsage.currentMonth.cpuCost.toFixed(2)}</Text>
                  </Box>
                  <Box>
                    <Text className="text-sm text-gray-600">GPU Hours</Text>
                    <Text className="text-xl">{currentUsage.gpuHours}</Text>
                    <Text className="text-sm text-gray-500">${currentUsage.currentMonth.gpuCost.toFixed(2)}</Text>
                  </Box>
                  <Box>
                    <Text className="text-sm text-gray-600">Storage (GB)</Text>
                    <Text className="text-xl">{currentUsage.storageGB}</Text>
                    <Text className="text-sm text-gray-500">${currentUsage.currentMonth.storageCost.toFixed(2)}</Text>
                  </Box>
                </Flex>

                <Box className="pt-4 border-t border-gray-200">
                  <Flex justify="between" align="center">
                    <Text className="text-sm text-gray-600">Estimated Total This Month</Text>
                    <Badge variant="primary" className="text-lg">
                      ${currentUsage.currentMonth.total.toFixed(2)}
                    </Badge>
                  </Flex>
                </Box>
              </Flex>
            </Card>

            {/* Payment Method */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <CreditCard size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Payment Method</Title>
              </Flex>
              
              {hasPaymentMethod ? (
                <>
                  <Card variant="readOnly" className="p-4 mb-4">
                    <Flex justify="between" align="center">
                      <Flex direction="column">
                        <Text>•••• •••• •••• 4242</Text>
                        <Text className="text-sm text-gray-600">Expires 12/2025</Text>
                      </Flex>
                      <Badge variant="primary">Default</Badge>
                    </Flex>
                  </Card>
                  <Button intent="secondary">Update Payment Method</Button>
                </>
              ) : addingCard ? (
                <Flex direction="column" gap={12}>
                  <Input
                    label="Card Number"
                    placeholder="4242 4242 4242 4242"
                    className="text-sm"
                  />
                  <Flex gap={12}>
                    <Input
                      label="Expiry"
                      placeholder="MM/YY"
                      className="text-sm"
                    />
                    <Input
                      label="CVC"
                      placeholder="123"
                      className="text-sm"
                    />
                  </Flex>
                  <Flex gap={12}>
                    <Button 
                      intent="primary" 
                      onClick={() => {
                        setHasPaymentMethod(true);
                        setAddingCard(false);
                        // In real app, redirect to Hopsworks instance
                        router.push('/cluster');
                      }}
                    >
                      Add Card & Start
                    </Button>
                    <Button intent="ghost" onClick={() => setAddingCard(false)}>
                      Cancel
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Button intent="primary" onClick={() => setAddingCard(true)}>
                  Add Payment Method
                </Button>
              )}
            </Card>

            {/* Invoices */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Calendar size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Invoice History</Title>
              </Flex>
              
              <Flex direction="column" gap={8}>
                {hasPaymentMethod && invoices.length > 0 ? invoices.map((invoice) => (
                  <Card key={invoice.id} variant="readOnly" className="p-4">
                    <Flex justify="between" align="center">
                      <Flex direction="column">
                        <Text>{invoice.invoice_number}</Text>
                        <Text className="text-sm text-gray-600">{new Date(invoice.created_at).toLocaleDateString()}</Text>
                      </Flex>
                      <Flex align="center" gap={16}>
                        <Text>${invoice.amount.toFixed(2)}</Text>
                        <Badge variant="success" className="text-xs">{invoice.status}</Badge>
                        <Button intent="ghost" className="text-sm">
                          <Download size={16} />
                        </Button>
                      </Flex>
                    </Flex>
                  </Card>
                )) : (
                  <Text className="text-sm text-gray-500">No invoices yet</Text>
                )}
              </Flex>

              <Button intent="ghost" className="mt-4">
                View All Invoices →
              </Button>
            </Card>

            {/* Pricing Info */}
            <Card className="p-6">
              <Title as="h2" className="text-lg mb-4">Pay-As-You-Go Pricing</Title>
              
              <Flex direction="column" gap={12}>
                <Card variant="readOnly" className="p-4">
                  <Flex direction="column" gap={8}>
                    <Flex justify="between">
                      <Text className="text-sm text-gray-600">CPU Usage</Text>
                      <Text className="text-sm">$0.10 / hour</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text className="text-sm text-gray-600">GPU Usage (T4)</Text>
                      <Text className="text-sm">$0.50 / hour</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text className="text-sm text-gray-600">GPU Usage (A100)</Text>
                      <Text className="text-sm">$2.00 / hour</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text className="text-sm text-gray-600">Storage</Text>
                      <Text className="text-sm">$0.02 / GB / month</Text>
                    </Flex>
                  </Flex>
                </Card>
                
                <Text className="text-xs text-gray-500">
                  Usage is calculated hourly and billed monthly. No minimum commitment.
                </Text>
              </Flex>
            </Card>
          </Flex>
        </Box>
      </Box>
    </>
  );
}