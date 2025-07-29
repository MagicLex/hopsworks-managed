-- Add kubeconfig column to hopsworks_clusters table
ALTER TABLE hopsworks_clusters 
ADD COLUMN IF NOT EXISTS kubeconfig TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN hopsworks_clusters.kubeconfig IS 'Kubernetes cluster config YAML for accessing metrics directly from K8s cluster';