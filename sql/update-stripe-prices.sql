-- Update Stripe product IDs with live/production IDs
-- Run this after creating products in Stripe

-- Clear old test prices
UPDATE stripe_products SET active = false WHERE active = true;

-- Insert new production prices
INSERT INTO stripe_products (
  product_type,
  stripe_product_id,
  stripe_price_id,
  unit_price,
  unit_name,
  active
) VALUES 
  ('compute_credits', 'prod_SyouWf2n0ZTrgl', 'price_1S2rGbBVhabmeSATRqsYZHUm', 0.35, 'credit', true),
  ('storage_online_gb', 'prod_SyowZZ5KSoxZZR', 'price_1S2rINBVhabmeSATVcqyroBz', 0.50, 'GB-month', true),
  ('storage_offline_gb', 'prod_SyoxUy6KrEirtL', 'price_1S2rJLBVhabmeSATjpqLQgIn', 0.03, 'GB-month', true);