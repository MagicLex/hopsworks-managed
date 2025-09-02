-- Fix the stripe_products table constraint to match our actual pricing model

-- Drop the old constraint
ALTER TABLE stripe_products DROP CONSTRAINT stripe_products_product_type_check;

-- Add new constraint with our actual product types
ALTER TABLE stripe_products ADD CONSTRAINT stripe_products_product_type_check 
CHECK (product_type IN ('compute_credits', 'storage_online_gb', 'storage_offline_gb'));

-- Now we can insert the proper products
UPDATE stripe_products SET active = false WHERE active = true;

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