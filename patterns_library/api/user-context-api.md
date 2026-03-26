# User Context API Pattern

## What It Does

Creates an authenticated Express API route for user-specific data operations. Ensures users can only access their own data via OAuth token validation and parameterized PostgreSQL queries.

## When to Use

- User-specific CRUD operations (planning sessions, features, stories)
- Protected endpoints requiring OAuth authentication
- Any API that reads/writes user-owned data
- User dashboard data retrieval

## Code Pattern

```typescript
// src/routes/{resource}.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';

const router = Router();

// Optional: Zod validation schema for query parameters
const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/{resource} - Get user-specific data
 *
 * Requires: OAuth middleware applied upstream (sets req.user)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 1. Authentication check (OAuth middleware sets req.user)
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Parse and validate query parameters
    const query = QuerySchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
    });

    // 3. Database query with parameterized SQL
    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `SELECT * FROM {table_name}
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, query.limit, query.offset]
    );

    // 4. Success response
    return res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching {resource}:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: error.errors,
      });
    }

    return res.status(500).json({ error: 'Failed to fetch {resource}' });
  }
});

/**
 * POST /api/{resource} - Create user data
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 1. Authentication check
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Parse and validate request body
    const CreateSchema = z.object({
      name: z.string().min(1),
      // ... other fields per spec
    });

    const validated = CreateSchema.parse(req.body);

    // 3. Create data with parameterized SQL
    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `INSERT INTO {table_name} (organization_id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [userId, validated.name]
    );

    // 4. Success response
    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating {resource}:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    return res.status(500).json({ error: 'Failed to create {resource}' });
  }
});

export default router;
```

## Customization Guide

1. **Replace placeholders**:
   - `{resource}` -- Your resource name (e.g., `planning-sessions`, `features`)
   - `{table_name}` -- PostgreSQL table name (e.g., `planning_sessions`, `planning_features`)

2. **Update Zod schemas**:
   - Define validation for query parameters (QuerySchema)
   - Define validation for request body (CreateSchema, UpdateSchema)

3. **Adjust SQL queries**:
   - Add WHERE conditions as needed
   - Add JOIN clauses for related data
   - Add sorting, pagination, filtering

4. **Add business logic**:
   - Organization membership checks
   - Access control rules
   - Data transformation before response

## Security Checklist

- [x] **Authentication**: OAuth middleware validates user before handler executes
- [x] **User Ownership**: Always filter by `organization_id` in queries
- [x] **Input Validation**: Use Zod schemas for all inputs
- [x] **Parameterized Queries**: Never concatenate user input into SQL
- [x] **Error Handling**: Catch and log errors, return safe messages

## Validation Commands

```bash
# Type checking
npm run build

# Linting
npm run lint 2>/dev/null || npx eslint src/routes/

# Run tests
npm test

# Full validation
npm test && npm run build && echo "BE SUCCESS" || echo "BE FAILED"
```

## Example: Planning Sessions API

```typescript
// src/routes/planning-sessions.ts
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `SELECT * FROM planning_sessions
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [organizationId]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching planning sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch planning sessions' });
  }
});

export default router;
```

## Related Patterns

- [Admin Context API](./admin-context-api.md) - For admin-only operations
- [Zod Validation API](./zod-validation-api.md) - Complex input validation
- [API Integration Test](../testing/api-integration-test.md) - Testing this pattern

---

**Pattern Source**: `src/webhooks/handler.ts`, `src/index.ts`
**Last Updated**: 2026-03
**Validated By**: System Architect
