import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { assignUserToCluster } from '../../../lib/cluster-assignment';
import { getHopsworksUserById, getHopsworksUserByEmail, updateUserProjectLimit, createHopsworksOAuthUser, updateHopsworksUserStatus } from '../../../lib/hopsworks-api';
import { HOPSWORKS_STATUS } from '../../../lib/user-status';
import { handleApiError } from '../../../lib/error-handler';

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
    const { corporateRef, promoCode, teamInviteToken, termsAccepted, marketingConsent } = req.body;
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

    // Block deleted users from logging in
    if (existingUser?.deleted_at) {
      console.log(`[Auth] Blocked login attempt from deleted user ${email}`);
      return res.status(403).json({
        error: 'Account has been deleted',
        deletedAt: existingUser.deleted_at
      });
    }

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

      // Handle promotional code registration
      let normalizedPromoCode = null;
      if (promoCode && !billingMode) { // Only if not already set by corporate
        try {
          // Validate promotional code
          const validateResponse = await fetch(
            `${process.env.AUTH0_BASE_URL || 'http://localhost:3000'}/api/auth/validate-promo`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ promoCode })
            }
          );

          const validationResult = await validateResponse.json();

          if (validationResult.valid) {
            billingMode = 'prepaid';
            normalizedPromoCode = validationResult.promoCode; // Store in promo_code column
            registrationSource = validationResult.promoCode; // Use promo code as source to track conversions
            console.log(`Promotional registration validated for ${email} with code ${validationResult.promoCode}`);
          } else {
            console.log(`Promotional code validation failed for ${email}: ${validationResult.error}`);
          }
        } catch (error) {
          console.error('Promo code validation error:', error);
        }
      }

      // Names are now handled by Auth0 Action with prompt
      
      // Create new user
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email,
          name: name || null, // Keep for backward compatibility
          registration_source: registrationSource,
          registration_ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
          status: 'active',
          billing_mode: billingMode || 'free', // Default to free tier for non-corporate users
          promo_code: normalizedPromoCode, // Store promo code in dedicated column
          terms_accepted_at: termsAccepted ? new Date().toISOString() : null,
          marketing_consent: marketingConsent || false,
          metadata
        });

      if (userError && userError.code !== '23505') { // Ignore duplicate key errors
        throw userError;
      }

      // Fire marketing webhook for genuinely new users (not duplicates)
      if (!userError && process.env.WINDMILL_WEBHOOK_URL) {
        fetch(process.env.WINDMILL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.WINDMILL_API_TOKEN && {
              'Authorization': `Bearer ${process.env.WINDMILL_API_TOKEN}`
            })
          },
          body: JSON.stringify({
            event: 'user.registered',
            userId,
            email,
            name: name || null,
            plan: billingMode || 'free',
            source: registrationSource,
            marketingConsent: marketingConsent || false,
            ip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || null,
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.error('[Marketing] Webhook failed:', err.message));
      }

      // Check if user has payment method set up or is prepaid
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, billing_mode')
        .eq('id', userId)
        .single();

      // Auto-assign cluster for prepaid and free tier users
      // Postpaid users need to set up payment first
      if (userData?.billing_mode === 'prepaid' || userData?.billing_mode === 'free') {
        // Prepaid/free users get immediate access - use assignUserToCluster for full setup
        // This creates the Hopsworks user with correct maxNumProjects (5 for prepaid, 1 for free)
        const clusterResult = await assignUserToCluster(supabaseAdmin, userId);
        if (clusterResult.success) {
          console.log(`Assigned ${userData.billing_mode} user ${userId} to cluster ${clusterResult.clusterId}`);
        } else {
          console.error(`Failed to assign ${userData.billing_mode} user ${userId}: ${clusterResult.error}`);
        }
      } else {
        console.log(`User ${userId} is postpaid - cluster assignment requires payment method setup`);
      }
    } else {
      healthCheckResults.userExists = true;

      // Update terms if user accepted them but DB doesn't have them yet
      if (termsAccepted && !existingUser.terms_accepted_at) {
        console.log(`[Sync] Updating terms acceptance for existing user ${email}`);
        await supabaseAdmin
          .from('users')
          .update({
            terms_accepted_at: new Date().toISOString(),
            marketing_consent: marketingConsent || existingUser.marketing_consent || false
          })
          .eq('id', userId);
      }

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

              // Update local reference so later health checks see the new value
              existingUser.stripe_subscription_id = activeSubscription.id;
            } else {
              // No active subscription found - check if customer has payment method
              console.log(`[Health Check] No active subscription found for ${email} - checking for payment method`);

              const paymentMethods = await stripe.paymentMethods.list({
                customer: existingUser.stripe_customer_id,
                limit: 1
              });

              if (paymentMethods.data.length > 0) {
                // Has payment method - create subscription
                console.log(`[Health Check] Customer has payment method - creating subscription`);
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
                      user_id: userId,
                      email: email
                    }
                  });

                  await supabaseAdmin
                    .from('users')
                    .update({
                      stripe_subscription_id: subscription.id,
                      stripe_subscription_status: subscription.status
                    })
                    .eq('id', userId);

                  // Update local reference so later health checks see the new value
                  existingUser.stripe_subscription_id = subscription.id;
                  console.log(`[Health Check] Created subscription ${subscription.id} for ${email}`);
                } else {
                  console.log(`[Health Check] No active stripe products found - cannot create subscription`);
                }
              } else {
                // No payment method - cannot create subscription
                console.log(`[Health Check] No payment method found - cannot create subscription`);
                await logHealthCheckFailure(userId, email, 'missing_subscription',
                  'User has no active subscription and no payment method',
                  { customer_id: existingUser.stripe_customer_id });
              }
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
      let { data: assignment } = await supabaseAdmin
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
        // Try to assign cluster - for team members, prepaid, or free users
        // DO NOT assign based on stripe_customer_id - that doesn't mean they have payment!
        const shouldAssign = isTeamMember ||
                           existingUser.billing_mode === 'prepaid' ||
                           existingUser.billing_mode === 'free';
        
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
              assignment = newAssignment;
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
        
        // Try to get user by ID first if we have it
        if (assignment.hopsworks_user_id || existingUser.hopsworks_user_id) {
          const userId = assignment.hopsworks_user_id || existingUser.hopsworks_user_id;
          try {
            hopsworksUser = await getHopsworksUserById(credentials, userId);
            if (hopsworksUser) {
              healthCheckResults.hopsworksUserExists = true;
              hopsworksUserId = hopsworksUser.id;
              hopsworksUsername = hopsworksUser.username;

              // Sync hopsworks_user_id and username if either is missing from either table
              const needsUserIdSync = !assignment.hopsworks_user_id || !existingUser.hopsworks_user_id;
              const needsUsernameSync = !assignment.hopsworks_username || !existingUser.hopsworks_username;

              if (needsUserIdSync || needsUsernameSync) {
                console.log(`[Health Check] Syncing Hopsworks data for user ID ${hopsworksUserId}: needsUserIdSync=${needsUserIdSync}, needsUsernameSync=${needsUsernameSync}`);

                const { error: userUpdateError } = await supabaseAdmin
                  .from('users')
                  .update({
                    hopsworks_user_id: hopsworksUserId,
                    hopsworks_username: hopsworksUsername
                  })
                  .eq('id', existingUser.id);

                if (userUpdateError) {
                  console.error(`[Health Check] Failed to update users table:`, userUpdateError);
                }

                const { error: assignmentUpdateError } = await supabaseAdmin
                  .from('user_hopsworks_assignments')
                  .update({
                    hopsworks_user_id: hopsworksUserId,
                    hopsworks_username: hopsworksUsername
                  })
                  .eq('user_id', existingUser.id);

                if (assignmentUpdateError) {
                  console.error(`[Health Check] Failed to update user_hopsworks_assignments table:`, assignmentUpdateError);
                }
              }
            }
          } catch (error) {
            console.error(`[Health Check] Failed to fetch Hopsworks user ${userId}:`, error);
          }
        }
        
        // If still no user, try by email
        if (!hopsworksUser) {
          try {
            hopsworksUser = await getHopsworksUserByEmail(credentials, existingUser.email);
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
            // Get names from Auth0 token (guaranteed by Auth0 Action)
            const firstName = (session.user as any).given_name || email.split('@')[0];
            const lastName = (session.user as any).family_name || '.';
            const expectedMaxProjects = isTeamMember ? 0 :
                                      existingUser.billing_mode === 'free' ? 1 :
                                      (existingUser.stripe_subscription_id || existingUser.billing_mode === 'prepaid') ? 5 : 0;

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

        // HEALTH CHECK 4: Verify Hopsworks account is activated (if Supabase is active AND billing is valid)
        if (hopsworksUser && hopsworksUserId && existingUser.status === 'active') {
          const hasBilling = isTeamMember || existingUser.stripe_subscription_id || existingUser.billing_mode === 'prepaid' || existingUser.billing_mode === 'free';
          const hopsworksStatus = hopsworksUser.status;

          if (hasBilling && hopsworksStatus !== HOPSWORKS_STATUS.ACTIVATED_ACCOUNT) {
            console.log(`[Health Check] User ${email} has deactivated Hopsworks account (status ${hopsworksStatus}) but valid billing - reactivating`);
            try {
              await updateHopsworksUserStatus(credentials, hopsworksUserId, HOPSWORKS_STATUS.ACTIVATED_ACCOUNT);
              console.log(`[Health Check] Successfully reactivated Hopsworks account for ${email}`);
            } catch (error) {
              await logHealthCheckFailure(userId, email, 'hopsworks_reactivation',
                `Failed to reactivate Hopsworks account (status ${hopsworksStatus})`, error);
              console.error(`[Health Check] Failed to reactivate Hopsworks account for ${email}:`, error);
            }
          }
        }

        // HEALTH CHECK 5: Verify maxNumProjects is correct
        if (hopsworksUser && hopsworksUserId) {
          const expectedMaxProjects = isTeamMember ? 0 :
                                    existingUser.billing_mode === 'free' ? 1 :
                                    (existingUser.stripe_subscription_id || existingUser.billing_mode === 'prepaid') ? 5 : 0;
          
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
          
          // Sync username if needed - update BOTH tables
          if (hopsworksUsername && hopsworksUsername !== existingUser.hopsworks_username) {
            const { error: userError } = await supabaseAdmin
              .from('users')
              .update({ hopsworks_username: hopsworksUsername })
              .eq('id', userId);

            if (userError) {
              console.error(`[Health Check] Failed to sync username to users:`, userError);
            }

            const { error: assignmentError } = await supabaseAdmin
              .from('user_hopsworks_assignments')
              .update({ hopsworks_username: hopsworksUsername })
              .eq('user_id', userId);

            if (assignmentError) {
              console.error(`[Health Check] Failed to sync username to assignments:`, assignmentError);
            }

            healthCheckResults.usernamesSynced = true;
          } else if (hopsworksUsername) {
            healthCheckResults.usernamesSynced = true;
          }
        }
      }
      
      // HEALTH CHECK 6: Verify team membership consistency
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
        
        // HEALTH CHECK 7: Log team member project access status (no auto-repair)
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
        
      // NOTE: Main Hopsworks sync is handled above in Health Check 3.
      // This secondary block is now redundant and has been removed to avoid duplication.
      
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

    // Get current user state for payment check (important for new users)
    // CRITICAL: Sync user projects for billing accuracy
    // This ensures we have accurate project data for billing calculations
    let projectSyncResult: any = { success: false, projectsFound: 0, projectsSynced: 0 };
    try {
      const { syncUserProjects } = await import('../../../lib/project-sync');
      projectSyncResult = await syncUserProjects(userId);
      
      if (projectSyncResult.success) {
        console.log(`[Project Sync] Synced ${projectSyncResult.projectsSynced} of ${projectSyncResult.projectsFound} projects for ${email}`);
      } else if (projectSyncResult.error) {
        console.error(`[Project Sync] Failed for ${email}: ${projectSyncResult.error}`);
      }
    } catch (error) {
      console.error(`[Project Sync] Error for ${email}:`, error);
    }
    
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('account_owner_id, stripe_customer_id, billing_mode, status')
      .eq('id', userId)
      .single();

    // Check if user needs to set up payment (only for postpaid account owners)
    // Free and prepaid users don't need payment setup
    const needsPayment = !currentUser?.account_owner_id && // Not a team member
                        !currentUser?.stripe_customer_id && // No Stripe customer
                        currentUser?.billing_mode === 'postpaid'; // Only postpaid needs payment

    // Check if account is suspended (postpaid user who removed payment method)
    const isSuspended = currentUser?.status === 'suspended';

    // Check if any critical health checks failed
    const hasWarnings = healthCheckResults.userExists && (
      !healthCheckResults.billingEnabled ||
      !healthCheckResults.clusterAssigned ||
      !healthCheckResults.hopsworksUserExists
    );

    return res.status(200).json({
      success: true,
      hasWarnings,
      healthChecks: healthCheckResults,
      needsPayment,
      isSuspended,
      isTeamMember: !!existingUser?.account_owner_id,
      hasBilling: !!existingUser?.stripe_customer_id || existingUser?.billing_mode === 'prepaid' || existingUser?.billing_mode === 'free',
      projectSync: projectSyncResult
    });
  } catch (error) {
    return handleApiError(error, res, 'POST /api/auth/sync-user');
  }
}