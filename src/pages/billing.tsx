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
  billingMode: 'prepaid' | 'postpaid';
  hasPaymentMethod: boolean;
  subscriptionStatus?: string;
  prepaidEnabled: boolean;
  currentUsage: {
    cpuHours: string;
    storageGB: string;
    currentMonth: {
      cpuCost: number;
      storageCost: number;
      total: number;
    };
  };
  creditBalance?: {
    total: number;
    purchased: number;
    free: number;
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
  const [addingCard, setAddingCard] = useState(false);
  const { data: billing, loading: billingLoading } = useApiData<BillingData>('/api/billing');
  
  const billingMode = billing?.billingMode || 'postpaid';
  const hasPaymentMethod = billing?.hasPaymentMethod || false;
  const creditBalance = billing?.creditBalance;

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
    storageGB: 0,
    currentMonth: {
      cpuCost: 0,
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

          <Flex justify="between" align="center" className="mb-8">
            <Title as="h1" className="text-2xl">Billing & Usage</Title>
            {billingMode === 'prepaid' && creditBalance && (
              <Badge variant="primary" className="text-lg">
                Credits: ${creditBalance.total.toFixed(2)}
              </Badge>
            )}
          </Flex>

          {!hasPaymentMethod && billingMode === 'postpaid' && (
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
          
          {billingMode === 'prepaid' && creditBalance && creditBalance.total < 10 && (
            <Card className="p-6 mb-6 border-yellow-500 bg-yellow-50">
              <Flex align="center" gap={12}>
                <AlertCircle size={20} className="text-yellow-600" />
                <Box>
                  <Title as="h3" className="text-sm">Low Credit Balance</Title>
                  <Text className="text-xs text-gray-600">
                    Your credit balance is running low. Purchase more credits to avoid service interruption.
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
                <Flex gap={16} className="grid grid-cols-1 md:grid-cols-2">
                  <Box>
                    <Text className="text-sm text-gray-600">CPU Hours</Text>
                    <Text className="text-xl">{currentUsage.cpuHours || '0'}</Text>
                    <Text className="text-sm text-gray-500">${currentUsage.currentMonth.cpuCost.toFixed(2)}</Text>
                  </Box>
                  <Box>
                    <Text className="text-sm text-gray-600">Storage (GB)</Text>
                    <Text className="text-xl">{currentUsage.storageGB || '0'}</Text>
                    <Text className="text-sm text-gray-500">${currentUsage.currentMonth.storageCost.toFixed(2)}</Text>
                  </Box>
                </Flex>

                <Box className="pt-4 border-t border-gray-200">
                  <Flex justify="between" align="center">
                    <Text className="text-sm text-gray-600">
                      {billingMode === 'prepaid' ? 'Total Usage This Month' : 'Estimated Total This Month'}
                    </Text>
                    <Badge variant="primary" className="text-lg">
                      ${currentUsage.currentMonth.total.toFixed(2)}
                    </Badge>
                  </Flex>
                </Box>
              </Flex>
            </Card>

            {/* Credit Balance for Prepaid Users */}
            {billingMode === 'prepaid' && billing?.prepaidEnabled && creditBalance && (
              <Card className="p-6">
                <Flex align="center" gap={12} className="mb-4">
                  <CreditCard size={20} className="text-[#1eb182]" />
                  <Title as="h2" className="text-lg">Credit Balance</Title>
                </Flex>
                
                <Flex direction="column" gap={16}>
                  <Flex gap={16} className="grid grid-cols-1 md:grid-cols-3">
                    <Box>
                      <Text className="text-sm text-gray-600">Total Balance</Text>
                      <Text className="text-xl">${creditBalance.total.toFixed(2)}</Text>
                    </Box>
                    <Box>
                      <Text className="text-sm text-gray-600">Purchased Credits</Text>
                      <Text className="text-xl">${creditBalance.purchased.toFixed(2)}</Text>
                    </Box>
                    <Box>
                      <Text className="text-sm text-gray-600">Free Credits</Text>
                      <Text className="text-xl">${creditBalance.free.toFixed(2)}</Text>
                    </Box>
                  </Flex>
                  
                  <Button 
                    intent="primary"
                    onClick={async () => {
                      const response = await fetch('/api/billing/purchase-credits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: 50 })
                      });
                      const data = await response.json();
                      if (data.checkoutUrl) {
                        window.location.href = data.checkoutUrl;
                      }
                    }}
                  >
                    Purchase More Credits
                  </Button>
                </Flex>
              </Card>
            )}

            {/* Payment Method */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <CreditCard size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Payment Method</Title>
              </Flex>
              
              {billingMode === 'postpaid' ? (
                hasPaymentMethod ? (
                  <Box>
                    <Badge variant="success" className="mb-4">
                      Subscription Active: {billing?.subscriptionStatus || 'active'}
                    </Badge>
                    <Text className="text-sm text-gray-600">
                      You will be billed monthly for your usage. Manage your payment methods in your Stripe customer portal.
                    </Text>
                  </Box>
                ) : (
                  <Box>
                    <Text className="text-sm text-gray-600 mb-4">
                      A payment method is required for pay-as-you-go billing.
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Your subscription and payment method should have been set up during registration. 
                      If you&apos;re seeing this message, please contact support.
                    </Text>
                  </Box>
                )
              ) : (
                <Text className="text-sm text-gray-600">
                  Prepaid mode active. Credits are deducted automatically as you use resources.
                </Text>
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