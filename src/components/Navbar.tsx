import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Box, Flex, Button } from 'tailwind-quartz';
import { UserProfile } from './UserProfile';
import { useAuth } from '@/contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, signIn } = useAuth();
  
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
              <UserProfile />
            ) : (
              <Flex gap={12}>
                <Button
                  intent="ghost"
                  size="md"
                  onClick={() => signIn()}
                >
                  Log In
                </Button>
                <Button
                  intent="primary"
                  size="md"
                  onClick={() => signIn(undefined, 'signup')}
                >
                  Sign Up
                </Button>
              </Flex>
            )}
          </Flex>
        </Box>
      </Box>
    </>
  );
};

export default Navbar;