import * as k8s from '@kubernetes/client-node';
import https from 'https';

export class OpenCostDirect {
  private kc: k8s.KubeConfig;
  
  constructor(kubeconfigContent: string) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromString(kubeconfigContent);
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
}