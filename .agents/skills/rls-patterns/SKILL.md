---
name: rls-patterns
description: >
  Row Level Security patterns for database operations. Use when writing any
  database query, creating API routes that access data, implementing webhooks
  that write to the database, or working with user data. This project uses
  direct pg (node-postgres) queries with raw SQL -- no ORM.
---

# RLS Patterns Skill

> **TEMPLATE**: This skill uses `{{PLACEHOLDER}}` tokens. Replace with your project values before use.

## Purpose

Enforce Row Level Security (RLS) patterns for all database operations. This skill ensures data isolation and prevents cross-user data access at the database level.

## Current Tech Stack

- **Database**: PostgreSQL (production) via `pg` (node-postgres) -- direct SQL queries
- **Dev Database**: SQLite via `SQLITE_DB_PATH` for local development
- **Connection**: `src/db/connection.ts` exports `query()` and `getClient()`
- **Migrations**: Raw SQL files in `src/db/migrations/` (auto-run on startup)
- **No ORM**: Direct SQL queries only (no ORM)

## When This Skill Applies

- Writing any database query (raw SQL via `query()` or `getClient()`)
- Creating or modifying Express API routes that access the database
- Implementing webhook handlers that write to the database
- Working with user data, tokens, or planning sessions
- Accessing admin-only tables

## Critical Rules

### NEVER Do This

```typescript
// FORBIDDEN - Unparameterized queries are SQL injection risks
const result = await query(`SELECT * FROM linear_tokens WHERE org_id = '${orgId}'`);

// FORBIDDEN - Direct queries without considering data isolation
const tokens = await query('SELECT * FROM linear_tokens');
```

### ALWAYS Do This

```typescript
import { query, getClient } from '{{DB_CONNECTION_IMPORT}}';

// CORRECT - Parameterized queries
const result = await query(
  'SELECT * FROM linear_tokens WHERE organization_id = $1',
  [orgId]
);

// CORRECT - Transactions with getClient() for multi-step operations
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

a-safe-pulse currently uses **application-level data isolation** -- queries filter by `organization_id` or session ownership in the SQL WHERE clauses. The `query()` and `getClient()` helpers in `src/db/connection.ts` provide the database access layer.

### Target Architecture (When RLS Is Added)

When PostgreSQL RLS policies are introduced:

1. **Session variables** will set user/org context: `SET app.current_user_id = '...'`
2. **RLS policies** on tables will enforce row-level filtering automatically
3. **Application roles** (`{{PROJECT}}_app_user`) will have restricted GRANT permissions
4. **Context helpers** will wrap queries to set session variables before execution

### When to Use Raw SQL Safely

**Always** use parameterized queries (`$1`, `$2`, etc.) -- never interpolate values into SQL strings. The `query()` function in `src/db/connection.ts` accepts parameters as the second argument.

## Database Access Patterns

### Simple Query

```typescript
import { query } from '{{DB_CONNECTION_IMPORT}}';

// Parameterized read
const result = await query(
  'SELECT * FROM planning_sessions WHERE id = $1 AND org_id = $2',
  [sessionId, orgId]
);
const session = result.rows[0];
```

### Transaction Pattern

```typescript
import { getClient } from '{{DB_CONNECTION_IMPORT}}';

const client = await getClient();
try {
  await client.query('BEGIN');

  // Insert parent record
  const sessionResult = await client.query(
    'INSERT INTO planning_sessions (id, org_id) VALUES ($1, $2) RETURNING *',
    [sessionId, orgId]
  );

  // Insert child records
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

## Protected Tables

### Session/Token Tables

| Table               | Isolation Key      | Access Pattern             |
| ------------------- | ------------------ | -------------------------- |
| `linear_tokens`     | `organization_id`  | Filter by org              |
| `confluence_tokens` | `organization_id`  | Filter by org              |
| `planning_sessions` | `id` + `org_id`    | Filter by org/session      |
| `planning_features` | `session_id`       | Filter by parent session   |
| `planning_stories`  | `session_id`       | Filter by parent session   |

## Express Middleware Example

```typescript
import { Request, Response, NextFunction } from 'express';

// Middleware to validate org access
function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  const orgId = req.params.orgId || req.query.orgId;
  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }
  // Attach to request for downstream handlers
  (req as any).orgId = orgId;
  next();
}
```

## Common Patterns

### Express Route with Data Isolation

```typescript
import { Router, Request, Response } from 'express';
import { query } from '{{DB_CONNECTION_IMPORT}}';

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
```

### Webhook Handler with Transaction

```typescript
import { getClient } from '{{DB_CONNECTION_IMPORT}}';

async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Record the webhook event
    await client.query(
      `INSERT INTO webhook_events (event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(event.data)]
    );

    // Process event-specific logic...

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
{{TEST_COMMAND}}
```

## Authoritative References

- **DB Connection**: `src/db/connection.ts` (query + getClient exports)
- **Migrations**: `src/db/migrations/` (raw SQL, auto-run on startup)
- **Migration Index**: `src/db/migrations/index.ts` (registration and execution)
- **Security Guide**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
