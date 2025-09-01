#!/usr/bin/env ts-node
// Script to manually update a user's project limit
// Usage: npx ts-node scripts/update-user-projects.ts <user-email> <project-limit>

import { createClient } from '@supabase/supabase-js';
import { updateUserProjectLimit } from '../src/lib/hopsworks-api';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateUserProjects(email: string, limit: number) {
  try {
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, hopsworks_user_id, hopsworks_username')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('User not found:', email);
      return;
    }

    console.log('Found user:', {
      email: user.email,
      hopsworks_user_id: user.hopsworks_user_id,
      hopsworks_username: user.hopsworks_username
    });

    if (!user.hopsworks_user_id) {
      console.error('User does not have a Hopsworks user ID. They need to be assigned to a cluster first.');
      return;
    }

    // Get cluster assignment
    const { data: assignment } = await supabase
      .from('user_hopsworks_assignments')
      .select('hopsworks_cluster_id')
      .eq('user_id', user.id)
      .single();

    if (!assignment) {
      console.error('User is not assigned to a cluster');
      return;
    }

    // Get cluster details
    const { data: cluster } = await supabase
      .from('hopsworks_clusters')
      .select('api_url, api_key, name')
      .eq('id', assignment.hopsworks_cluster_id)
      .single();

    if (!cluster) {
      console.error('Cluster not found');
      return;
    }

    console.log(`Updating user's project limit to ${limit} on cluster: ${cluster.name}`);

    // Update Hopsworks user
    await updateUserProjectLimit(
      { apiUrl: cluster.api_url, apiKey: cluster.api_key },
      user.hopsworks_user_id,
      limit
    );

    console.log(`✅ Successfully updated ${email} to have ${limit} max projects`);
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: npx ts-node scripts/update-user-projects.ts <user-email> <project-limit>');
  console.log('Example: npx ts-node scripts/update-user-projects.ts user@example.com 5');
  process.exit(1);
}

const [email, limitStr] = args;
const limit = parseInt(limitStr, 10);

if (isNaN(limit) || limit < 0) {
  console.error('Project limit must be a non-negative number');
  process.exit(1);
}

updateUserProjects(email, limit)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });