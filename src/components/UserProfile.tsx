import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Card, Button, Box, Text, Labeling, IconLabel, Dropdown, DropdownItem } from 'tailwind-quartz';
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
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsDropdownOpen(false);
  };

  return (
    <Box className="relative">
      <Button
        intent="ghost"
        size="md"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 max-w-[200px]"
      >
        <span className="truncate">{user.email}</span>
      </Button>

      {isDropdownOpen && (
        <Box className="absolute right-0 top-full mt-2 w-64 z-50">
          <Card className="p-0" withShadow>
            <Box className="p-4 border-b border-grayShade2">
              <Labeling gray className="text-xs uppercase mb-1">Account</Labeling>
              <Text className="font-mono text-sm truncate">{user.email}</Text>
            </Box>

            <Box className="p-2">
              <DropdownItem onClick={() => handleNavigation('/dashboard')}>
                <IconLabel icon={<Activity size={14} />}>Dashboard</IconLabel>
              </DropdownItem>

              <DropdownItem onClick={() => handleNavigation('/dashboard?tab=billing')}>
                <IconLabel icon={<CreditCard size={14} />}>Billing</IconLabel>
              </DropdownItem>

              <DropdownItem onClick={() => handleNavigation('/dashboard?tab=settings')}>
                <IconLabel icon={<Settings size={14} />}>Account Settings</IconLabel>
              </DropdownItem>

              {isAdmin && (
                <DropdownItem onClick={() => handleNavigation(ADMIN_ROUTE)}>
                  <IconLabel icon={<Shield size={14} />}>Admin Dashboard</IconLabel>
                </DropdownItem>
              )}

              <Box className="border-t border-grayShade2 mt-2 pt-2">
                <DropdownItem onClick={handleSignOut}>
                  <IconLabel icon={<LogOut size={14} />}>Sign Out</IconLabel>
                </DropdownItem>
              </Box>
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
};