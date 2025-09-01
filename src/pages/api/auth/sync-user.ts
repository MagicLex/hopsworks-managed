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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sub: userId, email, name } = session.user;
    const { corporateRef } = req.body;

    // Check if user exists in our database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingUser) {
      let billingMode = null;
      let metadata: any = {};
      let registrationSource = 'organic';
      
      // Handle corporate registration
      if (corporateRef) {
        try {
          // Validate corporate registration
          const validateResponse = await fetch(
            `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/validate-corporate`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dealId: corporateRef, email })
            }
          );
          
          const validationResult = await validateResponse.json();
          
          if (validationResult.valid) {
            billingMode = 'prepaid';
            metadata.corporate_ref = corporateRef;
            registrationSource = 'corporate';
            console.log(`Corporate registration validated for ${email} with deal ${corporateRef}`);
          } else {
            console.log(`Corporate registration failed validation for ${email}: ${validationResult.error}`);
          }
        } catch (error) {
          console.error('Corporate validation error:', error);
        }
      }
      
      // Create new user
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email,
          name: name || null,
          registration_source: registrationSource,
          registration_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
          status: 'active',
          billing_mode: billingMode,
          metadata
        });

      if (userError && userError.code !== '23505') { // Ignore duplicate key errors
        throw userError;
      }

      // Create user credits record
      await supabaseAdmin
        .from('user_credits')
        .insert({ user_id: userId });

      // Check if user has payment method set up or is prepaid
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, billing_mode')
        .eq('id', userId)
        .single();

      // Assign cluster if user has payment method OR is prepaid corporate user
      if (userData?.stripe_customer_id || userData?.billing_mode === 'prepaid') {
        // User has payment method, check if they need cluster assignment
        const { data: existingAssignment } = await supabaseAdmin
          .from('user_hopsworks_assignments')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (!existingAssignment) {
          // Find and assign available cluster
          const { data: clusters } = await supabaseAdmin
            .from('hopsworks_clusters')
            .select('id, current_users, max_users')
            .eq('status', 'active')
            .order('current_users', { ascending: true });
          
          const availableCluster = clusters?.find(c => c.current_users < c.max_users);

          if (availableCluster) {
            await supabaseAdmin
              .from('user_hopsworks_assignments')
              .insert({
                user_id: userId,
                hopsworks_cluster_id: availableCluster.id
              });
              
            await supabaseAdmin.rpc('increment_cluster_users', { 
              cluster_id: availableCluster.id 
            });

            const assignmentReason = userData?.billing_mode === 'prepaid' ? 'corporate prepaid' : 'payment setup';
            console.log(`Assigned user ${userId} to cluster after ${assignmentReason}`);
          }
        }
      } else {
        console.log(`User ${userId} has no payment method and is not prepaid - skipping cluster assignment`);
      }
    } else {
      // Update last login
      // First get current login count
      const { data: currentUser } = await supabaseAdmin
        .from('users')
        .select('login_count, hopsworks_username, user_hopsworks_assignments!left(hopsworks_cluster_id, hopsworks_username)')
        .eq('id', userId)
        .single();
      
      await supabaseAdmin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (currentUser?.login_count || 0) + 1
        })
        .eq('id', userId);
        
      // Check if user needs Hopsworks username sync
      if (!currentUser?.hopsworks_username && currentUser?.user_hopsworks_assignments?.[0]) {
        const assignment = currentUser.user_hopsworks_assignments[0];
        
        // Get cluster details
        const { data: cluster } = await supabaseAdmin
          .from('hopsworks_clusters')
          .select('api_url, api_key')
          .eq('id', assignment.hopsworks_cluster_id)
          .single();
          
        if (cluster) {
          try {
            // Import the function to look up user by email
            const { getHopsworksUserByAuth0Id } = await import('../../../lib/hopsworks-api');
            
            const credentials = {
              apiUrl: cluster.api_url,
              apiKey: cluster.api_key
            };
            
            // Try to find existing Hopsworks user by email
            const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, email);
            
            if (hopsworksUser?.username) {
              // Update both users table and assignment with the username
              await supabaseAdmin
                .from('users')
                .update({ hopsworks_username: hopsworksUser.username })
                .eq('id', userId);
                
              await supabaseAdmin
                .from('user_hopsworks_assignments')
                .update({ hopsworks_username: hopsworksUser.username })
                .eq('user_id', userId)
                .eq('hopsworks_cluster_id', assignment.hopsworks_cluster_id);
                
              console.log(`Synced Hopsworks username ${hopsworksUser.username} for user ${email}`);
            }
          } catch (error) {
            console.error(`Failed to sync Hopsworks username for ${email}:`, error);
            // Don't fail the login if we can't sync the username
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
}