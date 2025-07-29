import { KubeConfig, CoreV1Api, Metrics } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';

export interface UserMetrics {
  userId: string;
  projects: ProjectMetrics[];
  totals: ResourceMetrics;
  timestamp: Date;
}

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  namespace: string;
  resources: ResourceMetrics;
  pods: PodMetrics[];
}

export interface PodMetrics {
  name: string;
  type: string; // jupyter, job, serving, etc
  cpu: number; // millicores
  memory: number; // bytes
  storage?: number; // bytes
  networkRx?: number; // bytes/sec
  networkTx?: number; // bytes/sec
}

export interface ResourceMetrics {
  cpuCores: number;
  memoryGB: number;
  storageGB: number;
}

export class KubernetesMetricsClient {
  private k8sApi: CoreV1Api;
  private metricsClient: Metrics;
  private config: KubeConfig;

  constructor(kubeconfigPathOrString: string, isPath: boolean = true) {
    this.config = new KubeConfig();
    
    if (isPath) {
      this.config.loadFromFile(kubeconfigPathOrString);
    } else {
      this.config.loadFromString(kubeconfigPathOrString);
    }
    
    this.k8sApi = this.config.makeApiClient(CoreV1Api);
    this.metricsClient = new Metrics(this.config);
  }

  async getUserMetrics(username: string): Promise<UserMetrics> {
    try {
      // Find all pods belonging to the user
      const podsResponse = await this.k8sApi.listPodForAllNamespaces(
        undefined, // allowWatchBookmarks
        undefined, // _continue
        undefined, // fieldSelector
        `owner=${username}` // labelSelector
      );

      // Group pods by namespace/project
      const projectMap = new Map<string, ProjectMetrics>();

      for (const pod of podsResponse.body.items) {
        const namespace = pod.metadata!.namespace!;
        const projectId = pod.metadata!.labels!['project-id'] || 'unknown';
        
        if (!projectMap.has(namespace)) {
          projectMap.set(namespace, {
            projectId,
            projectName: namespace.replace('-', '_'), // Convert back to Hopsworks format
            namespace,
            resources: { cpuCores: 0, memoryGB: 0, storageGB: 0 },
            pods: []
          });
        }

        const project = projectMap.get(namespace)!;
        
        // Get pod metrics from metrics server
        try {
          const podMetrics = await this.metricsClient.getPodMetrics(namespace, pod.metadata!.name!);
          
          let cpuMillicores = 0;
          let memoryBytes = 0;

          for (const container of podMetrics.containers) {
            cpuMillicores += this.parseCPU(container.usage.cpu);
            memoryBytes += this.parseMemory(container.usage.memory);
          }

          const podType = this.detectPodType(pod.metadata!.name!);
          
          const podMetric: PodMetrics = {
            name: pod.metadata!.name!,
            type: podType,
            cpu: cpuMillicores,
            memory: memoryBytes
          };

          project.pods.push(podMetric);
          project.resources.cpuCores += cpuMillicores / 1000;
          project.resources.memoryGB += memoryBytes / (1024 * 1024 * 1024);

        } catch (metricsError) {
          console.warn(`Failed to get metrics for pod ${pod.metadata!.name!}:`, metricsError);
        }
      }

      // Calculate totals
      const totals: ResourceMetrics = {
        cpuCores: 0,
        memoryGB: 0,
        storageGB: 0
      };

      const projects = Array.from(projectMap.values());
      
      for (const project of projects) {
        totals.cpuCores += project.resources.cpuCores;
        totals.memoryGB += project.resources.memoryGB;
        totals.storageGB += project.resources.storageGB;
      }

      return {
        userId: username,
        projects,
        totals,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Failed to get user metrics:', error);
      throw error;
    }
  }

  async getProjectMetrics(namespace: string): Promise<ProjectMetrics> {
    try {
      const podsResponse = await this.k8sApi.listNamespacedPod(namespace);
      
      const project: ProjectMetrics = {
        projectId: 'unknown',
        projectName: namespace.replace('-', '_'),
        namespace,
        resources: { cpuCores: 0, memoryGB: 0, storageGB: 0 },
        pods: []
      };

      for (const pod of podsResponse.body.items) {
        if (pod.metadata!.labels!['project-id']) {
          project.projectId = pod.metadata!.labels!['project-id'];
        }

        try {
          const podMetrics = await this.metricsClient.getPodMetrics(namespace, pod.metadata!.name!);
          
          let cpuMillicores = 0;
          let memoryBytes = 0;

          for (const container of podMetrics.containers) {
            cpuMillicores += this.parseCPU(container.usage.cpu);
            memoryBytes += this.parseMemory(container.usage.memory);
          }

          const podMetric: PodMetrics = {
            name: pod.metadata!.name!,
            type: this.detectPodType(pod.metadata!.name!),
            cpu: cpuMillicores,
            memory: memoryBytes
          };

          project.pods.push(podMetric);
          project.resources.cpuCores += cpuMillicores / 1000;
          project.resources.memoryGB += memoryBytes / (1024 * 1024 * 1024);

        } catch (metricsError) {
          console.warn(`Failed to get metrics for pod ${pod.metadata!.name!}:`, metricsError);
        }
      }

      return project;

    } catch (error) {
      console.error('Failed to get project metrics:', error);
      throw error;
    }
  }

  private parseCPU(cpu: string): number {
    // CPU can be in format like "100m" (millicores) or "0.1" (cores)
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1));
    } else if (cpu.endsWith('n')) {
      return parseInt(cpu.slice(0, -1)) / 1000000;
    } else {
      return parseFloat(cpu) * 1000;
    }
  }

  private parseMemory(memory: string): number {
    // Memory can be in format like "128Mi", "1Gi", etc
    const units: { [key: string]: number } = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseInt(memory.slice(0, -unit.length)) * multiplier;
      }
    }

    return parseInt(memory);
  }

  private detectPodType(podName: string): string {
    if (podName.includes('jupyter')) return 'notebook';
    if (podName.includes('serving')) return 'model-serving';
    if (podName.includes('job')) return 'job';
    if (podName.includes('spark')) return 'spark';
    if (podName.includes('flink')) return 'flink';
    if (podName.includes('git-command')) return 'git-operation';
    return 'other';
  }
}