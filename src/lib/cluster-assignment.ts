import { SupabaseClient } from '@supabase/supabase-js';
import { createHopsworksOAuthUser } from './hopsworks-api';

export async function assignUserToCluster(
  supabaseAdmin: SupabaseClient,
  userId: string,
  isManualAssignment: boolean = false
): Promise<{ success: boolean; clusterId?: string; error?: string }> {
  try {
    // Check if user already has cluster assignment
    const { data: existingAssignment } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('hopsworks_cluster_id')
      .eq('user_id', userId)
      .single();

    if (existingAssignment) {
      return { 
        success: true, 
        clusterId: existingAssignment.hopsworks_cluster_id,
        error: 'User already assigned to cluster' 
      };
    }

    // Get user details including account owner
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, account_owner_id, email, name, hopsworks_user_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return { 
        success: false, 
        error: 'User not found' 
      };
    }

    // If user is a team member, assign to same cluster as account owner
    if (user.account_owner_id) {
      const { data: ownerAssignment } = await supabaseAdmin
        .from('user_hopsworks_assignments')
        .select('hopsworks_cluster_id')
        .eq('user_id', user.account_owner_id)
        .single();

      if (!ownerAssignment) {
        return { 
          success: false, 
          error: 'Account owner must be assigned to a cluster first' 
        };
      }

      // Get cluster details
      const { data: cluster } = await supabaseAdmin
        .from('hopsworks_clusters')
        .select('api_url, api_key')
        .eq('id', ownerAssignment.hopsworks_cluster_id)
        .single();

      if (!cluster) {
        return { 
          success: false, 
          error: 'Cluster not found' 
        };
      }

      // Create Hopsworks user if not exists
      let hopsworksUserId = user.hopsworks_user_id;
      let hopsworksUsername = null;
      
      if (!hopsworksUserId) {
        try {
          const [firstName, ...lastNameParts] = (user.name || user.email).split(' ');
          const lastName = lastNameParts.join(' ') || firstName;
          
          const hopsworksUser = await createHopsworksOAuthUser(
            { apiUrl: cluster.api_url, apiKey: cluster.api_key },
            user.email,
            firstName,
            lastName,
            userId,
            0 // Team members stay at 0 projects
          );
          
          hopsworksUserId = hopsworksUser.id;
          hopsworksUsername = hopsworksUser.username;
          
          // Update user with Hopsworks ID
          await supabaseAdmin
            .from('users')
            .update({ 
              hopsworks_user_id: hopsworksUserId,
              hopsworks_username: hopsworksUsername 
            })
            .eq('id', userId);
        } catch (error) {
          console.error('Failed to create Hopsworks user:', error);
          // Continue with assignment even if Hopsworks user creation fails
        }
      }

      // Assign team member to same cluster as owner
      const { error: assignError } = await supabaseAdmin
        .from('user_hopsworks_assignments')
        .insert({
          user_id: userId,
          hopsworks_cluster_id: ownerAssignment.hopsworks_cluster_id,
          hopsworks_user_id: hopsworksUserId,
          hopsworks_username: hopsworksUsername,
          assigned_at: new Date().toISOString(),
          assigned_by: 'team_member_auto'
        });

      if (assignError) {
        throw assignError;
      }

      // Increment cluster user count
      const { error: rpcError } = await supabaseAdmin.rpc('increment_cluster_users', {
        cluster_id: ownerAssignment.hopsworks_cluster_id
      });

      if (rpcError) {
        throw rpcError;
      }

      console.log(`Successfully assigned team member ${userId} to same cluster as account owner`);
      return { 
        success: true, 
        clusterId: ownerAssignment.hopsworks_cluster_id 
      };
    }

    // For account owners, check payment method
    if (!isManualAssignment && !user.stripe_customer_id) {
      return { 
        success: false, 
        error: 'User must set up payment method before cluster assignment' 
      };
    }

    // Find available cluster with capacity
    const { data: clusters } = await supabaseAdmin
      .from('hopsworks_clusters')
      .select('id, name, current_users, max_users')
      .eq('status', 'active')
      .order('current_users', { ascending: true });

    const availableCluster = clusters?.find(c => c.current_users < c.max_users);

    if (!availableCluster) {
      return { 
        success: false, 
        error: 'No available clusters with capacity' 
      };
    }

    // Get cluster details for Hopsworks user creation
    const { data: clusterDetails } = await supabaseAdmin
      .from('hopsworks_clusters')
      .select('api_url, api_key')
      .eq('id', availableCluster.id)
      .single();

    if (!clusterDetails) {
      return { 
        success: false, 
        error: 'Cluster details not found' 
      };
    }

    // Create Hopsworks user if not exists
    let hopsworksUserId = user.hopsworks_user_id;
    let hopsworksUsername = null;
    
    if (!hopsworksUserId) {
      try {
        const [firstName, ...lastNameParts] = (user.name || user.email).split(' ');
        const lastName = lastNameParts.join(' ') || firstName;
        
        // Account owners get cluster assignment AFTER payment, so give them 5 projects
        const maxProjects = user.stripe_customer_id ? 5 : 0;
        
        const hopsworksUser = await createHopsworksOAuthUser(
          { apiUrl: clusterDetails.api_url, apiKey: clusterDetails.api_key },
          user.email,
          firstName,
          lastName,
          userId,
          maxProjects // Billing users get 5, others get 0
        );
        
        hopsworksUserId = hopsworksUser.id;
        hopsworksUsername = hopsworksUser.username;
        
        // Update user with Hopsworks ID
        await supabaseAdmin
          .from('users')
          .update({ 
            hopsworks_user_id: hopsworksUserId,
            hopsworks_username: hopsworksUsername 
          })
          .eq('id', userId);
      } catch (error) {
        console.error('Failed to create Hopsworks user:', error);
        // Continue with assignment even if Hopsworks user creation fails
      }
    }

    // Assign user to cluster
    const { error: assignError } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .insert({
        user_id: userId,
        hopsworks_cluster_id: availableCluster.id,
        hopsworks_user_id: hopsworksUserId,
        hopsworks_username: hopsworksUsername,
        assigned_at: new Date().toISOString(),
        assigned_by: isManualAssignment ? 'admin' : 'system'
      });

    if (assignError) {
      throw assignError;
    }

    // Increment cluster user count
    const { error: rpcError } = await supabaseAdmin.rpc('increment_cluster_users', {
      cluster_id: availableCluster.id
    });

    if (rpcError) {
      throw rpcError;
    }

    console.log(`Successfully assigned user ${userId} to cluster ${availableCluster.name} (${isManualAssignment ? 'manual' : 'automatic'})`);

    return { 
      success: true, 
      clusterId: availableCluster.id 
    };
  } catch (error) {
    console.error('Error assigning user to cluster:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to assign cluster' 
    };
  }
}