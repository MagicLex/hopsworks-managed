import React from 'react';
import { Toggle, Flex, Labeling } from 'tailwind-quartz';

interface BillingToggleProps {
  isYearly: boolean;
  onToggle: () => void;
}

export const BillingToggle: React.FC<BillingToggleProps> = ({ isYearly, onToggle }) => {
  return (
    <Flex align="center" gap={12} className="mb-8">
      <Labeling gray>Monthly billing</Labeling>
      <Toggle
        checked={isYearly}
        onChange={onToggle}
      />
      <Labeling gray>Annual billing (save 20%)</Labeling>
    </Flex>
  );
};