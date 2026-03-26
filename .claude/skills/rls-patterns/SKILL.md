---
name: rls-patterns
description: Row Level Security patterns for database operations. Use when writing database queries, creating Express API routes that access data, or implementing webhooks. This project uses direct pg (node-postgres) queries with raw SQL -- no ORM.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# RLS Patterns Skill

## Purpose

Enforce Row Level Security (RLS) patterns for all database operations. This skill ensures data isolation and prevents cross-user data access at the database level.

## Current Tech Stack

- **Database**: PostgreSQL (production) via `pg` (node-postgres) -- direct SQL queries
- **Dev Database**: SQLite via `SQLITE_DB_PATH` for local development
- **Connection**: `src/db/connection.ts` exports `query()` and `getClient()`
- **Migrations**: Raw SQL files in `src/db/migrations/` (auto-run on startup)
- **No ORM**: Direct SQL queries only (no ORM)
- **Server**: Express.js with OAuth 2.0 (Linear + Confluence)

## When This Skill Applies

Invoke this skill when:

- Writing any database query (raw SQL via `query()` or `getClient()`)
- Creating or modifying Express API routes that access the database
- Implementing webhook handlers that write to the database
- Working with user data, tokens, planning sessions, or sync state
- Accessing organization-scoped tables

## Critical Rules

### NEVER Do This

```typescript
// FORBIDDEN - String interpolation is SQL injection risk
const result = await query(`SELECT * FROM linear_tokens WHERE org_id = '${orgId}'`);

// FORBIDDEN - Unscoped queries expose all rows
const tokens = await query('SELECT * FROM linear_tokens');

// FORBIDDEN - Missing error handling on transactions
const client = await getClient();
await client.query('BEGIN');
await client.query('INSERT INTO ...');
await client.query('COMMIT');
// Missing: try/catch/finally, ROLLBACK, client.release()
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

## RLS Architecture: Current State and Target

### Current State

a-safe-pulse currently uses **application-level data isolation** -- queries filter by `organization_id` or session ownership in SQL WHERE clauses. The `query()` and `getClient()` helpers in `src/db/connection.ts` provide the database access layer.

### Target Architecture (When PostgreSQL RLS Is Added)

When PostgreSQL RLS policies are introduced:

1. **Session variables** will set user/org context: `SET app.current_user_id = '...'`
2. **RLS policies** on tables will enforce row-level filtering automatically
3. **Application roles** will have restricted GRANT permissions
4. **Context helpers** will wrap queries to set session variables before execution

### When to Use Raw SQL Safely

**Always** use parameterized queries (`$1`, `$2`, etc.) -- never interpolate values into SQL strings. The `query()` function in `src/db/connection.ts` accepts parameters as the second argument.

```typescript
// SAFE: Parameterized
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// UNSAFE: Interpolated -- NEVER DO THIS
const result = await query(`SELECT * FROM users WHERE id = '${userId}'`);
```

## Database Access Patterns

### Simple Query

```typescript
import { query } from '../db/connection';

// Parameterized read with org isolation
const result = await query(
  'SELECT * FROM planning_sessions WHERE id = $1 AND org_id = $2',
  [sessionId, orgId]
);
const session = result.rows[0];
```

### Transaction Pattern

```typescript
import { getClient } from '../db/connection';

const client = await getClient();
try {
  await client.query('BEGIN');

  const sessionResult = await client.query(
    'INSERT INTO planning_sessions (id, org_id) VALUES ($1, $2) RETURNING *',
    [sessionId, orgId]
  );

  await client.query(
    'INSERT INTO planning_features (session_id, title) VALUES ($1, $2)',
    [sessionId, featureTitle]
  );

  await client.query('COMMIT');
  return sessionResult.rows[0];
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Upsert Pattern (ON CONFLICT)

```typescript
await query(
  `INSERT INTO sync_state (entity_type, entity_id, last_synced)
   VALUES ($1, $2, NOW())
   ON CONFLICT (entity_type, entity_id)
   DO UPDATE SET last_synced = NOW()`,
  [entityType, entityId]
);
```

## Protected Tables

### Token/Auth Tables

| Table               | Isolation Key      | Access Pattern           |
| ------------------- | ------------------ | ------------------------ |
| `linear_tokens`     | `organization_id`  | Filter by org            |
| `confluence_tokens` | `organization_id`  | Filter by org            |

### Planning Tables

| Table               | Isolation Key      | Access Pattern              |
| ------------------- | ------------------ | --------------------------- |
| `planning_sessions` | `org_id`           | Filter by org               |
| `planning_features` | `session_id`       | Filter by parent session    |
| `planning_stories`  | `session_id`       | Filter by parent session    |
| `planning_enablers` | `session_id`       | Filter by parent session    |
| `program_increments`| `organization_id`  | Filter by org               |

## Express Middleware Patterns

### Organization Access Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  const orgId = req.params.orgId || req.query.orgId;
  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }
  (req as any).orgId = orgId;
  next();
}
```

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = `${timestamp}:${JSON.stringify(req.body)}`;
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}
```

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
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### Webhook Handler with Transaction

```typescript
import { getClient } from '../db/connection';

async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Idempotent: skip if already processed
    const existing = await client.query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [event.id]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return;
    }

    await client.query(
      `INSERT INTO webhook_events (event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, NOW())`,
      [event.id, event.type, JSON.stringify(event.data)]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Testing Requirements

Always test with parameterized queries and verify data isolation:

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## Authoritative References

- **DB Connection**: `src/db/connection.ts` (query + getClient exports)
- **Migrations**: `src/db/migrations/` (raw SQL files, `XXX_description.sql`)
- **Migration Runner**: `src/db/migrations/index.ts` (auto-run on startup)
- **Auth Module**: `src/auth/` (OAuth 2.0 for Linear + Confluence)
- **Webhook Handler**: `src/webhooks/handler.ts` (HMAC-SHA256 verification)
- **Security Guide**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
