# SQL Transaction Pattern

## What It Does

Executes multiple database operations atomically within a PostgreSQL transaction using the `pg` (node-postgres) client. Uses explicit `BEGIN`, `COMMIT`, and `ROLLBACK` to ensure either all operations succeed or all fail together, maintaining data consistency.

## When to Use

- Multi-step workflows (e.g., create planning session + features + stories)
- Operations that must happen together
- Creating related records across tables
- Complex business logic requiring consistency
- When you need rollback on any failure

## Code Pattern

```typescript
// src/services/{resource}-service.ts
import { Pool, PoolClient } from 'pg';

/**
 * Execute multi-step operation in a transaction.
 *
 * Pattern: acquire client, BEGIN, operations, COMMIT, release.
 * On error: ROLLBACK, release, re-throw.
 */
export async function createResourceWithRelations(
  pool: Pool,
  organizationId: string,
  data: {
    name: string;
    items: Array<{ name: string; quantity: number }>;
  }
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Create main resource
    const resourceResult = await client.query(
      `INSERT INTO {main_table} (organization_id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [organizationId, data.name]
    );
    const resource = resourceResult.rows[0];

    // Step 2: Create related records
    const items = [];
    for (const item of data.items) {
      const itemResult = await client.query(
        `INSERT INTO {related_table} (resource_id, organization_id, name, quantity, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [resource.id, organizationId, item.name, item.quantity]
      );
      items.push(itemResult.rows[0]);
    }

    // Step 3: Update aggregates or related data
    await client.query(
      `INSERT INTO {aggregate_table} (resource_id, organization_id, total_items)
       VALUES ($1, $2, $3)
       ON CONFLICT (resource_id)
       DO UPDATE SET total_items = $3, updated_at = NOW()`,
      [resource.id, organizationId, items.length]
    );

    await client.query('COMMIT');

    // Return complete result
    return {
      resource,
      items,
      total_items: items.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Transaction Patterns

### Pattern 1: Planning Session with Features

```typescript
/**
 * Create a planning session and its features atomically.
 */
export async function createPlanningSession(
  pool: Pool,
  data: {
    organizationId: string;
    confluencePageUrl: string;
    planningTitle: string;
    features: Array<{ featureId: string; title: string; description?: string }>;
  }
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create planning session
    const sessionResult = await client.query(
      `INSERT INTO planning_sessions
         (organization_id, confluence_page_url, planning_title, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING *`,
      [data.organizationId, data.confluencePageUrl, data.planningTitle]
    );
    const session = sessionResult.rows[0];

    // 2. Create features
    for (const feature of data.features) {
      await client.query(
        `INSERT INTO planning_features
           (planning_session_id, feature_id, title, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [session.id, feature.featureId, feature.title, feature.description || null]
      );
    }

    // 3. Update session status
    await client.query(
      `UPDATE planning_sessions
       SET status = 'active', updated_at = NOW()
       WHERE id = $1`,
      [session.id]
    );

    await client.query('COMMIT');
    return session;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 2: Bulk Operations

```typescript
/**
 * Create multiple records in a single transaction.
 */
export async function bulkCreateStories(
  pool: Pool,
  featureId: number,
  stories: Array<{ storyId: string; title: string; description?: string }>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let insertedCount = 0;

    for (const story of stories) {
      await client.query(
        `INSERT INTO planning_stories
           (planning_feature_id, story_id, title, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [featureId, story.storyId, story.title, story.description || null]
      );
      insertedCount++;
    }

    await client.query('COMMIT');
    return { count: insertedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 3: Conditional Operations (Read-Modify-Write)

```typescript
/**
 * Update only if conditions are met.
 * Uses SELECT ... FOR UPDATE to lock the row.
 */
export async function updateSessionStatus(
  pool: Pool,
  sessionId: number,
  newStatus: string,
  organizationId: string
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock and read current state
    const current = await client.query(
      `SELECT * FROM planning_sessions
       WHERE id = $1 AND organization_id = $2
       FOR UPDATE`,
      [sessionId, organizationId]
    );

    if (current.rows.length === 0) {
      throw new Error('Planning session not found');
    }

    const session = current.rows[0];

    // 2. Validate state transition
    const validTransitions: Record<string, string[]> = {
      pending: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
    };

    if (!validTransitions[session.status]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from '${session.status}' to '${newStatus}'`
      );
    }

    // 3. Apply update
    const result = await client.query(
      `UPDATE planning_sessions
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, sessionId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 4: Transaction with Savepoints

```typescript
/**
 * Use savepoints for partial rollback within a transaction.
 */
export async function processWithPartialRecovery(
  pool: Pool,
  items: Array<{ id: string; data: any }>
) {
  const client = await pool.connect();
  const results: Array<{ id: string; status: string }> = [];

  try {
    await client.query('BEGIN');

    for (const item of items) {
      try {
        await client.query('SAVEPOINT process_item');

        await client.query(
          `INSERT INTO {table_name} (external_id, data, created_at)
           VALUES ($1, $2, NOW())`,
          [item.id, JSON.stringify(item.data)]
        );

        await client.query('RELEASE SAVEPOINT process_item');
        results.push({ id: item.id, status: 'success' });
      } catch (itemError) {
        // Roll back just this item, continue with others
        await client.query('ROLLBACK TO SAVEPOINT process_item');
        results.push({ id: item.id, status: 'failed' });
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Customization Guide

1. **Replace placeholders**:
   - `{main_table}` -- Primary table name
   - `{related_table}` -- Related table name
   - `{aggregate_table}` -- Aggregates/summaries table
   - `{resource}` -- Resource name

2. **Choose transaction isolation** (optional):
   ```sql
   BEGIN ISOLATION LEVEL SERIALIZABLE;
   -- or: READ COMMITTED (default), REPEATABLE READ
   ```

3. **Handle errors**:
   - Throw errors inside the transaction to trigger ROLLBACK
   - Use savepoints for partial failure recovery
   - Return meaningful error messages

4. **Optimize performance**:
   - Use `unnest` for bulk inserts when possible
   - Minimize round-trips inside the transaction
   - Keep transactions short-lived

## Security Checklist

- [x] **Atomicity**: All-or-nothing via BEGIN/COMMIT/ROLLBACK
- [x] **Client Release**: `finally` block always releases the client
- [x] **Parameterized SQL**: No string concatenation in queries
- [x] **User Ownership**: Verify `organization_id` in all records
- [x] **Row Locking**: Use `FOR UPDATE` for read-modify-write patterns

## Validation Commands

```bash
# Type checking
npm run build

# Run tests
npm test

# Database consistency check
psql -U postgres -d linear_agent \
  -c "SELECT * FROM planning_sessions WHERE organization_id = 'test_org';"
```

## Example: Token Storage with Transaction

```typescript
import { Pool } from 'pg';

export async function storeOAuthTokens(
  pool: Pool,
  data: {
    organizationId: string;
    accessToken: string;
    refreshToken: string;
    appUserId: string;
    expiresAt: Date;
  }
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Upsert token record
    await client.query(
      `INSERT INTO linear_tokens
         (organization_id, access_token, refresh_token, app_user_id, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET
         access_token = $2,
         refresh_token = $3,
         app_user_id = $4,
         expires_at = $5,
         updated_at = NOW()`,
      [data.organizationId, data.accessToken, data.refreshToken, data.appUserId, data.expiresAt]
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

## Related Patterns

- [RLS Migration](./rls-migration.md) - Creating RLS-enabled tables
- [User Context API](../api/user-context-api.md) - Using transactions in APIs
- [Admin Context API](../api/admin-context-api.md) - Admin transactions

---

**Pattern Source**: `src/db/migrations/`, `src/auth/`
**Last Updated**: 2026-03
**Validated By**: System Architect
