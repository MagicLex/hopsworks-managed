// Resources we track and bill for via Stripe
export const BILLABLE_RESOURCES = {
  CPU_HOURS: 'cpu_hours',
  GPU_HOURS: 'gpu_hours',
  RAM_GB_HOURS: 'ram_gb_hours',
  STORAGE_ONLINE_GB: 'storage_online_gb',
  STORAGE_OFFLINE_GB: 'storage_offline_gb',
  NETWORK_EGRESS_GB: 'network_egress_gb'
} as const;

export type BillableResource = typeof BILLABLE_RESOURCES[keyof typeof BILLABLE_RESOURCES];

// Stripe price IDs for each resource (configured in Stripe Dashboard)
export const STRIPE_PRICE_IDS: Record<BillableResource, string> = {
  [BILLABLE_RESOURCES.CPU_HOURS]: process.env.STRIPE_PRICE_CPU_HOURS || '',
  [BILLABLE_RESOURCES.GPU_HOURS]: process.env.STRIPE_PRICE_GPU_HOURS || '',
  [BILLABLE_RESOURCES.RAM_GB_HOURS]: process.env.STRIPE_PRICE_RAM_GB_HOURS || '',
  [BILLABLE_RESOURCES.STORAGE_ONLINE_GB]: process.env.STRIPE_PRICE_STORAGE_ONLINE || '',
  [BILLABLE_RESOURCES.STORAGE_OFFLINE_GB]: process.env.STRIPE_PRICE_STORAGE_OFFLINE || '',
  [BILLABLE_RESOURCES.NETWORK_EGRESS_GB]: process.env.STRIPE_PRICE_NETWORK_EGRESS || ''
};