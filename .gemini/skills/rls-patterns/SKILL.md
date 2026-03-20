---
name: rls-patterns
description: Row Level Security patterns for database operations. Use when writing database queries, creating Express API routes that access data, or implementing webhooks. This project uses direct pg (node-postgres) queries with raw SQL -- no ORM.
---

# RLS Patterns Skill

## Purpose

Enforce Row Level Security (RLS) patterns for all database operations. Ensures data isolation and prevents cross-user data access.

## Current Tech Stack

- **Database**: PostgreSQL (production) via `pg` (node-postgres) -- direct SQL queries
- **Dev Database**: SQLite via `SQLITE_DB_PATH` for local development
- **Connection**: `src/db/connection.ts` exports `query()` and `getClient()`
- **Migrations**: Raw SQL files in `src/db/migrations/` (auto-run on startup)
- **No ORM**: Direct SQL queries only (no ORM)

## When This Skill Applies

- Writing any database query (raw SQL via `query()` or `getClient()`)
- Creating or modifying Express API routes that access the database
- Implementing webhook handlers
- Working with user data, tokens, planning sessions

## Critical Rules

### NEVER Do This

```typescript
// FORBIDDEN - String interpolation is SQL injection risk
const result = await query(`SELECT * FROM linear_tokens WHERE org_id = '${orgId}'`);

// FORBIDDEN - Unscoped queries expose all rows
const tokens = await query('SELECT * FROM linear_tokens');
```

### ALWAYS Do This

```typescript
import { query, getClient } from '../db/connection';

// CORRECT - Parameterized queries prevent SQL injection
const result = await query(
  'SELECT * FROM linear_tokens WHERE organization_id = $1',
  [orgId]
);

// CORRECT - Transactions with proper error handling
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query(
    'INSERT INTO planning_sessions (id, org_id, status) VALUES ($1, $2, $3)',
    [sessionId, orgId, 'active']
  );
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## RLS Architecture

### Current State

Application-level data isolation via WHERE clauses filtering by `organization_id` or session ownership. The `query()` and `getClient()` helpers in `src/db/connection.ts` provide database access.

### Target Architecture

When PostgreSQL RLS policies are introduced, session variables (`SET app.current_user_id`) and RLS policies will enforce row-level filtering automatically.

## Common Patterns

### Express Route with Data Isolation

```typescript
import { Router, Request, Response } from 'express';
import { query } from '../db/connection';

const router = Router();

router.get('/api/planning/:orgId/sessions', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await query(
      'SELECT * FROM planning_sessions WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Reference

- **DB Connection**: `src/db/connection.ts`
- **Migrations**: `src/db/migrations/` (raw SQL, auto-run on startup)
- **Security Guide**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
