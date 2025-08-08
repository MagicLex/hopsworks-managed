import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export class OpenCostDirect {
  private kubeconfigPath: string;

  constructor(kubeconfigContent: string) {
    // Write kubeconfig to temp file
    this.kubeconfigPath = join(tmpdir(), `kubeconfig-${Date.now()}.yml`);
    writeFileSync(this.kubeconfigPath, kubeconfigContent, { mode: 0o600 });
  }

  async cleanup() {
    try {
      unlinkSync(this.kubeconfigPath);
    } catch {}
  }

  async getOpenCostData(window: string = '1h'): Promise<any> {
    try {
      // Use kubectl exec to run curl inside the OpenCost pod
      const { stdout } = await execAsync(
        `kubectl --kubeconfig="${this.kubeconfigPath}" -n opencost exec deploy/opencost -- curl -s "http://localhost:9003/allocation/compute?window=${window}&aggregate=namespace"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );

      const data = JSON.parse(stdout);
      return data;
    } catch (error) {
      console.error('Failed to get OpenCost data:', error);
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