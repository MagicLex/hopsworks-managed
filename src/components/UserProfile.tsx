import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Card, Button, Flex, Box, Title, Text, Labeling, Badge, Dropdown, DropdownItem } from 'tailwind-quartz';
import { User, LogOut, Settings, CreditCard, Activity, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { ADMIN_ROUTE } from '@/config/admin';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    setIsDropdownOpen(false);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsDropdownOpen(false);
  };

  return (
    <Box className="relative">
      <Button
        intent="ghost"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2"
      >
        <User size={16} />
        <span className="text-sm">{user.email}</span>
      </Button>

      {isDropdownOpen && (
        <Box className="absolute right-0 top-full mt-2 w-64 z-50">
          <Card className="p-0" withShadow>
            <Box className="p-4 border-b border-grayShade2">
              <Labeling gray className="text-xs uppercase mb-1">Account</Labeling>
              <Text className="font-mono text-sm">{user.email}</Text>
            </Box>

            <Box className="p-2">
              <DropdownItem onClick={() => handleNavigation('/cluster')}>
                <Flex align="center" gap={8}>
                  <Activity size={14} />
                  <span>Cluster Status</span>
                </Flex>
              </DropdownItem>
              
              <DropdownItem onClick={() => handleNavigation('/billing')}>
                <Flex align="center" gap={8}>
                  <CreditCard size={14} />
                  <span>Billing</span>
                </Flex>
              </DropdownItem>
              
              <DropdownItem onClick={() => handleNavigation('/account')}>
                <Flex align="center" gap={8}>
                  <Settings size={14} />
                  <span>Account Settings</span>
                </Flex>
              </DropdownItem>
              
              {isAdmin && (
                <DropdownItem onClick={() => handleNavigation(ADMIN_ROUTE)}>
                  <Flex align="center" gap={8}>
                    <Shield size={14} />
                    <span>Admin Dashboard</span>
                  </Flex>
                </DropdownItem>
              )}
              
              <Box className="border-t border-grayShade2 mt-2 pt-2">
                <DropdownItem onClick={handleSignOut}>
                  <Flex align="center" gap={8}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </Flex>
                </DropdownItem>
              </Box>
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
};