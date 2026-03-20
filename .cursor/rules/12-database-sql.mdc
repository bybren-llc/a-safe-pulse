---
description: "Database rules for PostgreSQL, raw SQL migrations, and Row Level Security."
globs: "src/db/**,src/db/migrations/**"
alwaysApply: false
---

# Database and SQL Rules

These rules apply when working on database schemas, queries, and migrations.

## Technology

- **Database**: PostgreSQL (production), SQLite (development)
- **ORM**: None -- direct `pg` queries
- **Migrations**: Raw SQL files in `src/db/migrations/`
- **RLS**: Row Level Security (MANDATORY for target architecture)

## Row Level Security (RLS)

**CRITICAL**: RLS is mandatory for ALL tables containing user data.

### RLS Context Helpers

Every database operation MUST use the appropriate context helper:

| Helper                | Use Case                     |
|-----------------------|------------------------------|
| `withUserContext`     | User-scoped operations       |
| `withAdminContext`    | Admin-scoped operations      |
| `withSystemContext`   | Background/webhook operations|

### Zero Tolerance

- No direct query calls without RLS context wrappers
- No bypassing RLS policies for convenience
- No using superuser credentials in application code

### RLS Validation

After any schema change, validate RLS:
- User isolation: User A cannot see User B's data
- Admin access: Admin can see data within policy scope
- System context: Background tasks use system context

## Migration Workflow

```bash
# 1. Create a new migration file
# Use the next sequential number: XXX_description.sql
touch src/db/migrations/008_add_new_table.sql

# 2. Write the migration SQL (CREATE TABLE, ALTER TABLE, etc.)
# 3. Add RLS policies if new table contains user data
# 4. Register the migration in src/db/migrations/index.ts
# 5. Test locally
npm run dev

# 6. Commit
git add src/db/migrations/
git commit -m "feat(db): description [ASP-XXX]"
```

### Migration Rules

- Never use `DROP TABLE` without a backup strategy
- Never apply manual DDL in production outside of migrations
- Always add proper indexes for query patterns
- Add RLS policies for every new table with user data
- Schema changes REQUIRE System Architect approval
- Follow naming convention: `XXX_description.sql` (e.g., `008_add_audit_log.sql`)

## Query Standards

- Use parameterized queries to prevent SQL injection
- Include `created_at` and `updated_at` timestamps on all tables
- Use explicit column lists in SELECT statements (avoid `SELECT *`)
- Handle connection pooling properly via the `pg` client

## Key References

- `docs/database/DATA_DICTIONARY.md` -- Schema reference (SINGLE SOURCE OF TRUTH)
- `docs/database/RLS_DATABASE_MIGRATION_SOP.md` -- Migration SOP (MANDATORY reading)
- `docs/database/RLS_IMPLEMENTATION_GUIDE.md` -- RLS implementation details
- `patterns_library/database/rls-migration.md` -- RLS migration pattern
