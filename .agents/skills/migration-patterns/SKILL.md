---
name: migration-patterns
description: >
  Database migration creation with mandatory RLS policies and ARCHitect approval
  workflow. Use when creating migrations, adding tables, or planning data
  migrations. Migrations are raw SQL files in `src/db/migrations/` with
  `XXX_description.sql` naming, registered in `index.ts`, auto-run on startup.
---

# Migration Patterns Skill

> **TEMPLATE**: This skill uses `{{PLACEHOLDER}}` tokens. Replace with your project values before use.

## Purpose

Guide database migration creation with mandatory RLS policies, following security-first architecture and approval workflow.

## Current Tech Stack

- **Migrations**: Raw SQL files in `src/db/migrations/`
- **Naming**: `XXX_description.sql` (e.g., `001_initial_schema.sql`)
- **Registration**: `src/db/migrations/index.ts` auto-discovers and runs `.sql` files
- **Execution**: Auto-run on startup in sorted order, tracked in `migrations` table
- **Database**: PostgreSQL (prod) / SQLite (dev)
- **No ORM migrations**: Raw SQL only (no ORM migration tools)

## When This Skill Applies

- Creating database migrations
- Adding new tables
- Altering existing schemas
- Adding indexes or constraints
- Schema impact analysis
- Data migration planning

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```sql
-- FORBIDDEN: RLS policies in separate file from table creation
-- RLS MUST be in the same migration file as the table creation

-- FORBIDDEN: Table without RLS consideration
CREATE TABLE user_data (...);
-- Must document RLS plan even if not yet enforced

-- FORBIDDEN: Missing index on foreign key / filter columns
CREATE TABLE planning_features (...);
-- Missing: CREATE INDEX idx_planning_features_session_id ON planning_features(session_id);

-- FORBIDDEN: Schema changes without ARCHitect approval
-- All migrations require approval before PR
```

### CORRECT Patterns

```sql
-- CORRECT: Complete migration with indexes in same file
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

-- RLS (when enforced at DB level):
-- ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY audit_log_org_isolation ON audit_log
--   FOR ALL USING (organization_id = current_setting('app.current_org_id', true));
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
ls src/db/migrations/
# Expected: 001_initial_schema.sql, 002_confluence_tokens.sql, ...
```

### Step 3: Write Migration SQL

Write the migration with:

- [ ] `CREATE TABLE IF NOT EXISTS` (idempotent)
- [ ] All columns with types and constraints
- [ ] Primary key defined
- [ ] Indexes on filter/join columns
- [ ] `CREATE INDEX IF NOT EXISTS` (idempotent)
- [ ] RLS policies (as comments if not yet enforced)

### Step 4: Verify Locally

```bash
# Start the app -- migrations auto-run on startup
npm run dev

# Or run directly against PostgreSQL
psql $DATABASE_URL -f src/db/migrations/008_add_audit_log.sql

# Verify table created
psql $DATABASE_URL -c "\dt"
```

### Step 5: Update Documentation

After successful migration:

- [ ] Update `docs/database/DATA_DICTIONARY.md` (MANDATORY)
- [ ] Update RLS policy catalog if new policies added
- [ ] Document in ticket

## Migration Checklist

Before PR:

- [ ] ARCHitect approval obtained
- [ ] File named `XXX_description.sql` in `src/db/migrations/`
- [ ] Uses `IF NOT EXISTS` for idempotency
- [ ] Indexes on filter/join columns
- [ ] Local migration test passed
- [ ] DATA_DICTIONARY.md updated
- [ ] Evidence attached to ticket

## Production Migration Requirements

For production migrations:

- [ ] POPM/lead must be present (MANDATORY)
- [ ] Backup taken before migration
- [ ] Rollback plan documented
- [ ] Post-migration validation steps defined
- [ ] Data integrity checks planned

## Authoritative References

- **Migration Runner**: `src/db/migrations/index.ts` (MANDATORY -- understand before creating)
- **Existing Migrations**: `src/db/migrations/*.sql` (follow existing patterns)
- **Data Dictionary**: `docs/database/DATA_DICTIONARY.md` (update after changes)
- **Security First**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
