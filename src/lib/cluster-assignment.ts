import { SupabaseClient } from '@supabase/supabase-js';
import { createHopsworksOAuthUser, getHopsworksUserByAuth0Id, updateUserProjectLimit } from './hopsworks-api';

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
      .select('stripe_customer_id, account_owner_id, email, name, given_name, family_name, hopsworks_user_id, hopsworks_username, billing_mode')
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
      let hopsworksUsername = (user as any).hopsworks_username || null;
      
      if (!hopsworksUserId || !hopsworksUsername) {
        // Try to find existing Hopsworks user first
        try {
          const existingHopsworksUser = await getHopsworksUserByAuth0Id(
            { apiUrl: cluster.api_url, apiKey: cluster.api_key },
            userId,
            user.email
          );
          
          if (existingHopsworksUser) {
            hopsworksUserId = existingHopsworksUser.id;
            hopsworksUsername = existingHopsworksUser.username;
            console.log(`Found existing Hopsworks user ${hopsworksUsername} for team member ${user.email}`);
          }
        } catch (error) {
          console.log('No existing Hopsworks user found, will create new one');
        }
        
        // Create new Hopsworks user if not found
        if (!hopsworksUserId) {
          const maxRetries = 3;
          let lastError = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // Use given_name and family_name from database
              const firstName = user.given_name || user.email.split('@')[0];
              const lastName = user.family_name || '.';
              
              console.log(`Attempt ${attempt}/${maxRetries}: Creating Hopsworks user for team member ${user.email}`);
              
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
              
              console.log(`Successfully created Hopsworks user ${hopsworksUsername} for team member ${user.email}`);
              break; // Success, exit retry loop
            } catch (error) {
              lastError = error;
              console.error(`Attempt ${attempt}/${maxRetries} failed to create Hopsworks user:`, error);
              
              if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              }
            }
          }
          
          if (!hopsworksUserId && lastError) {
            // Log failure but continue with assignment
            console.error('All attempts to create Hopsworks user failed:', lastError);
            await supabaseAdmin
              .from('health_check_failures')
              .insert({
                user_id: userId,
                email: user.email,
                check_type: 'hopsworks_user_creation_team',
                error_message: 'Failed to create Hopsworks user for team member after retries',
                details: { error: String(lastError), cluster_id: ownerAssignment.hopsworks_cluster_id }
              });
          }
        }
        
        // Update user with Hopsworks ID if we got one
        if (hopsworksUserId) {
          await supabaseAdmin
            .from('users')
            .update({ 
              hopsworks_user_id: hopsworksUserId,
              hopsworks_username: hopsworksUsername 
            })
            .eq('id', userId);
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
          assigned_at: new Date().toISOString()
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

    // For account owners, check payment method (skip for prepaid users)
    const isPrepaid = user.billing_mode === 'prepaid';
    
    // IMPORTANT: Only allow cluster assignment for:
    // 1. Prepaid users (corporate)
    // 2. Manual assignment (admin action or after payment verification)
    // DO NOT auto-assign based on stripe_customer_id alone!
    if (!isManualAssignment && !isPrepaid) {
      return { 
        success: false, 
        error: 'Automatic cluster assignment requires payment verification or prepaid status' 
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
    let hopsworksUsername = (user as any).hopsworks_username || null;
    
    if (!hopsworksUserId || !hopsworksUsername) {
      // Try to find existing Hopsworks user first
      try {
        const existingHopsworksUser = await getHopsworksUserByAuth0Id(
          { apiUrl: clusterDetails.api_url, apiKey: clusterDetails.api_key },
          userId,
          user.email
        );
        
        if (existingHopsworksUser) {
          hopsworksUserId = existingHopsworksUser.id;
          hopsworksUsername = existingHopsworksUser.username;
          console.log(`Found existing Hopsworks user ${hopsworksUsername} for ${user.email}`);
          
          // Check and update maxNumProjects if needed
          const expectedMaxProjects = (user.stripe_customer_id || isPrepaid) ? 5 : 0;
          if (existingHopsworksUser.maxNumProjects !== expectedMaxProjects) {
            console.log(`Updating maxNumProjects from ${existingHopsworksUser.maxNumProjects} to ${expectedMaxProjects} for ${user.email}`);
            await updateUserProjectLimit(
              { apiUrl: clusterDetails.api_url, apiKey: clusterDetails.api_key },
              existingHopsworksUser.id,
              expectedMaxProjects
            );
          }
        }
      } catch (error) {
        console.log('No existing Hopsworks user found, will create new one');
      }
      
      // Create new Hopsworks user if not found
      if (!hopsworksUserId) {
        const maxRetries = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Use given_name and family_name from database
            const firstName = user.given_name || user.email.split('@')[0];
            const lastName = user.family_name || '.';
            
            // Account owners with payment or prepaid get 5 projects
            const maxProjects = (user.stripe_customer_id || isPrepaid) ? 5 : 0;
            
            console.log(`Attempt ${attempt}/${maxRetries}: Creating Hopsworks user for ${user.email} with ${maxProjects} max projects`);
            
            const hopsworksUser = await createHopsworksOAuthUser(
              { apiUrl: clusterDetails.api_url, apiKey: clusterDetails.api_key },
              user.email,
              firstName,
              lastName,
              userId,
              maxProjects
            );
            
            hopsworksUserId = hopsworksUser.id;
            hopsworksUsername = hopsworksUser.username;
            
            console.log(`Successfully created Hopsworks user ${hopsworksUsername} for ${user.email}`);
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt}/${maxRetries} failed to create Hopsworks user:`, error);
            
            if (attempt < maxRetries) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
          }
        }
        
        if (!hopsworksUserId && lastError) {
          // Log failure but continue with assignment
          console.error('All attempts to create Hopsworks user failed:', lastError);
          await supabaseAdmin
            .from('health_check_failures')
            .insert({
              user_id: userId,
              email: user.email,
              check_type: 'hopsworks_user_creation_owner',
              error_message: 'Failed to create Hopsworks user for account owner after retries',
              details: { 
                error: String(lastError), 
                cluster_id: availableCluster.id,
                has_payment: !!user.stripe_customer_id,
                is_prepaid: isPrepaid
              }
            });
        }
      }
      
      // Update user with Hopsworks ID if we got one
      if (hopsworksUserId) {
        await supabaseAdmin
          .from('users')
          .update({ 
            hopsworks_user_id: hopsworksUserId,
            hopsworks_username: hopsworksUsername 
          })
          .eq('id', userId);
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
        assigned_at: new Date().toISOString()
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