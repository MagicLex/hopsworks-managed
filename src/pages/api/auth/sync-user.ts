import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { assignUserToCluster } from '../../../lib/cluster-assignment';
import { getHopsworksUserByUsername, updateUserProjectLimit, createHopsworksOAuthUser } from '../../../lib/hopsworks-api';

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

async function logHealthCheckFailure(
  userId: string,
  email: string,
  checkType: string,
  error: string,
  details?: any
) {
  try {
    await supabaseAdmin
      .from('health_check_failures')
      .insert({
        user_id: userId,
        email,
        check_type: checkType,
        error_message: error,
        details,
        created_at: new Date().toISOString()
      });
  } catch (err) {
    console.error('Failed to log health check failure:', err);
  }
}

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
    const healthCheckResults = {
      userExists: false,
      billingEnabled: false,
      clusterAssigned: false,
      hopsworksUserExists: false,
      usernamesSynced: false,
      maxNumProjectsCorrect: false,
      teamMembershipCorrect: false
    };

    // Check if user exists in our database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
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
            `${process.env.AUTH0_BASE_URL || 'http://localhost:3000'}/api/auth/validate-corporate`,
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
      healthCheckResults.userExists = true;
      
      // HEALTH CHECK 1: Verify billing status
      console.log(`[Health Check] Checking billing for user ${email}`);
      const isTeamMember = !!existingUser.account_owner_id;
      
      if (!isTeamMember) {
        // Account owners need billing
        if (!existingUser.stripe_customer_id) {
          console.log(`[Health Check] User ${email} missing Stripe customer - attempting to create`);
          try {
            const stripeCustomer = await stripe.customers.create({
              email,
              name: name || email,
              metadata: {
                user_id: userId,
                auth0_id: userId
              }
            });
            
            await supabaseAdmin
              .from('users')
              .update({
                stripe_customer_id: stripeCustomer.id,
                billing_mode: existingUser.billing_mode || 'postpaid'
              })
              .eq('id', userId);
            
            console.log(`[Health Check] Created Stripe customer ${stripeCustomer.id} for ${email}`);
            healthCheckResults.billingEnabled = true;
          } catch (error) {
            await logHealthCheckFailure(userId, email, 'stripe_customer_creation', 
              'Failed to create Stripe customer', error);
            console.error(`[Health Check] Failed to create Stripe customer for ${email}:`, error);
          }
        } else {
          healthCheckResults.billingEnabled = true;
        }
        
        // Check subscription for postpaid users
        if (existingUser.billing_mode === 'postpaid' && !existingUser.stripe_subscription_id) {
          console.log(`[Health Check] User ${email} missing subscription - attempting to create`);
          try {
            const { data: stripeProducts } = await supabaseAdmin
              .from('stripe_products')
              .select('*')
              .eq('active', true);

            if (stripeProducts && stripeProducts.length > 0) {
              const subscription = await stripe.subscriptions.create({
                customer: existingUser.stripe_customer_id,
                items: stripeProducts.map(product => ({
                  price: product.stripe_price_id
                })),
                metadata: {
                  user_id: userId
                }
              });

              await supabaseAdmin
                .from('users')
                .update({
                  stripe_subscription_id: subscription.id,
                  stripe_subscription_status: subscription.status
                })
                .eq('id', userId);
              
              console.log(`[Health Check] Created subscription ${subscription.id} for ${email}`);
            }
          } catch (error) {
            await logHealthCheckFailure(userId, email, 'subscription_creation', 
              'Failed to create subscription', error);
            console.error(`[Health Check] Failed to create subscription for ${email}:`, error);
          }
        }
      } else {
        // Team members inherit billing from account owner
        healthCheckResults.billingEnabled = true;
      }
      
      // HEALTH CHECK 2: Verify cluster assignment
      console.log(`[Health Check] Checking cluster assignment for ${email}`);
      const { data: assignment } = await supabaseAdmin
        .from('user_hopsworks_assignments')
        .select(`
          *,
          hopsworks_clusters (
            id,
            name,
            api_url,
            api_key,
            status
          )
        `)
        .eq('user_id', userId)
        .single();
      
      if (!assignment) {
        // Try to assign cluster
        const shouldAssign = isTeamMember || 
                           existingUser.stripe_customer_id || 
                           existingUser.billing_mode === 'prepaid';
        
        if (shouldAssign) {
          console.log(`[Health Check] User ${email} not assigned to cluster - attempting assignment`);
          const clusterResult = await assignUserToCluster(supabaseAdmin, userId);
          
          if (clusterResult.success) {
            console.log(`[Health Check] Successfully assigned ${email} to cluster ${clusterResult.clusterId}`);
            healthCheckResults.clusterAssigned = true;
            
            // Re-fetch assignment for further checks
            const { data: newAssignment } = await supabaseAdmin
              .from('user_hopsworks_assignments')
              .select(`
                *,
                hopsworks_clusters (
                  id,
                  name,
                  api_url,
                  api_key,
                  status
                )
              `)
              .eq('user_id', userId)
              .single();
            
            if (newAssignment) {
              Object.assign(assignment, newAssignment);
            }
          } else {
            await logHealthCheckFailure(userId, email, 'cluster_assignment', 
              clusterResult.error || 'Failed to assign cluster');
            console.error(`[Health Check] Failed to assign cluster to ${email}: ${clusterResult.error}`);
          }
        } else {
          console.log(`[Health Check] User ${email} not eligible for cluster assignment yet`);
        }
      } else {
        healthCheckResults.clusterAssigned = true;
      }
      
      // HEALTH CHECK 3: Verify Hopsworks user and settings
      if (assignment?.hopsworks_clusters) {
        const cluster = assignment.hopsworks_clusters;
        const credentials = {
          apiUrl: cluster.api_url,
          apiKey: cluster.api_key
        };
        
        console.log(`[Health Check] Checking Hopsworks user for ${email}`);
        
        // Check if Hopsworks user exists
        let hopsworksUser = null;
        let hopsworksUsername = assignment.hopsworks_username || existingUser.hopsworks_username;
        
        if (hopsworksUsername) {
          try {
            hopsworksUser = await getHopsworksUserByUsername(credentials, hopsworksUsername);
            healthCheckResults.hopsworksUserExists = !!hopsworksUser;
          } catch (error) {
            console.error(`[Health Check] Failed to fetch Hopsworks user ${hopsworksUsername}:`, error);
          }
        }
        
        // If no Hopsworks user, try to create one
        if (!hopsworksUser) {
          console.log(`[Health Check] Hopsworks user not found for ${email} - attempting to create`);
          try {
            const [firstName, ...lastNameParts] = (name || email).split(' ');
            const lastName = lastNameParts.join(' ') || firstName;
            const expectedMaxProjects = isTeamMember ? 0 : 
                                      (existingUser.stripe_customer_id || existingUser.billing_mode === 'prepaid') ? 5 : 0;
            
            const newHopsworksUser = await createHopsworksOAuthUser(
              credentials,
              email,
              firstName,
              lastName,
              userId,
              expectedMaxProjects
            );
            
            hopsworksUser = newHopsworksUser;
            hopsworksUsername = newHopsworksUser.username;
            healthCheckResults.hopsworksUserExists = true;
            
            // Update database with Hopsworks info
            await supabaseAdmin
              .from('users')
              .update({ 
                hopsworks_user_id: newHopsworksUser.id,
                hopsworks_username: hopsworksUsername
              })
              .eq('id', userId);
            
            await supabaseAdmin
              .from('user_hopsworks_assignments')
              .update({ 
                hopsworks_user_id: newHopsworksUser.id,
                hopsworks_username: hopsworksUsername
              })
              .eq('user_id', userId);
            
            console.log(`[Health Check] Created Hopsworks user ${hopsworksUsername} for ${email}`);
          } catch (error) {
            await logHealthCheckFailure(userId, email, 'hopsworks_user_creation', 
              'Failed to create Hopsworks user', error);
            console.error(`[Health Check] Failed to create Hopsworks user for ${email}:`, error);
          }
        }
        
        // HEALTH CHECK 4: Verify maxNumProjects is correct
        if (hopsworksUser) {
          const expectedMaxProjects = isTeamMember ? 0 : 
                                    (existingUser.stripe_customer_id || existingUser.billing_mode === 'prepaid') ? 5 : 0;
          
          if (hopsworksUser.maxNumProjects !== expectedMaxProjects) {
            console.log(`[Health Check] User ${email} has incorrect maxNumProjects (${hopsworksUser.maxNumProjects} vs expected ${expectedMaxProjects}) - fixing`);
            try {
              await updateUserProjectLimit(credentials, hopsworksUser.id, expectedMaxProjects);
              healthCheckResults.maxNumProjectsCorrect = true;
              console.log(`[Health Check] Updated maxNumProjects to ${expectedMaxProjects} for ${email}`);
            } catch (error) {
              await logHealthCheckFailure(userId, email, 'maxnumprojects_update', 
                `Failed to update maxNumProjects from ${hopsworksUser.maxNumProjects} to ${expectedMaxProjects}`, error);
              console.error(`[Health Check] Failed to update maxNumProjects for ${email}:`, error);
            }
          } else {
            healthCheckResults.maxNumProjectsCorrect = true;
          }
          
          // Sync username if needed
          if (hopsworksUsername && hopsworksUsername !== existingUser.hopsworks_username) {
            await supabaseAdmin
              .from('users')
              .update({ hopsworks_username: hopsworksUsername })
              .eq('id', userId);
            healthCheckResults.usernamesSynced = true;
          } else if (hopsworksUsername) {
            healthCheckResults.usernamesSynced = true;
          }
        }
      }
      
      // HEALTH CHECK 5: Verify team membership consistency
      if (isTeamMember) {
        const { data: ownerAssignment } = await supabaseAdmin
          .from('user_hopsworks_assignments')
          .select('hopsworks_cluster_id')
          .eq('user_id', existingUser.account_owner_id)
          .single();
        
        if (ownerAssignment && assignment) {
          if (ownerAssignment.hopsworks_cluster_id !== assignment.hopsworks_cluster_id) {
            console.log(`[Health Check] Team member ${email} on wrong cluster - should be ${ownerAssignment.hopsworks_cluster_id}`);
            await logHealthCheckFailure(userId, email, 'team_cluster_mismatch', 
              `Team member on cluster ${assignment.hopsworks_cluster_id} but owner on ${ownerAssignment.hopsworks_cluster_id}`);
            // TODO: Implement cluster migration
          } else {
            healthCheckResults.teamMembershipCorrect = true;
          }
        }
      } else {
        healthCheckResults.teamMembershipCorrect = true;
      }
      
      // Update last login
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
      
      // Log health check summary
      const failedChecks = Object.entries(healthCheckResults)
        .filter(([_, passed]) => !passed)
        .map(([check]) => check);
      
      if (failedChecks.length > 0) {
        console.log(`[Health Check] User ${email} failed checks: ${failedChecks.join(', ')}`);
      } else {
        console.log(`[Health Check] User ${email} passed all health checks`);
      }
    }

    return res.status(200).json({ 
      success: true,
      healthChecks: healthCheckResults
    });
  } catch (error) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
}