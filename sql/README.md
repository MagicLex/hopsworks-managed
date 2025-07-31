# SQL Directory

## Current Schema

The complete database schema is in [`current_schema.sql`](./current_schema.sql).

This file contains:
- All table definitions (7 tables)
- All indexes and constraints
- All views (3 views)
- All stored functions
- All triggers

## Usage

To create a fresh database:
```bash
psql -h your-host -U your-user -d postgres -f current_schema.sql
```

## Documentation

For detailed database documentation, see [`/docs/database/`](../docs/database/).