#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import { getHopsworksUserByAuth0Id, getUserProjects } from '../src/lib/hopsworks-api';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UserProject {
  user_id: string;
  project_id: number;
  project_name: string;
  namespace: string;
  status: 'active' | 'inactive';
}

async function syncUserProjects() {
  console.log('🔄 Starting user projects sync...\n');

  // Get active cluster
  const { data: cluster, error: clusterError } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('api_url, api_key')
    .eq('status', 'active')
    .single();

  if (clusterError || !cluster) {
    console.error('❌ No active cluster found');
    process.exit(1);
  }

  const credentials = {
    apiUrl: cluster.api_url,
    apiKey: cluster.api_key
  };

  // Get all users with Hopsworks assignments
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      email,
      hopsworks_username,
      account_owner_id,
      user_hopsworks_assignments (
        hopsworks_cluster_id
      )
    `)
    .not('hopsworks_username', 'is', null);

  if (usersError || !users) {
    console.error('❌ Failed to fetch users:', usersError);
    process.exit(1);
  }

  console.log(`Found ${users.length} users with Hopsworks usernames\n`);

  let stats = {
    usersProcessed: 0,
    projectsFound: 0,
    projectsInserted: 0,
    projectsUpdated: 0,
    errors: 0
  };

  for (const user of users) {
    // Skip team members for now - they should get access via project_member_roles
    if (user.account_owner_id) {
      console.log(`⏩ Skipping team member: ${user.email}`);
      continue;
    }

    // Skip users without cluster assignment
    if (!user.user_hopsworks_assignments?.length) {
      console.log(`⏩ No cluster assignment for: ${user.email}`);
      continue;
    }

    try {
      console.log(`\n👤 Processing ${user.email} (${user.hopsworks_username})...`);

      // Get Hopsworks user details
      const hopsworksUser = await getHopsworksUserByAuth0Id(credentials, user.id, user.email);
      
      if (!hopsworksUser) {
        console.log(`  ⚠️  User not found in Hopsworks`);
        stats.errors++;
        continue;
      }

      // Get user's projects
      const projects = await getUserProjects(credentials, user.hopsworks_username, hopsworksUser.id);
      console.log(`  📁 Found ${projects.length} projects`);
      stats.projectsFound += projects.length;

      if (projects.length > 0) {
        // Prepare projects for insertion
        const projectsToUpsert: UserProject[] = projects.map(p => ({
          user_id: user.id,
          project_id: p.id,
          project_name: p.name,
          namespace: `project-${p.name}`,
          status: 'active' as const
        }));

        // Upsert projects (insert or update)
        const { data: upsertData, error: upsertError } = await supabaseAdmin
          .from('user_projects')
          .upsert(projectsToUpsert, { 
            onConflict: 'user_id,project_id',
            ignoreDuplicates: false 
          })
          .select();

        if (upsertError) {
          console.error(`  ❌ Failed to upsert projects:`, upsertError);
          stats.errors++;
        } else {
          const insertedCount = upsertData?.length || 0;
          stats.projectsInserted += insertedCount;
          console.log(`  ✅ Synced ${insertedCount} projects`);
        }
      }

      stats.usersProcessed++;
    } catch (error) {
      console.error(`  ❌ Error processing ${user.email}:`, error);
      stats.errors++;
    }
  }

  // Clean up stale projects (projects that exist in DB but not in Hopsworks)
  console.log('\n🧹 Cleaning up stale projects...');
  
  const { data: allDbProjects } = await supabaseAdmin
    .from('user_projects')
    .select('*');

  if (allDbProjects) {
    // Get all projects from Hopsworks to compare
    const { getAllProjects } = await import('../src/lib/hopsworks-validation');
    const hopsworksProjects = await getAllProjects(credentials);
    const hopsworksProjectIds = new Set(hopsworksProjects.map(p => p.id));

    let staleCount = 0;
    for (const dbProject of allDbProjects) {
      if (!hopsworksProjectIds.has(dbProject.project_id)) {
        console.log(`  🗑️  Removing stale project: ${dbProject.project_name} (ID: ${dbProject.project_id})`);
        await supabaseAdmin
          .from('user_projects')
          .delete()
          .eq('id', dbProject.id);
        staleCount++;
      }
    }
    console.log(`  Removed ${staleCount} stale projects`);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Users processed: ${stats.usersProcessed}`);
  console.log(`Projects found: ${stats.projectsFound}`);
  console.log(`Projects synced: ${stats.projectsInserted}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(50));

  // Verify final state
  const { count } = await supabaseAdmin
    .from('user_projects')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n✅ Total projects in database: ${count}`);
}

// Run the sync
syncUserProjects()
  .then(() => {
    console.log('\n✨ Sync completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  });