-- Seed instance pricing data
-- Based on hopsworks-cloud pricing model, simplified for common instance types

-- Clear existing data
TRUNCATE TABLE instance_pricing;

-- Insert AWS instance types and their pricing
INSERT INTO instance_pricing (instance_type, provider, hourly_rate, cpu_count, memory_gb) VALUES
-- T3 instances (burstable)
('t3.medium', 'aws', 0.10, 2, 4),
('t3.large', 'aws', 0.19, 2, 8),
('t3.xlarge', 'aws', 0.38, 4, 16),
('t3.2xlarge', 'aws', 0.76, 8, 32),

-- M5 instances (general purpose)
('m5.large', 'aws', 0.25, 2, 8),
('m5.xlarge', 'aws', 0.50, 4, 16),
('m5.2xlarge', 'aws', 1.00, 8, 32),
('m5.4xlarge', 'aws', 2.00, 16, 64),
('m5.8xlarge', 'aws', 4.00, 32, 128),
('m5.12xlarge', 'aws', 6.00, 48, 192),
('m5.16xlarge', 'aws', 8.00, 64, 256),

-- C5 instances (compute optimized)
('c5.large', 'aws', 0.22, 2, 4),
('c5.xlarge', 'aws', 0.44, 4, 8),
('c5.2xlarge', 'aws', 0.88, 8, 16),
('c5.4xlarge', 'aws', 1.76, 16, 32),
('c5.9xlarge', 'aws', 3.96, 36, 72),

-- R5 instances (memory optimized)
('r5.large', 'aws', 0.30, 2, 16),
('r5.xlarge', 'aws', 0.60, 4, 32),
('r5.2xlarge', 'aws', 1.20, 8, 64),
('r5.4xlarge', 'aws', 2.40, 16, 128),
('r5.8xlarge', 'aws', 4.80, 32, 256),
('r5.12xlarge', 'aws', 7.20, 48, 384),

-- Azure instances
('Standard_D2s_v4', 'azure', 0.25, 2, 8),
('Standard_D4s_v4', 'azure', 0.50, 4, 16),
('Standard_D8s_v4', 'azure', 1.00, 8, 32),
('Standard_D16s_v4', 'azure', 2.00, 16, 64),
('Standard_D32s_v4', 'azure', 4.00, 32, 128),
('Standard_D48s_v4', 'azure', 6.00, 48, 192),

-- GCP instances
('e2-standard-2', 'gcp', 0.25, 2, 8),
('e2-standard-4', 'gcp', 0.50, 4, 16),
('e2-standard-8', 'gcp', 1.00, 8, 32),
('e2-standard-16', 'gcp', 2.00, 16, 64),
('n2-standard-4', 'gcp', 0.58, 4, 16),
('n2-standard-8', 'gcp', 1.16, 8, 32),
('n2-standard-16', 'gcp', 2.32, 16, 64),
('n2-standard-32', 'gcp', 4.64, 32, 128);