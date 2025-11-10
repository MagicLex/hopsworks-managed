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
- Retained `stripe_products` for active Stripe metered billing mappings

### 008_complete_cleanup_schema.sql
**Date**: 2025-01-31
**Purpose**: Complete team support implementation

**Changes**:
- Added `stripe_test_customer_id` to users
- Added `account_owner_id` to usage_daily
- Created `account_usage_summary` view
- Migrated existing usage data to set account_owner_id

### 004_add_soft_delete.sql
**Date**: 2025-11-05
**Purpose**: Implement soft delete for user accounts

**Changes**:
- Added `deleted_at` column to users table
- Added `deletion_reason` column to users table
- Created `idx_users_deleted_at` index for deleted users
- Created `idx_users_active` index for active users
- Self-deletion now preserves audit trail and billing data
- Login blocked for deleted users via auth check
- Cluster access revoked by setting maxNumProjects to 0

### 005_add_stripe_usage_record_id.sql
**Date**: 2025-11-10
**Purpose**: Add audit trail for Stripe billing reconciliation

**Changes**:
- Added `stripe_usage_record_id` column to usage_daily table
- Created partial index `idx_usage_daily_stripe_record` for faster Stripe lookups
- Enables proper audit trail and reconciliation between internal usage records and Stripe meter events
- Resolves silent update failure in sync-stripe.ts that was attempting to write to missing column

## Current Schema Status

### Active Tables
1. `users` - Core user data with team support
2. `team_invites` - Pending team invitations
3. `user_projects` - Namespace mapping cache
4. `project_member_roles` - Team project membership cache
5. `user_credits` - Prepaid credit balances (reporting)
6. `usage_daily` - Daily usage tracking
7. `hopsworks_clusters` - Available clusters
8. `user_hopsworks_assignments` - User-cluster mappings
9. `stripe_products` - Stripe product/price mappings

### Active Views
1. `team_members` - Team member relationships
2. `account_usage` - Simple usage aggregation
3. `account_usage_summary` - Detailed usage with breakdown
