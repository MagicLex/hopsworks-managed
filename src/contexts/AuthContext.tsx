import React, { createContext, useContext, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: any; // Auth0's UserProfile type has nullable sub
  loading: boolean;
  signIn: (corporateRef?: string, promoCode?: string, mode?: 'login' | 'signup') => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      // Check if we've already synced this session - do this FIRST to prevent race conditions
      const syncedThisSession = sessionStorage.getItem('user_synced_session');
      if (syncedThisSession === user.sub) {
        return; // Already synced this user in this session
      }

      // Mark as syncing IMMEDIATELY to prevent duplicate calls from concurrent renders
      sessionStorage.setItem('user_synced_session', user.sub!);

      // Get corporate ref and promo code from sessionStorage if present
      const corporateRef = sessionStorage.getItem('corporate_ref');
      const promoCode = sessionStorage.getItem('promo_code');
      const termsAccepted = sessionStorage.getItem('terms_accepted') === 'true';
      const marketingConsent = sessionStorage.getItem('marketing_consent') === 'true';

      // Sync user to Supabase when they log in
      fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corporateRef, promoCode, termsAccepted, marketingConsent })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            throw new Error(errData.error || `Sync failed: ${res.status}`);
          });
        }
        return res.json();
      })
      .then(data => {
        // Clear registration data after successful sync
        sessionStorage.removeItem('corporate_ref');
        sessionStorage.removeItem('promo_code');
        sessionStorage.removeItem('terms_accepted');
        sessionStorage.removeItem('marketing_consent');

        // Check if account is suspended (removed payment method)
        if (data.isSuspended && router.pathname !== '/billing-setup') {
          sessionStorage.setItem('account_suspended', 'true');
          router.push('/billing-setup');
          return;
        }

        // Check if user needs to set up payment (new users, not team members)
        // Skip redirect if on /team/joining - that flow handles its own routing
        if (data.needsPayment && router.pathname !== '/billing-setup' && router.pathname !== '/team/joining') {
          sessionStorage.setItem('payment_required', 'true');
          router.push('/billing-setup');
        }
      })
      .catch(err => {
        console.error('Failed to sync user:', err);
        // Reset sync flag so it can retry on next render
        sessionStorage.removeItem('user_synced_session');
      });
    }
  }, [user, isLoading, router.pathname]); // Only re-run if pathname changes to billing-setup

  const signIn = (corporateRef?: string, promoCode?: string, mode: 'login' | 'signup' = 'login') => {
    if (corporateRef) {
      // Store corporate ref in sessionStorage to persist through auth flow
      sessionStorage.setItem('corporate_ref', corporateRef);
    }
    if (promoCode) {
      // Store promo code in sessionStorage to persist through auth flow
      sessionStorage.setItem('promo_code', promoCode);
    }
    // Use the proper Auth0 route - signup or login
    router.push(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login');
  };

  const signOut = () => {
    // Clear sync flag so health checks run on next login
    sessionStorage.removeItem('user_synced_session');
    router.push('/api/auth/logout');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading: isLoading,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};