# Migration History

## Overview

This document tracks all database migrations applied to the Hopsworks Managed Service database.

## Migration Files Location

- **Supabase migrations**: `/supabase/migrations/`
- **SQL migrations**: `/sql/migrations/`

## Applied Migrations

### 001_initial_schema.sql
**Date**: Initial setup  
**Purpose**: Create base tables for MVP

**Changes**:
- Created `users` table
- Created `user_credits` table
- Created `usage_daily` table
- Created `billing_history` table
- Created `instances` table (later removed)
- Created `feature_groups` table (later removed)
- Created `model_deployments` table (later removed)
- Set up indexes and RLS policies

### 002_usage_metrics.sql
**Purpose**: Extended usage tracking

**Changes**:
- Added usage metrics tables (later consolidated)

### 003_admin_and_clusters.sql
**Purpose**: Add admin features and cluster management

**Changes**:
- Added `is_admin` column to users
- Created initial cluster tables

### 004_cluster_assignment_metadata.sql
**Purpose**: Track cluster assignments

**Changes**:
- Added metadata fields to assignments

### 005_add_stripe_customer_id.sql
**Purpose**: Fix missing Stripe integration

**Changes**:
- Added `stripe_customer_id` to users table
- Added index for faster lookups

### 006_add_team_support.sql
**Date**: 2025-01-31  
**Purpose**: Enable team functionality

**Changes**:
- Added `account_owner_id` to users table
- Added `hopsworks_project_id` to users table
- Created `team_invites` table
- Created `team_members` view
- Created `account_usage` view
- Added indexes for team queries

### 007_cleanup_unused_tables.sql
**Date**: 2025-01-31  
**Purpose**: Remove unused tables from MVP

**Changes**:
- Dropped 11 unused tables:
  - `billing_history`
  - `credit_transactions`
  - `clusters`
  - `feature_groups`
  - `model_deployments`
  - `invoices`
  - `subscriptions`
  - `usage_metrics`
  - `user_pricing_overrides`
  - `user_profiles`
  - `instances_backup`
- Kept `stripe_products` with deprecation notice

### 008_complete_cleanup_schema.sql
**Date**: 2025-01-31  
**Purpose**: Complete team support implementation

**Changes**:
- Added `stripe_test_customer_id` to users
- Added `account_owner_id` to usage_daily
- Created `account_usage_summary` view
- Migrated existing usage data to set account_owner_id

## Current Schema Status

### Active Tables (7)
1. `users` - Core user data with team support
2. `team_invites` - Pending team invitations
3. `user_credits` - Prepaid billing credits
4. `usage_daily` - Daily usage tracking
5. `hopsworks_clusters` - Available clusters
6. `user_hopsworks_assignments` - User-cluster mappings
7. `stripe_products` - (DEPRECATED) Product pricing

### Active Views (3)
1. `team_members` - Team member relationships
2. `account_usage` - Simple usage aggregation
3. `account_usage_summary` - Detailed usage with breakdown

## Migration Best Practices

### 1. File Naming
```
XXX_description.sql
```
- Use sequential numbers (001, 002, etc.)
- Descriptive names in snake_case

### 2. Migration Structure
```sql
-- Description of what this migration does
-- Date: YYYY-MM-DD
-- Author: (optional)

-- Changes go here

-- Add rollback instructions in comments
-- ROLLBACK: DROP TABLE xyz;
```

### 3. Safety Rules
- Always use `IF EXISTS` for drops
- Use `IF NOT EXISTS` for creates
- Include column existence checks for alters
- Test on development first

### 4. Data Migrations
- Backup data before destructive changes
- Include data migration in same file
- Verify row counts after migration

## Pending Migrations

### Planned Changes
1. **Remove stripe_products table** - Move to application config
2. **Add audit_logs table** - Track team actions
3. **Add usage_limits table** - Per-user/team limits
4. **Enable RLS** - Row-level security for production

### Future Considerations
- Partitioning for `usage_daily` table (by month)
- Archival strategy for old usage data
- Read replicas for analytics queries

## Rollback Procedures

### General Rollback Steps
1. Identify the migration to rollback
2. Check for dependent objects
3. Backup current state
4. Execute rollback commands
5. Verify system functionality

### Example Rollback
```sql
-- Rollback 006_add_team_support.sql
ALTER TABLE users DROP COLUMN IF EXISTS account_owner_id;
ALTER TABLE users DROP COLUMN IF EXISTS hopsworks_project_id;
DROP TABLE IF EXISTS team_invites CASCADE;
DROP VIEW IF EXISTS team_members;
DROP VIEW IF EXISTS account_usage;
```

## Migration Checklist

Before applying a new migration:
- [ ] Test on local/development database
- [ ] Review for syntax errors
- [ ] Check for data loss risks
- [ ] Verify rollback procedure
- [ ] Document in this file
- [ ] Update type definitions if needed
- [ ] Notify team of schema changes