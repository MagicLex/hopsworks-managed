# Database Documentation

This directory contains comprehensive documentation for the Hopsworks Managed Service database schema.

## Table of Contents

1. [Overview](./01-overview.md) - Database connection, architecture, and design principles
2. [Core Tables](./02-core-tables.md) - Users, teams, and authentication
3. [Billing Tables](./03-billing-tables.md) - Credits, usage tracking, and billing
4. [Cluster Management](./04-cluster-management.md) - Hopsworks clusters and assignments
5. [Views and Functions](./05-views-functions.md) - Database views and stored procedures
6. [Migration History](./06-migrations.md) - Applied migrations and schema changes

## Quick Reference

### Current Tables (7 total)
- `users` - User accounts and team relationships
- `team_invites` - Pending team invitations
- `user_credits` - Credit balances for prepaid billing
- `usage_daily` - Daily usage metrics and costs
- `hopsworks_clusters` - Available Hopsworks clusters
- `user_hopsworks_assignments` - User-to-cluster mappings
- `stripe_products` - (DEPRECATED) Product pricing info

### Key Views
- `team_members` - Lists all team members with their owners
- `account_usage` - Aggregated usage by account owner
- `account_usage_summary` - Detailed usage breakdown by account

## Database Connection

### Direct psql Connection
```bash
# Set password in environment first
export PGPASSWORD='[password-from-env]'

# Connect to Supabase
psql -h aws-0-us-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.pahfsiosiuxdkiebepav

# Alternative connection strings:
# Via pooler (recommended for applications):
postgresql://postgres.pahfsiosiuxdkiebepav:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# Direct connection (for migrations):
postgresql://postgres:[password]@db.pahfsiosiuxdkiebepav.supabase.co:5432/postgres
```

### Common Commands
```sql
-- List all tables
\dt

-- Describe table structure
\d usage_daily

-- Show indexes
\di

-- List foreign keys
\d+ table_name
```

## ER Diagram

```mermaid
erDiagram
    users ||--o{ team_invites : "sends"
    users ||--o{ users : "owns team members"
    users ||--o{ user_credits : "has"
    users ||--o{ usage_daily : "generates"
    users ||--o{ user_hopsworks_assignments : "assigned to"
    hopsworks_clusters ||--o{ user_hopsworks_assignments : "hosts"
    
    users {
        text id PK "Auth0 ID"
        text email UK
        text account_owner_id FK "NULL if owner"
        text stripe_customer_id
        boolean is_admin
    }
    
    usage_daily {
        uuid id PK
        text user_id FK
        text account_owner_id FK
        date date
        decimal total_cost
    }
```