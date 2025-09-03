import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Pricing {
  compute_credits: number;
  storage_online_gb: number;
  storage_offline_gb: number;
  cpu_hour: number;
  gpu_hour: number;
  ram_gb_hour: number;
  network_egress_gb: number;
}

const DEFAULT_PRICING: Pricing = {
  compute_credits: 0.35,
  storage_online_gb: 0.50,
  storage_offline_gb: 0.03,
  cpu_hour: 0.175,
  gpu_hour: 3.50,
  ram_gb_hour: 0.0175,
  network_egress_gb: 0.14,
};

interface PricingContextType {
  pricing: Pricing;
  loading: boolean;
  error: string | null;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export const PricingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch('/api/pricing')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        
        if (data.error) {
          setError(data.error);
          setPricing(DEFAULT_PRICING);
        } else {
          setPricing(data);
        }
      })
      .catch(err => {
        if (!mounted) return;
        console.error('Failed to fetch pricing:', err);
        setError('Failed to fetch pricing');
        setPricing(DEFAULT_PRICING);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PricingContext.Provider value={{ pricing, loading, error }}>
      {children}
    </PricingContext.Provider>
  );
};

export const usePricing = () => {
  const context = useContext(PricingContext);
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
};