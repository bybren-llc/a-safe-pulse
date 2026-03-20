---
name: migration-patterns
description: Database migration creation with raw SQL files and ARCHitect approval workflow. Use when creating migrations, adding tables, or altering schemas. Raw SQL in `src/db/migrations/` with `XXX_description.sql` naming.
---

# Migration Patterns Skill

## Purpose

Guide database migration creation with mandatory RLS policies, following security-first architecture and approval workflow.

## Current Tech Stack

- **Migrations**: Raw SQL files in `src/db/migrations/`
- **Naming**: `XXX_description.sql` (e.g., `001_initial_schema.sql`)
- **Registration**: `src/db/migrations/index.ts` auto-discovers `.sql` files
- **Execution**: Auto-run on startup in sorted order, tracked in `migrations` table
- **No ORM migrations**: Raw SQL only (no ORM migration tools)

## When This Skill Applies

- Creating database migrations
- Adding new tables
- Altering existing schemas
- Adding indexes or constraints
- Data migration planning

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```sql
-- FORBIDDEN: Schema changes without ARCHitect approval
-- FORBIDDEN: Missing indexes on filter/join columns
-- FORBIDDEN: Destructive operations without rollback plan
```

### CORRECT Patterns

```sql
-- File: src/db/migrations/008_add_audit_log.sql
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(organization_id);
```

## Migration Workflow (MANDATORY)

### Step 1: Get ARCHitect Approval

Before ANY schema change -- document and get approval.

### Step 2: Create Migration File

```bash
touch src/db/migrations/008_add_audit_log.sql
ls src/db/migrations/*.sql
```

### Step 3: Write Idempotent SQL

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- All columns with types and constraints

### Step 4: Verify Locally

```bash
npm run dev  # Migrations auto-run on startup
```

### Step 5: Update Documentation

- [ ] Update `docs/database/DATA_DICTIONARY.md` (MANDATORY)

## Migration Checklist

- [ ] ARCHitect approval obtained
- [ ] File named `XXX_description.sql` in `src/db/migrations/`
- [ ] Uses `IF NOT EXISTS` for idempotency
- [ ] Indexes on filter/join columns
- [ ] Local test passed
- [ ] DATA_DICTIONARY.md updated

## Reference

- **Migration Runner**: `src/db/migrations/index.ts`
- **Existing Migrations**: `src/db/migrations/*.sql`
- **Data Dictionary**: `docs/database/DATA_DICTIONARY.md`
- **Security First**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
