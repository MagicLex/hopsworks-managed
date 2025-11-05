import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card } from 'tailwind-quartz';
import { CreditCard, AlertTriangle, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function BillingSetup() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Check if user already has payment method
  useEffect(() => {
    const checkBillingStatus = async () => {
      if (!user) return;
      
      try {
        const response = await fetch('/api/billing');
        const data = await response.json();

        // Check if user is suspended
        setIsSuspended(data.isSuspended || false);

        // If user already has payment method or is prepaid, redirect to dashboard
        if (data.hasPaymentMethod || data.billingMode === 'prepaid' || data.isTeamMember) {
          sessionStorage.removeItem('payment_required');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Failed to check billing status:', error);
      } finally {
        setCheckingPayment(false);
      }
    };

    checkBillingStatus();
  }, [user, router]);

  const handleSetupPayment = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/billing/setup-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set up payment');
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.portalUrl) {
        // User already has payment method, go to portal
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error('Error setting up payment:', error);
      setLoading(false);
    }
  };

  const handleSkipForNow = () => {
    sessionStorage.removeItem('payment_required');
    router.push('/dashboard');
  };

  if (authLoading || checkingPayment) {
    return (
      <>
        <Head>
          <title>Set Up Billing - Hopsworks</title>
        </Head>
        <Box className="min-h-screen bg-gray-50">
          <Navbar />
          <Box className="container mx-auto px-4 py-12 max-w-2xl">
            <Card className="p-8">
              <Text>Loading...</Text>
            </Card>
          </Box>
        </Box>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Set Up Billing - Hopsworks</title>
      </Head>
      <Box className="min-h-screen bg-gray-50">
        <Navbar />
        <Box className="container mx-auto px-4 py-12 max-w-2xl">
          {isSuspended && (
            <Card className="p-4 mb-4 border-red-500 bg-red-50">
              <Flex align="center" gap={12}>
                <AlertTriangle size={20} className="text-red-600" />
                <Box>
                  <Text className="font-semibold text-red-800">Account Suspended</Text>
                  <Text className="text-sm text-red-700">Your payment method was removed. Add a new payment method below to restore access.</Text>
                </Box>
              </Flex>
            </Card>
          )}

          <Card className="p-8">
            <Flex align="center" gap={16} className="mb-6">
              <Box className="p-3 bg-yellow-100 rounded-lg">
                <CreditCard size={32} className="text-yellow-700" />
              </Box>
              <Box>
                <Title as="h1" className="text-2xl mb-1">Complete Your Setup</Title>
                <Text className="text-gray-600">Add a payment method to access your Hopsworks cluster</Text>
              </Box>
            </Flex>

            <Box className="border-t pt-6">
              <Box className="bg-blue-50 p-4 rounded-lg mb-6">
                <Flex align="start" gap={12}>
                  <AlertTriangle size={20} className="text-blue-600 mt-1" />
                  <Box>
                    <Text className="font-semibold text-blue-900 mb-2">
                      Payment Required for Cluster Access
                    </Text>
                    <Text className="text-sm text-blue-800">
                      To provision and access your Hopsworks cluster, you need to set up a payment method. 
                      You&apos;ll only be charged for the resources you actually use.
                    </Text>
                  </Box>
                </Flex>
              </Box>

              <Box className="space-y-4 mb-6">
                <Title as="h3" className="text-lg">What happens next:</Title>
                <Box className="pl-4 space-y-2">
                  <Flex align="center" gap={8}>
                    <Text className="text-2xl text-gray-400">1.</Text>
                    <Text>You&apos;ll be redirected to our secure payment processor (Stripe)</Text>
                  </Flex>
                  <Flex align="center" gap={8}>
                    <Text className="text-2xl text-gray-400">2.</Text>
                    <Text>Add your payment information (no charges yet)</Text>
                  </Flex>
                  <Flex align="center" gap={8}>
                    <Text className="text-2xl text-gray-400">3.</Text>
                    <Text>Your cluster will be automatically provisioned</Text>
                  </Flex>
                  <Flex align="center" gap={8}>
                    <Text className="text-2xl text-gray-400">4.</Text>
                    <Text>Start building with pay-as-you-go pricing</Text>
                  </Flex>
                </Box>
              </Box>

              <Box className="bg-gray-50 p-4 rounded-lg mb-6">
                <Title as="h4" className="text-sm font-semibold mb-2">Pricing Overview</Title>
                <Box className="space-y-1">
                  <Text className="text-sm text-gray-600">• Compute: $0.35 per credit (1 vCPU hour + 0.1 GB RAM)</Text>
                  <Text className="text-sm text-gray-600">• Online Storage: $0.50/GB per month</Text>
                  <Text className="text-sm text-gray-600">• Offline Storage: $0.03/GB per month</Text>
                  <Text className="text-sm text-gray-600">• No upfront costs or minimum charges</Text>
                </Box>
              </Box>

              <Flex gap={12}>
                <Button
                  intent="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleSetupPayment}
                  isLoading={loading}
                  disabled={loading}
                >
                  <CreditCard size={18} />
                  Set Up Payment Method
                  <ArrowRight size={18} />
                </Button>
                <Button
                  intent="ghost"
                  size="lg"
                  onClick={handleSkipForNow}
                  disabled={loading}
                >
                  Skip for now
                </Button>
              </Flex>

              <Text className="text-xs text-gray-500 text-center mt-4">
                You can manage your payment methods and view invoices anytime from your dashboard.
                Your payment information is securely processed by Stripe.
              </Text>
            </Box>
          </Card>
        </Box>
      </Box>
    </>
  );
}