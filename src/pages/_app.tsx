import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { AuthProvider } from '@/contexts/AuthContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </UserProvider>
  );
}