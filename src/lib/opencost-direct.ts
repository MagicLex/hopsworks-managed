import * as k8s from '@kubernetes/client-node';
import * as net from 'net';
import * as http from 'http';

export class OpenCostDirect {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private portForward: k8s.PortForward;

  constructor(kubeconfigContent: string) {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromString(kubeconfigContent);
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.portForward = new k8s.PortForward(this.kc);
  }

  async cleanup() {
    // No cleanup needed with in-memory kubeconfig
  }

  async getOpenCostData(window: string = '1h'): Promise<any> {
    try {
      // Get the OpenCost service to find the right port
      const service = await this.k8sApi.readNamespacedService('opencost', 'opencost');
      const targetPort = service.body.spec?.ports?.find(p => p.name === 'http' || p.port === 9003)?.targetPort || 9003;
      
      // Get the OpenCost deployment pods
      const pods = await this.k8sApi.listNamespacedPod(
        'opencost',
        undefined,
        undefined,
        undefined,
        undefined,
        'app.kubernetes.io/name=opencost'
      );

      if (!pods.body.items.length) {
        throw new Error('No OpenCost pods found');
      }

      const podName = pods.body.items[0].metadata!.name!;
      
      // Create a port forward
      const server = net.createServer();
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      
      const localPort = (server.address() as net.AddressInfo).port;
      server.close();
      
      // Set up port forward
      const forward = await this.portForward.portForward(
        'opencost',
        podName,
        [localPort],
        [Number(targetPort)],
        null,
        null
      );
      
      try {
        // Make HTTP request to OpenCost through port forward
        const response = await new Promise<string>((resolve, reject) => {
          const req = http.get(
            `http://127.0.0.1:${localPort}/allocation/compute?window=${window}&aggregate=namespace`,
            (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => resolve(data));
            }
          );
          req.on('error', reject);
          req.setTimeout(10000);
        });
        
        const data = JSON.parse(response);
        return data;
      } finally {
        // Clean up port forward
        if (forward && forward.close) {
          forward.close();
        }
      }
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