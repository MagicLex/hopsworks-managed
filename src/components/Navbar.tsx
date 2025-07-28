import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Box, Flex, Button } from 'tailwind-quartz';
import { UserProfile } from './UserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { useAdmin } from '@/hooks/useAdmin';
import { ADMIN_ROUTE } from '@/config/admin';

const Navbar: React.FC = () => {
  const { user, signIn } = useAuth();
  const { isAdmin } = useAdmin();
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  return (
    <>
      <Box as="nav" className="border-b border-grayShade2 bg-white">
        <Box className="max-w-7xl mx-auto px-4">
          <Flex align="center" justify="between" className="h-14">
            <Link href={user ? "/dashboard" : "/"}>
              <Image 
                src="/logo_hopsworks.svg" 
                alt="Hopsworks" 
                width={140} 
                height={32}
                className="cursor-pointer"
              />
            </Link>
            {user ? (
              <Flex align="center" gap={12}>
                {isAdmin && (
                  <Link href={ADMIN_ROUTE}>
                    <Button intent="ghost" size="sm">
                      Admin
                    </Button>
                  </Link>
                )}
                <UserProfile />
              </Flex>
            ) : (
              <Flex gap={12}>
                <Button
                  intent="ghost"
                  onClick={() => signIn()}
                  className="text-sm"
                >
                  Log In
                </Button>
                <Button
                  intent="primary"
                  onClick={() => setShowAuthModal(true)}
                  className="text-sm"
                >
                  Sign Up
                </Button>
              </Flex>
            )}
          </Flex>
        </Box>
      </Box>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        mode="signup"
      />
    </>
  );
};

export default Navbar;