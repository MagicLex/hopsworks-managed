import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Flex, Box, Title, Text, Labeling, Card } from 'tailwind-quartz';
import { User, LogIn, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import posthog from 'posthog-js';
import Link from 'next/link';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'signin' | 'signup';
  corporateRef?: string;
  promoCode?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, mode = 'signup', corporateRef, promoCode }) => {
  const { signIn } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(mode);
  const [isCorporate, setIsCorporate] = useState(false);
  const [isPromo, setIsPromo] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    // Check for corporate ref in URL or props
    const urlParams = new URLSearchParams(window.location.search);
    const ref = corporateRef || urlParams.get('corporate_ref');
    if (ref) {
      setIsCorporate(true);
      // Store in sessionStorage for persistence during auth flow
      sessionStorage.setItem('corporate_ref', ref);
    }

    // Check for promo code in URL or props
    const promo = promoCode || urlParams.get('promo');
    if (promo) {
      setIsPromo(true);
      // Store in sessionStorage for persistence during auth flow
      sessionStorage.setItem('promo_code', promo);
    }
  }, [corporateRef, promoCode]);

  const handleSignIn = () => {
    // Pass corporate ref and promo code through Auth0 state if present
    const corporateRefValue = sessionStorage.getItem('corporate_ref');
    const promoCodeValue = sessionStorage.getItem('promo_code');

    // Track signup/signin initiated
    posthog.capture('signup_initiated', {
      source: 'auth_modal',
      mode: authMode,
      hasCorporateRef: !!corporateRefValue,
      hasPromoCode: !!promoCodeValue,
    });

    signIn(corporateRefValue || undefined, promoCodeValue || undefined);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <LogIn size={20} />
          <Title as="span">{authMode === 'signin' ? 'Log In to Hopsworks' : 'Sign Up for Hopsworks'}</Title>
        </Flex>
      }
    >
      <Flex direction="column" gap={24}>
        <Card className={(isCorporate || isPromo) ? "border-blue-500 bg-blue-50 p-4" : "border-[#1eb182] bg-[#e8f5f0] p-4"}>
          <Flex align="center" gap={8}>
            {isCorporate && <Building2 size={16} className="text-blue-600" />}
            <Text className="text-sm">
              {isCorporate
                ? 'Corporate account registration. Your organization has a prepaid agreement with Hopsworks. Sign up to get instant access.'
                : isPromo
                  ? 'Promotional access enabled. Sign up to get instant access with no payment required.'
                  : authMode === 'signin'
                    ? 'Welcome back! Sign in to access your Hopsworks instance.'
                    : 'Create a new account to start using Hopsworks. No credit card required to sign up.'}
            </Text>
          </Flex>
        </Card>

        <Flex direction="column" gap={16}>
          <Button
            intent="primary"
            size="md"
            onClick={handleSignIn}
            className="w-full"
            disabled={authMode === 'signup' && !termsAccepted}
          >
            {authMode === 'signin' ? 'Log In with Auth0' : 'Sign Up with Auth0'}
          </Button>
          
          <Text className="text-center text-sm text-gray-600">
            {authMode === 'signin' 
              ? "Don't have an account? "
              : "Already have an account? "}
            <Button
              intent="ghost"
              size="md"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-[#1eb182] hover:underline p-0 h-auto"
            >
              {authMode === 'signin' ? 'Sign Up' : 'Log In'}
            </Button>
          </Text>
          
          <Button
            intent="ghost"
            size="md"
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </Button>
        </Flex>

        {authMode === 'signup' ? (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1eb182] focus:ring-[#1eb182]"
            />
            <Text className="text-xs text-gray-600">
              I have read and agree to the{' '}
              <Link href="/terms" target="_blank" className="text-[#1eb182] hover:underline">
                Terms of Service
              </Link>
              ,{' '}
              <Link href="/privacy" target="_blank" className="text-[#1eb182] hover:underline">
                Privacy Policy
              </Link>
              , and consent to analytics data collection for service improvement.
            </Text>
          </label>
        ) : (
          <Labeling gray className="text-xs text-center">
            By logging in, you agree to our{' '}
            <Link href="/terms" target="_blank" className="text-[#1eb182] hover:underline">
              Terms of Service
            </Link>
            ,{' '}
            <Link href="/privacy" target="_blank" className="text-[#1eb182] hover:underline">
              Privacy Policy
            </Link>
            , and analytics data collection.
          </Labeling>
        )}
      </Flex>
    </Modal>
  );
};