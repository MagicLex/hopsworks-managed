import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { AuthProvider } from '@/contexts/AuthContext';
import { PricingProvider } from '@/contexts/PricingContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <AuthProvider>
        <PricingProvider>
          <Component {...pageProps} />
        </PricingProvider>
      </AuthProvider>
    </UserProvider>
  );
}