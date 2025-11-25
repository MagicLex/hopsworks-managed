// Single source of truth: Credit value
const CREDIT_VALUE = 0.35;

// Credit rates (credits per unit)
// All dollar amounts are derived from these
export const CREDIT_RATES = {
  CPU_HOUR: 0.5,              // credits per CPU hour
  GPU_HOUR: 10,               // credits per GPU hour
  RAM_GB_HOUR: 0.05,          // credits per GB-hour
  STORAGE_ONLINE_GB: 1.4286,  // credits per GB/month ($0.50 / $0.35)
  STORAGE_OFFLINE_GB: 0.0857, // credits per GB/month ($0.03 / $0.35)
  NETWORK_EGRESS_GB: 0.4      // credits per GB
} as const;

// Dollar rates derived from credit rates
// This ensures consistency between credits and dollars
export const DEFAULT_RATES = {
  CPU_HOUR: CREDIT_RATES.CPU_HOUR * CREDIT_VALUE,
  GPU_HOUR: CREDIT_RATES.GPU_HOUR * CREDIT_VALUE,
  RAM_GB_HOUR: CREDIT_RATES.RAM_GB_HOUR * CREDIT_VALUE,
  STORAGE_ONLINE_GB: 0.50,    // Fixed price from Stripe
  STORAGE_OFFLINE_GB: 0.03,   // Fixed price from Stripe
  NETWORK_EGRESS_GB: CREDIT_RATES.NETWORK_EGRESS_GB * CREDIT_VALUE,
  CREDIT_VALUE: CREDIT_VALUE
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