import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { assignUserToCluster } from '../../../lib/cluster-assignment';
import { getHopsworksUserByUsername, getHopsworksUserByAuth0Id, updateUserProjectLimit, createHopsworksOAuthUser } from '../../../lib/hopsworks-api';

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
    const { corporateRef, teamInviteToken } = req.body;
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

      // Check if user has payment method set up or is prepaid
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, billing_mode')
        .eq('id', userId)
        .single();

      // DO NOT auto-assign cluster for new users - they need to set up payment first
      // Only assign if prepaid corporate user
      if (userData?.billing_mode === 'prepaid') {
        // Prepaid users get immediate access, check if they need cluster assignment
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

            console.log(`Assigned prepaid user ${userId} to cluster`);
          }
        }
      } else {
        console.log(`User ${userId} is not prepaid - cluster assignment requires payment method setup`);
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
        if (existingUser.billing_mode === 'postpaid' && !existingUser.stripe_subscription_id && existingUser.stripe_customer_id) {
          console.log(`[Health Check] User ${email} missing subscription ID in DB - checking Stripe`);
          try {
            // FIRST: Check if subscription already exists in Stripe
            const existingSubscriptions = await stripe.subscriptions.list({
              customer: existingUser.stripe_customer_id,
              limit: 10,
              status: 'all'
            });
            
            // Find active or trialing subscription
            const activeSubscription = existingSubscriptions.data.find(
              sub => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
            );
            
            if (activeSubscription) {
              // Subscription exists in Stripe but not in our DB - sync it
              console.log(`[Health Check] Found existing subscription ${activeSubscription.id} in Stripe - syncing to DB`);
              await supabaseAdmin
                .from('users')
                .update({
                  stripe_subscription_id: activeSubscription.id,
                  stripe_subscription_status: activeSubscription.status
                })
                .eq('id', userId);
            } else {
              // No active subscription found - check if we should create one
              console.log(`[Health Check] No active subscription found for ${email} - NOT auto-creating`);
              await logHealthCheckFailure(userId, email, 'missing_subscription', 
                'User has no active subscription - requires manual setup', 
                { customer_id: existingUser.stripe_customer_id });
              // DO NOT AUTO-CREATE SUBSCRIPTIONS - this should be an intentional action
            }
          } catch (error) {
            await logHealthCheckFailure(userId, email, 'subscription_check', 
              'Failed to check/sync subscription', error);
            console.error(`[Health Check] Failed to check subscription for ${email}:`, error);
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
        // Try to assign cluster - ONLY for team members or prepaid users
        // DO NOT assign based on stripe_customer_id - that doesn't mean they have payment!
        const shouldAssign = isTeamMember || 
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
        let hopsworksUserId = assignment.hopsworks_user_id || existingUser.hopsworks_user_id;
        
        // Try to get user by username first
        if (hopsworksUsername) {
          try {
            hopsworksUser = await getHopsworksUserByUsername(credentials, hopsworksUsername);
            if (hopsworksUser) {
              healthCheckResults.hopsworksUserExists = true;
              hopsworksUserId = hopsworksUser.id;
              
              // Update database with Hopsworks user ID if missing
              if (!assignment.hopsworks_user_id || !existingUser.hopsworks_user_id) {
                console.log(`[Health Check] Found Hopsworks user ID ${hopsworksUserId} for ${hopsworksUsername}`);
                
                await supabaseAdmin
                  .from('users')
                  .update({ hopsworks_user_id: hopsworksUserId })
                  .eq('id', userId);
                
                await supabaseAdmin
                  .from('user_hopsworks_assignments')
                  .update({ hopsworks_user_id: hopsworksUserId })
                  .eq('user_id', userId);
              }
            }
          } catch (error) {
            console.error(`[Health Check] Failed to fetch Hopsworks user ${hopsworksUsername}:`, error);
          }
        }
        
        // If still no user, try by email
        if (!hopsworksUser) {
          try {
            hopsworksUser = await getHopsworksUserByAuth0Id(credentials, userId, existingUser.email);
            if (hopsworksUser) {
              healthCheckResults.hopsworksUserExists = true;
              hopsworksUserId = hopsworksUser.id;
              hopsworksUsername = hopsworksUser.username;
              
              console.log(`[Health Check] Found Hopsworks user by email: ${hopsworksUsername} (ID: ${hopsworksUserId})`);
              
              // Update database with found user info
              await supabaseAdmin
                .from('users')
                .update({ 
                  hopsworks_user_id: hopsworksUserId,
                  hopsworks_username: hopsworksUsername
                })
                .eq('id', userId);
              
              await supabaseAdmin
                .from('user_hopsworks_assignments')
                .update({ 
                  hopsworks_user_id: hopsworksUserId,
                  hopsworks_username: hopsworksUsername
                })
                .eq('user_id', userId);
            }
          } catch (error) {
            console.error(`[Health Check] Failed to fetch Hopsworks user by email:`, error);
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
        if (hopsworksUser && hopsworksUserId) {
          const expectedMaxProjects = isTeamMember ? 0 : 
                                    (existingUser.stripe_customer_id || existingUser.billing_mode === 'prepaid') ? 5 : 0;
          
          const currentMaxProjects = hopsworksUser.maxNumProjects ?? 0;
          
          if (currentMaxProjects !== expectedMaxProjects) {
            console.log(`[Health Check] User ${email} has incorrect maxNumProjects (${currentMaxProjects} vs expected ${expectedMaxProjects}) - fixing`);
            try {
              await updateUserProjectLimit(credentials, hopsworksUserId, expectedMaxProjects);
              healthCheckResults.maxNumProjectsCorrect = true;
              console.log(`[Health Check] Successfully updated maxNumProjects to ${expectedMaxProjects} for ${email}`);
            } catch (error) {
              await logHealthCheckFailure(userId, email, 'maxnumprojects_update', 
                `Failed to update maxNumProjects from ${currentMaxProjects} to ${expectedMaxProjects}`, error);
              console.error(`[Health Check] Failed to update maxNumProjects for ${email}:`, error);
            }
          } else {
            healthCheckResults.maxNumProjectsCorrect = true;
            console.log(`[Health Check] User ${email} already has correct maxNumProjects: ${currentMaxProjects}`);
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
        
        // HEALTH CHECK 6: Log team member project access status (no auto-repair)
        const teamMemberUsername = assignment?.hopsworks_username || existingUser.hopsworks_username;
        if (assignment?.hopsworks_clusters && teamMemberUsername) {
          try {
            const { getUserProjects } = await import('../../../lib/hopsworks-team');
            const credentials = {
              apiUrl: assignment.hopsworks_clusters.api_url,
              apiKey: assignment.hopsworks_clusters.api_key
            };
            
            // Get team member's current projects
            const memberProjects = await getUserProjects(credentials, teamMemberUsername);
            
            // Get owner's username
            const { data: owner } = await supabaseAdmin
              .from('users')
              .select('hopsworks_username')
              .eq('id', existingUser.account_owner_id)
              .single();
            
            if (owner?.hopsworks_username) {
              // Get owner's projects
              const ownerProjects = await getUserProjects(credentials, owner.hopsworks_username);
              
              // Just log the status - don't auto-add
              const memberProjectNames = new Set(memberProjects.map(p => p.name));
              const accessibleProjects = ownerProjects.filter(p => memberProjectNames.has(p.name));
              const missingProjects = ownerProjects.filter(p => !memberProjectNames.has(p.name));
              
              if (accessibleProjects.length > 0) {
                console.log(`[Health Check] Team member ${email} has access to ${accessibleProjects.length}/${ownerProjects.length} owner projects`);
              }
              
              if (missingProjects.length > 0) {
                console.log(`[Health Check] Team member ${email} not in projects: ${missingProjects.map(p => p.name).join(', ')}`);
                // Don't auto-add - owner controls project membership
              }
            }
          } catch (error) {
            console.error(`[Health Check] Failed to check team member project access:`, error);
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

    // Check if user needs to set up payment (only for account owners)
    const needsPayment = !existingUser?.account_owner_id && // Not a team member
                        !existingUser?.stripe_customer_id && // No Stripe customer
                        existingUser?.billing_mode !== 'prepaid'; // Not prepaid corporate

    return res.status(200).json({ 
      success: true,
      healthChecks: healthCheckResults,
      needsPayment,
      isTeamMember: !!existingUser?.account_owner_id,
      hasBilling: !!existingUser?.stripe_customer_id || existingUser?.billing_mode === 'prepaid'
    });
  } catch (error) {
    console.error('User sync error:', error);
    return res.status(500).json({ error: 'Failed to sync user' });
  }
}