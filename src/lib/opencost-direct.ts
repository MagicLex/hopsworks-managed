import * as k8s from '@kubernetes/client-node';
import https from 'https';
import { Writable } from 'stream';

export class OpenCostDirect {
  private kc: k8s.KubeConfig;
  private exec: k8s.Exec;

  constructor(kubeconfigContent: string) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromString(kubeconfigContent);
    this.exec = new k8s.Exec(this.kc);
  }

  async cleanup() {
    // No cleanup needed with in-memory kubeconfig
  }

  async getOpenCostData(window: string = '1h'): Promise<any> {
    try {
      // Use service proxy through the Kubernetes API server
      // This is secure as it uses the kubeconfig authentication
      const path = `/api/v1/namespaces/opencost/services/opencost:9003/proxy/allocation/compute?window=${window}&aggregate=namespace`;
      
      const cluster = this.kc.getCurrentCluster();
      if (!cluster) {
        throw new Error('No current cluster in kubeconfig');
      }

      // Create HTTPS options with auth from kubeconfig
      const opts: https.RequestOptions = {
        method: 'GET',
        headers: {}
      };
      
      await this.kc.applyToHTTPSOptions(opts);
      
      // Parse the server URL
      const serverUrl = new URL(cluster.server);
      opts.hostname = serverUrl.hostname;
      opts.port = serverUrl.port || 443;
      opts.path = path;

      // Make the HTTPS request
      const data = await new Promise<any>((resolve, reject) => {
        const req = https.request(opts, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(new Error(`Invalid JSON response: ${body}`));
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          });
        });
        
        req.on('error', reject);
        req.setTimeout(30000);
        req.end();
      });

      return data;
    } catch (error) {
      console.error('Failed to get OpenCost data:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        response: (error as any).response?.body
      });
      throw error;
    }
  }

  async getOpenCostAllocations(window: string = '1h'): Promise<Map<string, any>> {
    const response = await this.getOpenCostData(window);
    
    if (response.code !== 200 || !response.data?.[0]) {
      throw new Error('Invalid OpenCost response');
    }

    const allocations = new Map<string, any>();
    for (const [namespace, allocation] of Object.entries(response.data[0])) {
      if (namespace === 'kube-system' || namespace === 'kube-public' || 
          namespace === 'kube-node-lease' || namespace === 'opencost') {
        continue;
      }
      allocations.set(namespace, allocation);
    }

    return allocations;
  }

  /**
   * Execute a command in a pod and capture stdout
   */
  private async execInPod(
    namespace: string,
    podName: string,
    command: string[],
    timeoutMs: number = 60000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let finished = false;

      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          reject(new Error(`Command timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          stdout += chunk.toString();
          callback();
        }
      });

      const stderrStream = new Writable({
        write(chunk, encoding, callback) {
          stderr += chunk.toString();
          callback();
        }
      });

      this.exec.exec(
        namespace,
        podName,
        '',
        command,
        stdoutStream,
        stderrStream,
        null,
        false,
        (status) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          if (status.status === 'Success') {
            resolve(stdout);
          } else {
            reject(new Error(`Command failed: ${stderr || 'Unknown error'}`));
          }
        }
      );
    });
  }

  /**
   * Get offline storage (HDFS) for all projects in batch
   * Returns map of project name -> bytes
   */
  async getOfflineStorageBatch(): Promise<Map<string, number>> {
    const storageMap = new Map<string, number>();

    try {
      // Get namenode pod
      const k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
      const podsResponse = await k8sApi.listNamespacedPod('hopsworks');
      const namenodePod = podsResponse.body.items.find(
        pod => pod.metadata?.name?.startsWith('namenode-') &&
               !pod.metadata.name.includes('preset') &&
               !pod.metadata.name.includes('setup') &&
               pod.status?.phase === 'Running'
      );

      if (!namenodePod?.metadata?.name) {
        throw new Error('Namenode pod not found');
      }

      // Single HDFS command to get all project sizes
      const command = [
        '/srv/hops/hadoop/bin/hdfs',
        'dfs',
        '-du',
        '/Projects'
      ];

      const output = await this.execInPod('hopsworks', namenodePod.metadata.name, command);

      // Parse output: each line is "bytes  bytes_with_replication  /Projects/projectname"
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('WARNING') && !line.includes('SLF4J'));

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const bytes = parseInt(parts[0], 10);
          const path = parts[parts.length - 1];
          const projectName = path.split('/').pop();

          // Skip empty or very small baseline projects (Hopsworks metadata only)
          if (projectName && !isNaN(bytes) && bytes > 10000) { // > 10KB
            storageMap.set(projectName, bytes);
          }
        }
      }

      console.log(`Collected offline storage for ${storageMap.size} projects`);
      return storageMap;

    } catch (error) {
      console.error('[BILLING ALERT] Failed to get offline storage - users will NOT be billed for HDFS storage this cycle:', error);
      // Return empty map but this is a billing-impacting failure that needs attention
      return storageMap;
    }
  }

  /**
   * Get online storage (NDB) for all projects in batch
   * Returns map of project name -> bytes
   */
  async getOnlineStorageBatch(mysqlPassword: string): Promise<Map<string, number>> {
    const storageMap = new Map<string, number>();

    try {
      // Get mysqlds pod
      const k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
      const podsResponse = await k8sApi.listNamespacedPod('hopsworks');
      const mysqlPod = podsResponse.body.items.find(
        pod => pod.metadata?.name?.startsWith('mysqlds-') &&
               pod.status?.phase === 'Running'
      );

      if (!mysqlPod?.metadata?.name) {
        throw new Error('MySQL pod not found');
      }

      // Single MySQL query to get all project sizes
      const query = `
        SELECT
          database_name AS project,
          SUM(in_memory_bytes + disk_memory_bytes) AS bytes
        FROM ndbinfo.table_memory_usage
        GROUP BY database_name
        HAVING bytes > 0
      `;

      const command = [
        'bash',
        '-c',
        `MYSQL_PWD='${mysqlPassword}' mysql -u hopsworksroot -N -e "${query.replace(/\n/g, ' ')}"`
      ];

      const output = await this.execInPod('hopsworks', mysqlPod.metadata.name, command);

      // Parse output: each line is "projectname\tbytes"
      const lines = output.split('\n').filter(line =>
        line.trim() &&
        !line.includes('Warning') &&
        !line.includes('Defaulted')
      );

      // System databases to exclude from user billing
      const SYSTEM_DATABASES = new Set(['NULL', 'mysql', 'heartbeat', 'hops', 'hopsworks', 'metastore', 'information_schema', 'performance_schema']);

      for (const line of lines) {
        const parts = line.trim().split(/\t/);
        if (parts.length === 2) {
          const projectName = parts[0];
          const bytes = parseFloat(parts[1]);

          // Skip system databases and very small allocations
          if (projectName && !isNaN(bytes) && !SYSTEM_DATABASES.has(projectName) && bytes > 100000) { // > 100KB
            storageMap.set(projectName, bytes);
          }
        }
      }

      console.log(`Collected online storage for ${storageMap.size} projects`);
      return storageMap;

    } catch (error) {
      console.error('[BILLING ALERT] Failed to get online storage - users will NOT be billed for NDB storage this cycle:', error);
      // Return empty map but this is a billing-impacting failure that needs attention
      return storageMap;
    }
  }
}