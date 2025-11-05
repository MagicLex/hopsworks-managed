import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Box, Flex, Button, Text } from 'tailwind-quartz';
import { UserProfile } from './UserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useCorporate } from '@/contexts/CorporateContext';

const Navbar: React.FC = () => {
  const { user, signIn } = useAuth();
  const { isCorporate, companyName, companyLogo } = useCorporate();
  
  return (
    <>
      <Box as="nav" className="border-b border-grayShade2 bg-white">
        <Box className="max-w-7xl mx-auto px-4">
          <Flex align="center" justify="between" className="h-14">
            <Flex align="center" gap={24}>
              <Link href={user ? "/dashboard" : "/"}>
                <Image 
                  src="/logo_hopsworks.svg" 
                  alt="Hopsworks" 
                  width={140} 
                  height={32}
                  className="cursor-pointer"
                />
              </Link>
              {isCorporate && companyName && (
                <Flex align="center" gap={8} className="border-l border-gray-300 pl-4">
                  {companyLogo && (
                    <img 
                      src={companyLogo} 
                      alt={companyName}
                      className="h-6 w-6 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <Text className="text-sm font-medium text-gray-600 max-w-[150px] truncate">
                    {companyName.length > 20 ? `${companyName.substring(0, 20)}...` : companyName}
                  </Text>
                </Flex>
              )}
              {!user && (
                <Link href="/pricing">
                  <Button
                    intent="ghost"
                    size="md"
                  >
                    Pricing
                  </Button>
                </Link>
              )}
            </Flex>
            {user ? (
              <UserProfile />
            ) : (
              <Flex gap={12} align="center">
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
                  onClick={() => signIn(undefined, undefined, 'signup')}
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