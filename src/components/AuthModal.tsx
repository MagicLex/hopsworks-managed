import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Flex, Box, Title, Text, Labeling, Card } from 'tailwind-quartz';
import { User, LogIn, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import posthog from 'posthog-js';

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

        <Labeling gray className="text-xs text-center">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Labeling>
      </Flex>
    </Modal>
  );
};