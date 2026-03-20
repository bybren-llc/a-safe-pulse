---
name: migration-patterns
description: Database migration creation with mandatory RLS policies and ARCHitect approval workflow. Use when creating migrations, adding tables, or altering schemas. Raw SQL files in `src/db/migrations/` with `XXX_description.sql` naming.
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob
---

# Migration Patterns Skill

## Purpose

Guide database migration creation with mandatory RLS policies, following security-first architecture and approval workflow.

## Current Tech Stack

- **Migrations**: Raw SQL files in `src/db/migrations/`
- **Naming Convention**: `XXX_description.sql` (e.g., `001_initial_schema.sql`)
- **Registration**: `src/db/migrations/index.ts` auto-discovers `.sql` files, runs in sorted order
- **Execution**: Auto-run on app startup, tracked in `migrations` table
- **Database**: PostgreSQL (prod via `DATABASE_URL`) / SQLite (dev via `SQLITE_DB_PATH`)
- **No ORM migrations**: Raw SQL only (no ORM migration tools)

## When This Skill Applies

Invoke this skill when:

- Creating database migrations
- Adding new tables
- Altering existing schemas
- Adding indexes or constraints
- Schema impact analysis
- Data migration planning

## Existing Migrations

```
src/db/migrations/
├── index.ts                          # Migration runner (auto-discovers .sql files)
├── 001_initial_schema.sql            # Core tables: linear_tokens, planning_sessions, etc.
├── 002_confluence_tokens.sql         # Confluence OAuth tokens
├── 003_program_increments.sql        # PI planning tables
├── 005_sync_tables.sql               # Sync state tracking
├── 006_integrate_sync_schema.sql     # Sync schema integration
└── 007_make_refresh_token_nullable.sql # Token schema adjustment
```

## How the Migration Runner Works

The runner in `src/db/migrations/index.ts`:

1. Creates a `migrations` table if it does not exist
2. Reads all `.sql` files from the migrations directory
3. Sorts them alphabetically (so `001` runs before `002`)
4. Skips already-applied migrations (tracked by filename in `migrations` table)
5. Runs each pending migration inside a transaction (BEGIN/COMMIT with ROLLBACK on error)
6. Records each successful migration in the `migrations` table

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```sql
-- FORBIDDEN: Schema changes without ARCHitect approval
-- All migrations require approval before PR

-- FORBIDDEN: Missing indexes on filter/join columns
CREATE TABLE planning_features (...);
-- Missing: CREATE INDEX on session_id

-- FORBIDDEN: Destructive operations without rollback plan
DROP TABLE planning_sessions;
-- Must have backup + documented rollback
```

### CORRECT Patterns

```sql
-- CORRECT: Complete migration with indexes
-- File: src/db/migrations/008_add_audit_log.sql

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for query performance (MANDATORY for filter columns)
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
```

## Migration Workflow (MANDATORY)

### Step 1: Get ARCHitect Approval

Before ANY schema change:

```text
1. Document proposed changes
2. Get ARCHitect approval (create issue or discussion)
3. Only proceed after explicit approval
```

### Step 2: Create Migration File

```bash
# Create a new SQL migration file
# Use next available number, descriptive name
touch src/db/migrations/008_add_audit_log.sql

# Verify naming follows convention
ls src/db/migrations/*.sql
```

### Step 3: Write Migration SQL

Write idempotent SQL with:

- [ ] `CREATE TABLE IF NOT EXISTS` for new tables
- [ ] All columns with types and constraints
- [ ] Primary key defined
- [ ] `CREATE INDEX IF NOT EXISTS` on filter/join columns
- [ ] RLS policies (as comments if not yet enforced at DB level)

### Step 4: Verify Locally

```bash
# Start the app -- migrations auto-run on startup
npm run dev

# Or run directly against PostgreSQL
psql $DATABASE_URL -f src/db/migrations/008_add_audit_log.sql

# Verify table created
psql $DATABASE_URL -c "\dt"

# Check migration was recorded
psql $DATABASE_URL -c "SELECT * FROM migrations ORDER BY id;"
```

### Step 5: Update Documentation

After successful migration:

- [ ] Update `docs/database/DATA_DICTIONARY.md` (MANDATORY)
- [ ] Update RLS policy catalog if new policies added
- [ ] Document in Linear ticket

## RLS Policy Templates

When adding PostgreSQL RLS enforcement:

### User/Org Isolation Policy

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table}_org_isolation ON {table}
  FOR ALL TO app_user
  USING (organization_id = current_setting('app.current_org_id', true));
```

### Index for RLS Performance

```sql
CREATE INDEX IF NOT EXISTS idx_{table}_org_id ON {table}(organization_id);
```

## Migration Checklist

Before PR:

- [ ] ARCHitect approval obtained
- [ ] File named `XXX_description.sql` in `src/db/migrations/`
- [ ] Uses `IF NOT EXISTS` for idempotency
- [ ] Indexes on filter/join columns
- [ ] Local migration test passed (app starts cleanly)
- [ ] DATA_DICTIONARY.md updated
- [ ] Evidence attached to Linear

## PROD Migration Requirements

For production migrations:

- [ ] @cheddarfox must be present (MANDATORY)
- [ ] Backup taken before migration
- [ ] Rollback plan documented
- [ ] Post-migration validation steps defined
- [ ] Data integrity checks planned

## Authoritative References

- **Migration Runner**: `src/db/migrations/index.ts` (MANDATORY -- read before creating migrations)
- **Existing Migrations**: `src/db/migrations/*.sql` (follow existing patterns)
- **Data Dictionary**: `docs/database/DATA_DICTIONARY.md` (update after changes)
- **DB Connection**: `src/db/connection.ts` (query + getClient)
- **Security First**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
