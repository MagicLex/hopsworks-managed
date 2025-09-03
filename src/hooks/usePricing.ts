import { useState, useEffect } from 'react';

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

export function usePricing() {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pricing')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          // Use defaults if error
          setPricing(DEFAULT_PRICING);
        } else {
          setPricing(data);
        }
      })
      .catch(err => {
        console.error('Failed to fetch pricing:', err);
        setError('Failed to fetch pricing');
        // Use defaults if error
        setPricing(DEFAULT_PRICING);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { pricing, loading, error };
}