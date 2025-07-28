// Pricing configuration for metered billing
// Based on hopsworks-cloud pricing model

export interface InstancePricing {
  instanceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  hourlyRate: number;
  cpuCount: number;
  memoryGb: number;
}

// Instance hourly rates in USD
export const instanceHourlyRates: Record<string, number> = {
  // AWS T3 instances (burstable)
  't3.medium': 0.10,    // 2 vCPU, 4GB RAM
  't3.large': 0.19,     // 2 vCPU, 8GB RAM
  't3.xlarge': 0.38,    // 4 vCPU, 16GB RAM
  't3.2xlarge': 0.76,   // 8 vCPU, 32GB RAM
  
  // AWS M5 instances (general purpose)
  'm5.large': 0.25,     // 2 vCPU, 8GB RAM
  'm5.xlarge': 0.50,    // 4 vCPU, 16GB RAM
  'm5.2xlarge': 1.00,   // 8 vCPU, 32GB RAM
  'm5.4xlarge': 2.00,   // 16 vCPU, 64GB RAM
  'm5.8xlarge': 4.00,   // 32 vCPU, 128GB RAM
  'm5.12xlarge': 6.00,  // 48 vCPU, 192GB RAM
  'm5.16xlarge': 8.00,  // 64 vCPU, 256GB RAM
  
  // AWS C5 instances (compute optimized)
  'c5.large': 0.22,     // 2 vCPU, 4GB RAM
  'c5.xlarge': 0.44,    // 4 vCPU, 8GB RAM
  'c5.2xlarge': 0.88,   // 8 vCPU, 16GB RAM
  'c5.4xlarge': 1.76,   // 16 vCPU, 32GB RAM
  'c5.9xlarge': 3.96,   // 36 vCPU, 72GB RAM
  
  // AWS R5 instances (memory optimized)
  'r5.large': 0.30,     // 2 vCPU, 16GB RAM
  'r5.xlarge': 0.60,    // 4 vCPU, 32GB RAM
  'r5.2xlarge': 1.20,   // 8 vCPU, 64GB RAM
  'r5.4xlarge': 2.40,   // 16 vCPU, 128GB RAM
  'r5.8xlarge': 4.80,   // 32 vCPU, 256GB RAM
  'r5.12xlarge': 7.20,  // 48 vCPU, 384GB RAM
  
  // Azure instances
  'Standard_D2s_v4': 0.25,
  'Standard_D4s_v4': 0.50,
  'Standard_D8s_v4': 1.00,
  'Standard_D16s_v4': 2.00,
  'Standard_D32s_v4': 4.00,
  'Standard_D48s_v4': 6.00,
  
  // GCP instances
  'e2-standard-2': 0.25,
  'e2-standard-4': 0.50,
  'e2-standard-8': 1.00,
  'e2-standard-16': 2.00,
  'n2-standard-4': 0.58,
  'n2-standard-8': 1.16,
  'n2-standard-16': 2.32,
  'n2-standard-32': 4.64,
  
  // Default for unknown instance types
  'unknown': 0.10
};

// Storage pricing tiers (per GB per month)
export const storagePricingTiers = [
  { minGb: 0, maxGb: 10, pricePerGb: 0 },        // Free tier
  { minGb: 10, maxGb: 100, pricePerGb: 0.10 },
  { minGb: 100, maxGb: 1000, pricePerGb: 0.08 },
  { minGb: 1000, maxGb: 10000, pricePerGb: 0.06 },
  { minGb: 10000, maxGb: Infinity, pricePerGb: 0.04 }
];

// API call pricing (per 1000 calls)
export const apiCallPricing = {
  featureStore: 0.10,      // $0.10 per 1000 calls
  modelInference: 1.00,    // $1.00 per 1000 calls
  general: 0.05           // $0.05 per 1000 calls
};

export function calculateCpuCost(instanceType: string, hours: number): number {
  const rate = instanceHourlyRates[instanceType] || instanceHourlyRates['unknown'];
  return Number((rate * hours).toFixed(2));
}

export function calculateStorageCost(gbMonths: number): number {
  let totalCost = 0;
  let remainingGb = gbMonths;
  
  for (const tier of storagePricingTiers) {
    if (remainingGb <= 0) break;
    
    const tierGb = Math.min(remainingGb, tier.maxGb - tier.minGb);
    totalCost += tierGb * tier.pricePerGb;
    remainingGb -= tierGb;
  }
  
  return Number(totalCost.toFixed(2));
}

export function calculateApiCost(apiType: keyof typeof apiCallPricing, callCount: number): number {
  const pricePerThousand = apiCallPricing[apiType] || apiCallPricing.general;
  return Number((callCount / 1000 * pricePerThousand).toFixed(2));
}

export function getInstanceType(instanceInfo: string): string {
  // Extract instance type from various formats
  // e.g., "m5.xlarge", "Standard_D4s_v4", "e2-standard-4"
  const match = instanceInfo.match(/^[\w\d.-]+/);
  return match ? match[0] : 'unknown';
}