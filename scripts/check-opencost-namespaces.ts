#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import { OpenCostDirect } from '../src/lib/opencost-direct';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

interface NamespaceInfo {
  name: string;
  totalCost: number;
  cpuCoreHours: number;
  ramByteHours: number;
  gpuHours: number;
  cpuEfficiency: number;
  ramEfficiency: number;
  matchesPattern: boolean;
  patternType: string;
}

async function checkOpenCostNamespaces() {
  console.log('🔍 Checking OpenCost namespaces...\n');

  // Get the active Hopsworks cluster
  const { data: cluster, error: clusterError } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('*')
    .eq('status', 'active')
    .single();

  if (clusterError || !cluster) {
    console.error('❌ Failed to fetch active cluster:', clusterError?.message || 'No active cluster');
    process.exit(1);
  }

  console.log(`📡 Using cluster: ${cluster.name} (${cluster.api_url})\n`);

  // Initialize OpenCost direct client
  const opencost = new OpenCostDirect(cluster.kubeconfig);

  try {
    // Get allocations from OpenCost (24h window for better visibility)
    console.log('⏳ Fetching OpenCost data...');
    const allocations = await opencost.getOpenCostAllocations('24h');

    console.log(`\n✅ Found ${allocations.size} namespaces with costs\n`);

    // Process and categorize namespaces
    const namespaces: NamespaceInfo[] = [];
    const patterns = {
      project: /^project-\d+$/,        // project-123
      user: /^[a-zA-Z0-9_-]+$/,        // user project names
      system: /^(kube-|default|opencost|hopsworks|ingress-|cert-)/,
      admin: /admin/i
    };

    for (const [namespace, allocation] of Array.from(allocations.entries())) {
      let patternType = 'unknown';
      let matchesPattern = false;

      if (patterns.project.test(namespace)) {
        patternType = 'project-XXX (expected pattern)';
        matchesPattern = true;
      } else if (patterns.system.test(namespace)) {
        patternType = 'system namespace';
        matchesPattern = true;
      } else if (patterns.admin.test(namespace)) {
        patternType = 'admin namespace';
        matchesPattern = true;
      } else if (patterns.user.test(namespace)) {
        patternType = 'user project';
        matchesPattern = false; // Doesn't match expected project-XXX pattern
      }

      namespaces.push({
        name: namespace,
        totalCost: allocation.totalCost || 0,
        cpuCoreHours: allocation.cpuCoreHours || 0,
        ramByteHours: allocation.ramByteHours || 0,
        gpuHours: allocation.gpuHours || 0,
        cpuEfficiency: allocation.cpuEfficiency || 0,
        ramEfficiency: allocation.ramEfficiency || 0,
        matchesPattern,
        patternType
      });
    }

    // Sort by cost (descending)
    namespaces.sort((a, b) => b.totalCost - a.totalCost);

    // Display results
    console.log('📊 NAMESPACE COST ANALYSIS (24h window)');
    console.log('=' + '='.repeat(80));
    
    let totalCost = 0;
    let projectPatternCount = 0;
    let userProjectCount = 0;
    let systemCount = 0;

    namespaces.forEach((ns, index) => {
      totalCost += ns.totalCost;
      
      if (ns.patternType.includes('project-XXX')) {
        projectPatternCount++;
      } else if (ns.patternType === 'user project') {
        userProjectCount++;
      } else if (ns.patternType === 'system namespace') {
        systemCount++;
      }

      const ramGB = ns.ramByteHours / (1024 * 1024 * 1024);
      const patternIcon = ns.matchesPattern ? '✅' : '⚠️';
      
      console.log(`${index + 1}. ${patternIcon} ${ns.name}`);
      console.log(`   Cost: $${ns.totalCost.toFixed(4)} | CPU: ${ns.cpuCoreHours.toFixed(2)}h | RAM: ${ramGB.toFixed(2)}GB-h | GPU: ${ns.gpuHours.toFixed(2)}h`);
      console.log(`   Efficiency: CPU ${(ns.cpuEfficiency * 100).toFixed(1)}% | RAM ${(ns.ramEfficiency * 100).toFixed(1)}%`);
      console.log(`   Pattern: ${ns.patternType}`);
      console.log('');
    });

    // Summary
    console.log('📈 SUMMARY');
    console.log('-'.repeat(50));
    console.log(`Total namespaces: ${namespaces.length}`);
    console.log(`Total cost (24h): $${totalCost.toFixed(4)}`);
    console.log(`  • project-XXX pattern: ${projectPatternCount} namespaces`);
    console.log(`  • User projects: ${userProjectCount} namespaces`);
    console.log(`  • System namespaces: ${systemCount} namespaces`);
    console.log(`  • Other: ${namespaces.length - projectPatternCount - userProjectCount - systemCount} namespaces`);

    // Highlight non-conforming user projects
    const nonConformingProjects = namespaces.filter(ns => 
      ns.patternType === 'user project' && ns.totalCost > 0.001
    );

    if (nonConformingProjects.length > 0) {
      console.log('\n⚠️  NON-CONFORMING USER PROJECTS (not project-XXX pattern):');
      console.log('-'.repeat(60));
      nonConformingProjects.forEach(ns => {
        console.log(`• ${ns.name} - $${ns.totalCost.toFixed(4)}`);
      });
    }

  } catch (error) {
    console.error('❌ Error fetching OpenCost data:', error);
    process.exit(1);
  } finally {
    await opencost.cleanup();
  }
}

// Run the script
if (require.main === module) {
  checkOpenCostNamespaces()
    .then(() => {
      console.log('\n✅ Namespace check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}