# RLS Migration Pattern

## What It Does

Creates a raw SQL database migration with Row Level Security (RLS) policies to protect user data at the PostgreSQL level. Ensures users can only access their own data even if application-level bugs exist. RLS is a first-class architectural concern in this project.

## When to Use

- Adding new tables with user/organization data
- Adding columns containing sensitive data
- Creating tables for organization-specific content
- Any schema change involving `organization_id` or `user_id`

## Code Pattern

### Step 1: Create Migration File

```bash
# Create new migration file following project convention
# Files go in: src/db/migrations/
# Naming: XXX_description.sql (e.g., 008_add_user_preferences_with_rls.sql)
touch src/db/migrations/008_add_user_preferences_with_rls.sql
```

### Step 2: Write Migration SQL

```sql
-- src/db/migrations/008_add_user_preferences_with_rls.sql

-- 1. Create table
CREATE TABLE IF NOT EXISTS {table_name} (
    id SERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Foreign key to organization
    FOREIGN KEY (organization_id) REFERENCES linear_tokens(organization_id) ON DELETE CASCADE
);

-- 2. Create index for RLS performance (CRITICAL)
CREATE INDEX IF NOT EXISTS {table_name}_organization_id_idx
    ON {table_name}(organization_id);

-- =====================================================
-- RLS POLICIES (MANDATORY FOR ORGANIZATION DATA TABLES)
-- =====================================================

-- 3. Enable RLS on the table
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;

-- 4. Organization isolation policy
-- Users can only access rows matching their organization
CREATE POLICY {table_name}_org_isolation ON {table_name}
    FOR ALL
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));

-- 5. Application user policy (if using a separate DB role)
CREATE POLICY {table_name}_app_isolation ON {table_name}
    FOR ALL
    TO app_user
    USING (organization_id = current_setting('app.current_organization_id', true));

-- =====================================================
-- ADMIN ACCESS (OPTIONAL)
-- =====================================================

-- 6. Admin policy (allows admins to access all data)
CREATE POLICY {table_name}_admin_access ON {table_name}
    FOR ALL
    TO postgres
    USING (
        current_setting('app.current_role', true) = 'admin'
    );

-- =====================================================
-- SYSTEM ACCESS (OPTIONAL - for webhooks/background jobs)
-- =====================================================

-- 7. System policy (allows system operations to bypass org checks)
CREATE POLICY {table_name}_system_access ON {table_name}
    FOR ALL
    TO postgres
    USING (
        current_setting('app.current_role', true) = 'system'
    );
```

### Step 3: Register Migration

```typescript
// src/db/migrations/index.ts
// Add the new migration to the migrations array

import { readFileSync } from 'fs';
import path from 'path';

const migrations = [
  '001_initial_schema.sql',
  '002_confluence_tokens.sql',
  '003_program_increments.sql',
  '005_sync_tables.sql',
  '006_integrate_sync_schema.sql',
  '007_make_refresh_token_nullable.sql',
  '008_add_user_preferences_with_rls.sql',  // NEW
];

export function getMigrations(): Array<{ name: string; sql: string }> {
  return migrations.map(name => ({
    name,
    sql: readFileSync(path.join(__dirname, name), 'utf-8'),
  }));
}
```

### Step 4: Verify Migration

```bash
# Run migration on local database
npm run docker:up

# Verify RLS is enabled
docker exec -it db psql -U postgres -d linear_agent \
  -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = '{table_name}';"

# Expected output:
#  tablename  | rowsecurity
# ------------+-------------
#  {table_name} | t

# Check policies exist
docker exec -it db psql -U postgres -d linear_agent \
  -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = '{table_name}'::regclass;"
```

## RLS Policy Patterns

### Organization Isolation (Standard)

```sql
-- Users can only access their own organization's data
CREATE POLICY {table}_org_isolation ON {table}
    FOR ALL
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));
```

### Admin Access

```sql
-- Admins can access all data
CREATE POLICY {table}_admin_access ON {table}
    FOR ALL
    TO postgres
    USING (current_setting('app.current_role', true) = 'admin');
```

### System Access

