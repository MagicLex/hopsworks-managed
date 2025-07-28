import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
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
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = session.user.sub;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get current month usage for cost calculation
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('usage_daily')
      .select('cpu_hours, gpu_hours, storage_gb')
      .eq('user_id', userId)
      .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
      .lte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);

    if (usageError) throw usageError;

    // Calculate costs
    let totalCpuHours = 0;
    let totalGpuHours = 0;
    let avgStorageGb = 0;

    if (usageData && usageData.length > 0) {
      totalCpuHours = usageData.reduce((sum, day) => sum + (day.cpu_hours || 0), 0);
      totalGpuHours = usageData.reduce((sum, day) => sum + (day.gpu_hours || 0), 0);
      avgStorageGb = usageData.reduce((sum, day) => sum + (day.storage_gb || 0), 0) / usageData.length;
    }

    const cpuCost = totalCpuHours * 0.10;
    const gpuCost = totalGpuHours * 0.50;
    const storageCost = avgStorageGb * 0.02;
    const totalCost = cpuCost + gpuCost + storageCost;

    // Get billing history
    const { data: billingHistory, error: billingError } = await supabaseAdmin
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (billingError) console.error('Billing error:', billingError);

    return res.status(200).json({
      currentUsage: {
        cpuHours: totalCpuHours,
        gpuHours: totalGpuHours,
        storageGB: avgStorageGb,
        currentMonth: {
          cpuCost,
          gpuCost,
          storageCost,
          total: totalCost
        }
      },
      invoices: billingHistory?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_id,
        amount: bill.amount,
        status: bill.status,
        created_at: bill.created_at
      })) || []
    });
  } catch (error) {
    console.error('Error fetching billing:', error);
    return res.status(500).json({ error: 'Failed to fetch billing data' });
  }
}