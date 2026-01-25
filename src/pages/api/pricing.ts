import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch active pricing from stripe_products table
    const { data: products, error } = await supabaseAdmin
      .from('stripe_products')
      .select('product_type, unit_price, unit_name')
      .eq('active', true);

    if (error) throw error;

    // Transform into a pricing object
    // Credit multipliers must match CREDIT_RATES in billing-rates.ts
    const pricing = {
      compute_credits: 0.35,
      storage_online_gb: 0.50,
      storage_offline_gb: 0.03,
      // Add computed rates for display (credit_value * credit_rate)
      cpu_hour: 0.35,       // 0.35 * 1 (CPU_HOUR rate)
      gpu_hour: 3.50,       // 0.35 * 10 (GPU_HOUR rate)
      ram_gb_hour: 0.035,   // 0.35 * 0.1 (RAM_GB_HOUR rate)
      network_egress_gb: 0.14,
    };

    // Override with actual database values
    products?.forEach((product) => {
      if (product.product_type === 'compute_credits') {
        pricing.compute_credits = product.unit_price;
        // Recalculate dependent rates - multipliers must match billing-rates.ts
        pricing.cpu_hour = product.unit_price * 1;      // CPU_HOUR = 1 credit
        pricing.gpu_hour = product.unit_price * 10;     // GPU_HOUR = 10 credits
        pricing.ram_gb_hour = product.unit_price * 0.1; // RAM_GB_HOUR = 0.1 credits
        pricing.network_egress_gb = product.unit_price * 0.4;
      } else if (product.product_type === 'storage_online_gb') {
        pricing.storage_online_gb = product.unit_price;
      } else if (product.product_type === 'storage_offline_gb') {
        pricing.storage_offline_gb = product.unit_price;
      }
    });

    res.status(200).json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({
      error: 'Failed to fetch pricing',
      // Return defaults as fallback - must match billing-rates.ts
      compute_credits: 0.35,
      storage_online_gb: 0.50,
      storage_offline_gb: 0.03,
      cpu_hour: 0.35,       // 0.35 * 1
      gpu_hour: 3.50,       // 0.35 * 10
      ram_gb_hour: 0.035,   // 0.35 * 0.1
      network_egress_gb: 0.14,
    });
  }
}