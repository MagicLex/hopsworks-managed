import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface IntegrityIssue {
  check: string;
  severity: 'critical' | 'high' | 'medium';
  count: number;
  affected: string[];
}

async function sendSlackAlert(issues: IntegrityIssue[]) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;

  const issueList = issues
    .map(i => `• *${i.severity.toUpperCase()}* \`${i.check}\`: ${i.count} affected\n  ${i.affected.slice(0, 3).join(', ')}${i.affected.length > 3 ? '...' : ''}`)
    .join('\n');

  const text = `:warning: *Data Integrity Alert*\n${criticalCount} critical, ${highCount} high severity issues found\n\n${issueList}`;

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).catch(err => console.error('[Slack] Failed to send alert:', err));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const issues: IntegrityIssue[] = [];

  // CHECK 1: hopsworks_user_id desync between users and assignments
  const { data: hwIdDesync } = await supabaseAdmin.rpc('check_hopsworks_id_desync');

  if (!hwIdDesync) {
    // Fallback to direct query if RPC doesn't exist
    const { data: desyncUsers } = await supabaseAdmin
      .from('users')
      .select(`
        email,
        hopsworks_user_id,
        user_hopsworks_assignments!left(hopsworks_user_id)
      `)
      .not('hopsworks_user_id', 'is', null)
      .is('deleted_at', null);

    const desynced = desyncUsers?.filter(u => {
      const assignment = (u as any).user_hopsworks_assignments?.[0];
      return !assignment?.hopsworks_user_id || assignment.hopsworks_user_id !== u.hopsworks_user_id;
    }) || [];

    if (desynced.length > 0) {
      issues.push({
        check: 'hopsworks_user_id_desync',
        severity: 'critical',
        count: desynced.length,
        affected: desynced.map(u => u.email)
      });
    }
  }

  // CHECK 2: Users with assignment but no hopsworks_user_id anywhere
  const { data: missingHwId } = await supabaseAdmin
    .from('user_hopsworks_assignments')
    .select(`
      user_id,
      users!inner(email, hopsworks_user_id)
    `)
    .is('hopsworks_user_id', null);

  const missingBoth = missingHwId?.filter(a => !(a as any).users?.hopsworks_user_id) || [];
  if (missingBoth.length > 0) {
    issues.push({
      check: 'assignment_without_hopsworks_user',
      severity: 'high',
      count: missingBoth.length,
      affected: missingBoth.map(a => (a as any).users?.email)
    });
  }

  // CHECK 3: Cluster user count drift
  const { data: clusters } = await supabaseAdmin
    .from('hopsworks_clusters')
    .select('id, name, current_users');

  for (const cluster of clusters || []) {
    const { count } = await supabaseAdmin
      .from('user_hopsworks_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('hopsworks_cluster_id', cluster.id);

    if (count !== null && count !== cluster.current_users) {
      issues.push({
        check: 'cluster_user_count_drift',
        severity: 'medium',
        count: Math.abs(count - cluster.current_users),
        affected: [`${cluster.name}: current_users=${cluster.current_users}, actual=${count}`]
      });
    }
  }

  // CHECK 4: Orphan project_member_roles (member_id not in users)
  const { data: orphanRoles } = await supabaseAdmin
    .from('project_member_roles')
    .select(`
      id,
      member_id,
      users!project_member_roles_member_id_fkey(id)
    `);

  const orphaned = orphanRoles?.filter(r => !(r as any).users) || [];
  if (orphaned.length > 0) {
    issues.push({
      check: 'orphan_project_member_roles',
      severity: 'medium',
      count: orphaned.length,
      affected: orphaned.map(r => r.member_id)
    });
  }

  // CHECK 5: Unresolved health check failures older than 7 days
  const { data: oldFailures, count: oldFailureCount } = await supabaseAdmin
    .from('health_check_failures')
    .select('email, check_type', { count: 'exact' })
    .is('resolved_at', null)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (oldFailureCount && oldFailureCount > 0) {
    issues.push({
      check: 'stale_health_check_failures',
      severity: 'medium',
      count: oldFailureCount,
      affected: (oldFailures || []).slice(0, 10).map(f => `${f.email}: ${f.check_type}`)
    });
  }

  // Log critical/high issues to health_check_failures and send Slack alert
  const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');

  if (criticalIssues.length > 0) {
    await supabaseAdmin
      .from('health_check_failures')
      .insert({
        user_id: 'system',
        email: 'data-integrity-check',
        check_type: 'data_integrity_alert',
        error_message: `Found ${criticalIssues.length} critical/high integrity issues`,
        details: { issues: criticalIssues, timestamp: new Date().toISOString() }
      });

    // Send Slack alert
    await sendSlackAlert(criticalIssues);

    console.error('[Data Integrity] ALERT:', JSON.stringify(criticalIssues, null, 2));
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    issues
  };

  console.log('[Data Integrity] Check completed:', JSON.stringify(summary, null, 2));

  return res.status(200).json(summary);
}