```sql
-- System operations (webhooks, background jobs) bypass org checks
CREATE POLICY {table}_system_access ON {table}
    FOR ALL
    TO postgres
    USING (current_setting('app.current_role', true) = 'system');
```

### Read-Only Public Access

```sql
-- Public can read, only owner can modify
CREATE POLICY {table}_public_read ON {table}
    FOR SELECT
    TO postgres
    USING (true);  -- Anyone can read

CREATE POLICY {table}_owner_write ON {table}
    FOR INSERT
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY {table}_owner_update ON {table}
    FOR UPDATE
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY {table}_owner_delete ON {table}
    FOR DELETE
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));
```

### Setting the RLS Context in Application Code

```typescript
// In your Express middleware or route handler, set the RLS context
// before executing queries:

import { Pool, PoolClient } from 'pg';

async function withOrgContext(
  pool: Pool,
  organizationId: string,
  callback: (client: PoolClient) => Promise<any>
): Promise<any> {
  const client = await pool.connect();
  try {
    // Set the RLS context for this connection
    await client.query(
      "SELECT set_config('app.current_organization_id', $1, true)",
      [organizationId]
    );
    return await callback(client);
  } finally {
    client.release();
  }
}

// Usage:
const result = await withOrgContext(pool, orgId, async (client) => {
  // All queries on this client are now scoped to orgId by RLS
  return client.query('SELECT * FROM {table_name}');
});
```

## Customization Guide

1. **Replace placeholders**:
   - `{table_name}` / `{table}` -- Your table name
   - Update column definitions to match your schema

2. **Adjust RLS policies**:
   - Standard: Organization isolation only
   - +Admin: Add admin access policy
   - +System: Add system access policy
   - Public: Add public read policy

3. **Add indexes**:
   - Always index `organization_id` for RLS performance
   - Add other indexes as needed for query patterns

4. **Foreign keys**:
   - Reference `linear_tokens(organization_id)` for org data
   - Add ON DELETE CASCADE for cleanup

## Security Checklist

- [x] **RLS Enabled**: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [x] **Policies Created**: At least one policy per table
- [x] **Index Added**: `organization_id` indexed for performance
- [x] **Foreign Key**: References `linear_tokens(organization_id)` with CASCADE
- [x] **Migration Registered**: Added to `src/db/migrations/index.ts`
- [x] **Architect Approval**: Schema changes approved

## Validation Commands

```bash
# Run migrations
npm run docker:up

# Verify RLS enabled
psql -U postgres -d linear_agent \
  -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = '{table}';"

# Check policies exist
psql -U postgres -d linear_agent \
  -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = '{table}'::regclass;"

# Test organization isolation
psql -U postgres -d linear_agent \
  -c "SELECT set_config('app.current_organization_id', 'test_org', true); SELECT * FROM {table};"
```

## Example: Sync State Table with RLS

```sql
-- src/db/migrations/XXX_add_sync_state_with_rls.sql

CREATE TABLE IF NOT EXISTS sync_state (
    id SERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    last_synced_at TIMESTAMP,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    FOREIGN KEY (organization_id) REFERENCES linear_tokens(organization_id) ON DELETE CASCADE,
    UNIQUE (organization_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS sync_state_organization_id_idx ON sync_state(organization_id);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state FORCE ROW LEVEL SECURITY;

CREATE POLICY sync_state_org_isolation ON sync_state
    FOR ALL
    TO postgres
    USING (organization_id = current_setting('app.current_organization_id', true));

CREATE POLICY sync_state_system_access ON sync_state
    FOR ALL
    TO postgres
    USING (current_setting('app.current_role', true) = 'system');
```

## Related Patterns

- [SQL Transaction](./sql-transaction.md) - Complex multi-step operations
- [User Context API](../api/user-context-api.md) - Using RLS in APIs
- [Admin Context API](../api/admin-context-api.md) - Admin operations

---

**Pattern Source**: `docs/database/RLS_DATABASE_MIGRATION_SOP.md`, `src/db/migrations/`
**Last Updated**: 2026-03
**Validated By**: System Architect
