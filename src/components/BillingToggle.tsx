import React from 'react';

interface BillingToggleProps {
  isYearly: boolean;
  onToggle: () => void;
}

export const BillingToggle: React.FC<BillingToggleProps> = ({ isYearly, onToggle }) => {
  return (
    <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
      <span>Monthly billing</span>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
          isYearly ? 'bg-[#1eb182]' : 'bg-gray-300'
        }`}
        aria-label="Toggle billing period"
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            isYearly ? 'translate-x-6' : ''
          }`}
        />
      </button>
      <span>Annual billing (save 20%)</span>
    </div>
  );
};