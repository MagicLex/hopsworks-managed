import React, { createContext, useContext, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: any; // Auth0's UserProfile type has nullable sub
  loading: boolean;
  signIn: (corporateRef?: string, mode?: 'login' | 'signup') => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      // Get corporate ref from sessionStorage if present
      const corporateRef = sessionStorage.getItem('corporate_ref');
      
      // Check if we've already synced this session
      const syncedThisSession = sessionStorage.getItem('user_synced_session');
      if (syncedThisSession === user.sub) {
        return; // Already synced this user in this session
      }
      
      // Sync user to Supabase when they log in
      fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corporateRef })
      })
      .then(res => res.json())
      .then(data => {
        // Mark as synced for this session
        sessionStorage.setItem('user_synced_session', user.sub!);
        
        // Clear corporate ref after successful sync
        sessionStorage.removeItem('corporate_ref');
        
        // Check if user needs to set up payment (new users, not team members)
        if (data.needsPayment && router.pathname !== '/billing-setup') {
          // Store flag to show payment setup is required
          sessionStorage.setItem('payment_required', 'true');
          // Redirect to billing setup
          router.push('/billing-setup');
        }
      })
      .catch(err => console.error('Failed to sync user:', err));
    }
  }, [user, isLoading, router.pathname]); // Only re-run if pathname changes to billing-setup

  const signIn = (corporateRef?: string, mode: 'login' | 'signup' = 'login') => {
    if (corporateRef) {
      // Store corporate ref in sessionStorage to persist through auth flow
      sessionStorage.setItem('corporate_ref', corporateRef);
    }
    // Use the proper Auth0 route - signup or login
    router.push(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login');
  };

  const signOut = () => {
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