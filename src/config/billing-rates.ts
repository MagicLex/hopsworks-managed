export interface BillingRates {
  cpuHourRate: number;
  gpuHourRate: number;
  storageGbMonthRate: number;
  apiCallsPer1000Rate: number;
  creditRate: number;
}

export const defaultBillingRates: BillingRates = {
  cpuHourRate: 0.10,
  gpuHourRate: 2.00,
  storageGbMonthRate: 0.15,
  apiCallsPer1000Rate: 0.01,
  creditRate: 1.00
};

// User-specific rate overrides
export const userBillingRates: Record<string, Partial<BillingRates>> = {
  // Example: 'auth0|123456': { cpuHourRate: 0.08 }
};

export function getBillingRatesForUser(userId: string): BillingRates {
  const userRates = userBillingRates[userId];
  if (userRates) {
    return { ...defaultBillingRates, ...userRates };
  }
  return defaultBillingRates;
}