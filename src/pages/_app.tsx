import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { AuthProvider } from '@/contexts/AuthContext';
import { PricingProvider } from '@/contexts/PricingContext';
import { CorporateProvider } from '@/contexts/CorporateContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <AuthProvider>
        <PricingProvider>
          <CorporateProvider>
            <Component {...pageProps} />
          </CorporateProvider>
        </PricingProvider>
      </AuthProvider>
    </UserProvider>
  );
}