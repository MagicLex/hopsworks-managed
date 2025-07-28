-- Function to increment cluster user count
CREATE OR REPLACE FUNCTION increment_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters 
  SET current_users = current_users + 1,
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement cluster user count
CREATE OR REPLACE FUNCTION decrement_cluster_users(cluster_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters 
  SET current_users = GREATEST(current_users - 1, 0),
      updated_at = NOW()
  WHERE id = cluster_id;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate cluster user counts (for maintenance)
CREATE OR REPLACE FUNCTION recalculate_cluster_users()
RETURNS void AS $$
BEGIN
  UPDATE hopsworks_clusters c
  SET current_users = (
    SELECT COUNT(DISTINCT user_id) 
    FROM user_hopsworks_assignments 
    WHERE hopsworks_cluster_id = c.id
  ),
  updated_at = NOW();
END;
$$ LANGUAGE plpgsql;