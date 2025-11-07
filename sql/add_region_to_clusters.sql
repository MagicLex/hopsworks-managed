-- Add region column to hopsworks_clusters table
ALTER TABLE hopsworks_clusters
ADD COLUMN IF NOT EXISTS region TEXT;

-- Add index for faster filtering by region
CREATE INDEX IF NOT EXISTS idx_hopsworks_clusters_region ON hopsworks_clusters(region);
