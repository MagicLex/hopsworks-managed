import * as k8s from '@kubernetes/client-node';
import { Writable } from 'stream';

export class OpenCostDirect {
  private k8sApi: k8s.CoreV1Api;
  private exec: k8s.Exec;

  constructor(kubeconfigContent: string) {
    const kc = new k8s.KubeConfig();
    kc.loadFromString(kubeconfigContent);
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.exec = new k8s.Exec(kc);
  }

  async cleanup() {
    // No cleanup needed with in-memory kubeconfig
  }

  async getOpenCostData(window: string = '1h'): Promise<any> {
    try {
      // Get the OpenCost deployment pods
      const pods = await this.k8sApi.listNamespacedPod(
        'opencost',
        undefined,
        undefined,
        undefined,
        undefined,
        'app=opencost'
      );

      if (!pods.body.items.length) {
        throw new Error('No OpenCost pods found');
      }

      const podName = pods.body.items[0].metadata!.name!;
      
      // Execute curl command inside the pod
      const command = [
        'curl',
        '-s',
        `http://localhost:9003/allocation/compute?window=${window}&aggregate=namespace`
      ];

      let output = '';
      const stdout = new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        }
      });

      await this.exec.exec(
        'opencost',
        podName,
        'opencost',
        command,
        stdout,
        null,
        null,
        false
      );

      const data = JSON.parse(output);
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