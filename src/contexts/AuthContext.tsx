import React, { createContext, useContext } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  const signIn = () => {
    router.push('/api/auth/login');
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