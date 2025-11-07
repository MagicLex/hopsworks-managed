import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { AuthProvider } from '@/contexts/AuthContext';
import { PricingProvider } from '@/contexts/PricingContext';
import { CorporateProvider } from '@/contexts/CorporateContext';
import { BillingProvider } from '@/contexts/BillingContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <AuthProvider>
        <PricingProvider>
          <CorporateProvider>
            <BillingProvider>
              <Component {...pageProps} />
            </BillingProvider>
          </CorporateProvider>
        </PricingProvider>
      </AuthProvider>
    </UserProvider>
  );
}