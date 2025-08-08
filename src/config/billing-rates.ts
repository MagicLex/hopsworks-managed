// Default rates for display and prepaid/enterprise billing
// Postpaid users get these rates from Stripe
export const DEFAULT_RATES = {
  // Compute (per hour)
  CPU_HOUR: 0.125,           // 0.5 credits * $0.25
  GPU_HOUR: 2.50,             // 10 credits * $0.25
  RAM_GB_HOUR: 0.0125,        // 0.05 credits * $0.25
  
  // Storage (per GB per month)
  STORAGE_ONLINE_GB: 0.50,
  STORAGE_OFFLINE_GB: 0.03,
  
  // Network (per GB)
  NETWORK_EGRESS_GB: 0.10,
  
  // Credit value
  CREDIT_VALUE: 0.25
} as const;

// Credit conversion rates
export const CREDIT_RATES = {
  CPU_HOUR: 0.5,
  GPU_HOUR: 10,
  RAM_GB_HOUR: 0.05,
  STORAGE_ONLINE_GB: 2,       // 2 credits per GB/month
  STORAGE_OFFLINE_GB: 0.12,   // 0.12 credits per GB/month
  NETWORK_EGRESS_GB: 0.4
} as const;

export function calculateCreditsUsed(usage: {
  cpuHours?: number;
  gpuHours?: number;
  ramGbHours?: number;
  onlineStorageGb?: number;
  offlineStorageGb?: number;
  networkEgressGb?: number;
}): number {
  return (
    (usage.cpuHours || 0) * CREDIT_RATES.CPU_HOUR +
    (usage.gpuHours || 0) * CREDIT_RATES.GPU_HOUR +
    (usage.ramGbHours || 0) * CREDIT_RATES.RAM_GB_HOUR +
    (usage.onlineStorageGb || 0) * CREDIT_RATES.STORAGE_ONLINE_GB +
    (usage.offlineStorageGb || 0) * CREDIT_RATES.STORAGE_OFFLINE_GB +
    (usage.networkEgressGb || 0) * CREDIT_RATES.NETWORK_EGRESS_GB
  );
}

export function calculateDollarAmount(credits: number): number {
  return credits * DEFAULT_RATES.CREDIT_VALUE;
}