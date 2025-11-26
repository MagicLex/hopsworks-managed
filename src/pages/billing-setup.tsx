import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { Box, Flex, Title, Text, Button, Card } from 'tailwind-quartz';
import { CreditCard, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function BillingSetup() {
  const { user, loading: authLoading } = useAuth();
  const { billing, loading: billingLoading, refetch: refetchBilling } = useBilling();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  // Check if user needs to accept terms (not yet in DB)
  // Only evaluate when billing is loaded, otherwise assume true to show checkboxes
  const needsTermsAcceptance = billingLoading ? true : !billing?.termsAcceptedAt;

  // Check if user has payment method but just needs to accept terms
  const hasPaymentButNeedsTerms = billing?.hasPaymentMethod && needsTermsAcceptance && !billing?.isSuspended;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Check if user already has payment method
  useEffect(() => {
    const checkBillingStatus = async () => {
      if (!user || billingLoading) return;

      let shouldShowForm = true; // Track whether to show the form or keep loading

      try {
        // Fetch fresh billing data to avoid stale context issues (especially for team members)
        const freshBillingRes = await fetch('/api/billing');
        const freshBilling = freshBillingRes.ok ? await freshBillingRes.json() : null;

        // Team members should never see billing-setup - redirect immediately
        if (freshBilling?.isTeamMember) {
          sessionStorage.removeItem('payment_required');
          shouldShowForm = false; // Keep loading state during redirect
          router.push('/dashboard');
          return;
        }

        // If user has payment method but is still suspended, poll for webhook completion
        if (billing?.hasPaymentMethod && billing?.isSuspended) {
          console.log('User has payment method but is suspended - polling for status update...');
          shouldShowForm = false; // Keep loading during polling

          let pollCount = 0;
          const MAX_POLLS = 10;

          const pollInterval = setInterval(async () => {
            pollCount++;
            try {
              await refetchBilling();

              // Check updated billing from context
              if (!billing?.isSuspended) {
                console.log('User unsuspended - redirecting to dashboard');
                clearInterval(pollInterval);
                sessionStorage.removeItem('payment_required');
                router.push('/dashboard');
              } else if (pollCount >= MAX_POLLS) {
                console.log('Polling timeout - user still suspended after 20s');
                clearInterval(pollInterval);
                setCheckingPayment(false);
              }
            } catch (error) {
              console.error('Polling error:', error);
              clearInterval(pollInterval);
              setCheckingPayment(false);
            }
          }, 2000);

          return;
        }

        // If user already has payment method or is prepaid, AND has accepted terms, redirect to dashboard
        if ((billing?.hasPaymentMethod || billing?.billingMode === 'prepaid') && !billing?.isSuspended && billing?.termsAcceptedAt) {
          sessionStorage.removeItem('payment_required');
          shouldShowForm = false; // Keep loading state during redirect
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Failed to check billing status:', error);
      } finally {
        // Only show the form if we're not redirecting
        if (shouldShowForm) {
          setCheckingPayment(false);
        }
      }
    };

    checkBillingStatus();
  }, [user, billing, billingLoading, refetchBilling, router]);

  const handleSetupPayment = async () => {
    setLoading(true);

    try {
      // Save consent BEFORE redirecting to Stripe (user won't come back to this page)
      if (needsTermsAcceptance && termsAccepted) {
        const consentResponse = await fetch('/api/user/accept-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketingConsent })
        });

        if (!consentResponse.ok) {
          console.error('Failed to save consent');
          setLoading(false);
          return;
        }
      }

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

  const handleSkipForNow = async () => {
    // If user hasn't accepted terms yet, save consent first
    if (needsTermsAcceptance) {
      if (!termsAccepted) return; // Should not happen due to disabled button

      setSavingConsent(true);
      try {
        const response = await fetch('/api/user/accept-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketingConsent })
        });

        if (!response.ok) {
          console.error('Failed to save consent');
          setSavingConsent(false);
          return;
        }

        // Refetch billing to update the context with new termsAcceptedAt
        await refetchBilling();
      } catch (error) {
        console.error('Error saving consent:', error);
        setSavingConsent(false);
        return;
      }
    }

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
          {billing?.isSuspended && (
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
            {hasPaymentButNeedsTerms ? (
              /* Simplified view: payment done, just need terms acceptance */
              <>
                <Flex align="center" gap={16} className="mb-6">
                  <Box className="p-3 bg-green-100 rounded-lg">
                    <Check size={32} className="text-green-700" />
                  </Box>
                  <Box>
                    <Title as="h1" className="text-2xl mb-1">Almost There!</Title>
                    <Text className="text-gray-600">Just accept our terms to access your cluster</Text>
                  </Box>
                </Flex>

                <Box className="border-t pt-6">
                  <Box className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg border">
                    <Text className="text-sm font-semibold text-gray-700 mb-3">Please accept to continue:</Text>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <Box className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="sr-only peer"
                        />
                        <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          termsAccepted
                            ? 'bg-[#1eb182] border-[#1eb182]'
                            : 'border-gray-300 group-hover:border-gray-400'
                        }`}>
                          {termsAccepted && <Check size={14} className="text-white" />}
                        </Box>
                      </Box>
                      <Text className="text-sm text-gray-700 font-mono">
                        I agree to the{' '}
                        <Link href="/terms" target="_blank" className="text-[#1eb182] hover:underline">Terms of Service</Link>,{' '}
                        <Link href="/aup" target="_blank" className="text-[#1eb182] hover:underline">Acceptable Use Policy</Link>,{' '}
                        and{' '}
                        <Link href="/privacy" target="_blank" className="text-[#1eb182] hover:underline">Privacy Policy</Link>
                      </Text>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <Box className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={marketingConsent}
                          onChange={(e) => setMarketingConsent(e.target.checked)}
                          className="sr-only peer"
                        />
                        <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          marketingConsent
                            ? 'bg-[#1eb182] border-[#1eb182]'
                            : 'border-gray-300 group-hover:border-gray-400'
                        }`}>
                          {marketingConsent && <Check size={14} className="text-white" />}
                        </Box>
                      </Box>
                      <Text className="text-sm text-gray-600 font-mono">
                        I would like to receive product updates and marketing communications (optional)
                      </Text>
                    </label>
                  </Box>

                  <Button
                    intent="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleSkipForNow}
                    isLoading={savingConsent}
                    disabled={savingConsent || !termsAccepted}
                  >
                    <Check size={18} />
                    Continue to Dashboard
                    <ArrowRight size={18} />
                  </Button>
                </Box>
              </>
            ) : (
              /* Full view: need payment method setup */
              <>
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

                  {/* Legal consent checkboxes - only if user hasn't accepted yet */}
                  {needsTermsAcceptance && (
                    <Box className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg border">
                      <Text className="text-sm font-semibold text-gray-700 mb-3">Please accept to continue:</Text>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <Box className="relative mt-0.5">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="sr-only peer"
                          />
                          <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                            termsAccepted
                              ? 'bg-[#1eb182] border-[#1eb182]'
                              : 'border-gray-300 group-hover:border-gray-400'
                          }`}>
                            {termsAccepted && <Check size={14} className="text-white" />}
                          </Box>
                        </Box>
                        <Text className="text-sm text-gray-700 font-mono">
                          I agree to the{' '}
                          <Link href="/terms" target="_blank" className="text-[#1eb182] hover:underline">Terms of Service</Link>,{' '}
                          <Link href="/aup" target="_blank" className="text-[#1eb182] hover:underline">Acceptable Use Policy</Link>,{' '}
                          and{' '}
                          <Link href="/privacy" target="_blank" className="text-[#1eb182] hover:underline">Privacy Policy</Link>
                        </Text>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <Box className="relative mt-0.5">
                          <input
                            type="checkbox"
                            checked={marketingConsent}
                            onChange={(e) => setMarketingConsent(e.target.checked)}
                            className="sr-only peer"
                          />
                          <Box className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                            marketingConsent
                              ? 'bg-[#1eb182] border-[#1eb182]'
                              : 'border-gray-300 group-hover:border-gray-400'
                          }`}>
                            {marketingConsent && <Check size={14} className="text-white" />}
                          </Box>
                        </Box>
                        <Text className="text-sm text-gray-600 font-mono">
                          I would like to receive product updates and marketing communications (optional)
                        </Text>
                      </label>
                    </Box>
                  )}

                  <Flex gap={12}>
                    <Button
                      intent="primary"
                      size="lg"
                      className="flex-1"
                      onClick={handleSetupPayment}
                      isLoading={loading}
                      disabled={loading || (needsTermsAcceptance && !termsAccepted)}
                    >
                      <CreditCard size={18} />
                      Set Up Payment Method
                      <ArrowRight size={18} />
                    </Button>
                    <Button
                      intent="ghost"
                      size="lg"
                      onClick={handleSkipForNow}
                      disabled={loading || savingConsent || (needsTermsAcceptance && !termsAccepted)}
                      isLoading={savingConsent}
                    >
                      Skip for now
                    </Button>
                  </Flex>

                  <Text className="text-xs text-gray-500 text-center mt-4">
                    You can manage your payment methods and view invoices anytime from your dashboard.
                    Your payment information is securely processed by Stripe.
                  </Text>
                </Box>
              </>
            )}
          </Card>
        </Box>
      </Box>
    </>
  );
}