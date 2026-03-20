# Admin Context API Pattern

## What It Does

Creates an admin-only Express API route with elevated permissions. Used for administrative operations that require higher access levels than regular users, such as managing organizations, users, or system configuration.

## When to Use

- Admin dashboard CRUD operations
- Organization management endpoints
- System configuration APIs
- Reports and analytics for admins
- User management endpoints

## Code Pattern

```typescript
// src/routes/admin/{resource}.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';

const router = Router();

// Validation schemas
const QuerySchema = z.object({
  status: z.enum(['draft', 'published', 'ALL']).default('ALL'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(255),
  status: z.enum(['draft', 'published']).default('draft'),
  // ... other fields
});

/**
 * Middleware: verify the authenticated user has admin privileges.
 * Place this on the router or apply per-route.
 */
function requireAdmin(req: Request, res: Response, next: Function): void {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// Apply admin check to all routes on this router
router.use(requireAdmin);

/**
 * GET /api/admin/{resource} - List resources (admin only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;

    // Parse and validate query parameters
    const query = QuerySchema.parse({
      status: req.query.status || 'ALL',
      limit: req.query.limit,
      offset: req.query.offset,
    });

    // Build query with optional status filter
    const pool: Pool = req.app.get('db');
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.status !== 'ALL') {
      conditions.push(`status = $${paramIndex++}`);
      params.push(query.status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    params.push(query.limit, query.offset);
    const result = await pool.query(
      `SELECT * FROM {table_name}
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      admin_id: adminId,
    });
  } catch (error) {
    console.error('Error fetching admin {resource}:', error);

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
 * POST /api/admin/{resource} - Create resource (admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const validated = CreateSchema.parse(req.body);

    const pool: Pool = req.app.get('db');

    // Create resource
    const result = await pool.query(
      `INSERT INTO {table_name} (title, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [validated.title, validated.status, adminId]
    );

    // Optional: Audit logging
    await pool.query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [adminId, 'CREATE', '{resource}', result.rows[0].id, JSON.stringify({ title: validated.title })]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating admin {resource}:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    return res.status(500).json({ error: 'Failed to create {resource}' });
  }
});

/**
 * PUT /api/admin/{resource}/:id - Update resource (admin only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;

    const UpdateSchema = CreateSchema.partial();
    const validated = UpdateSchema.parse(req.body);

    const pool: Pool = req.app.get('db');

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(validated)) {
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }

    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(adminId);
    setClauses.push(`updated_at = NOW()`);

    params.push(id);

    const result = await pool.query(
      `UPDATE {table_name}
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '{Resource} not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating admin {resource}:', error);
    return res.status(500).json({ error: 'Failed to update {resource}' });
  }
});

/**
 * DELETE /api/admin/{resource}/:id - Delete resource (admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `DELETE FROM {table_name} WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '{Resource} not found' });
    }

    return res.json({ success: true, message: '{Resource} deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin {resource}:', error);
    return res.status(500).json({ error: 'Failed to delete {resource}' });
  }
});

export default router;
```

## Customization Guide

1. **Replace placeholders**:
   - `{resource}` -- Resource name (e.g., `organizations`, `users`)
   - `{table_name}` -- PostgreSQL table name (e.g., `planning_sessions`, `linear_tokens`)
   - `{Resource}` -- Capitalized for messages

2. **Update Zod schemas**:
   - Define fields specific to your resource
   - Add business validation rules
   - Handle optional vs required fields

3. **Adjust SQL queries**:
   - Add filtering logic
   - Add JOIN clauses for related data
   - Implement pagination/sorting

4. **Add audit logging** (optional but recommended):
   - Track who made changes
   - Log sensitive operations
   - Include before/after values

## Security Checklist

- [x] **Admin Verification**: `requireAdmin` middleware checks role before handler
- [x] **Authentication**: OAuth middleware validates token upstream
- [x] **Input Validation**: Zod schemas for all inputs
- [x] **Parameterized Queries**: No string concatenation in SQL
- [x] **Error Handling**: Safe error messages (no sensitive data)
- [x] **Audit Logging**: Track admin actions (recommended)

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

## Example: Admin Organization Management

```typescript
// src/routes/admin/organizations.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';

const router = Router();

const UpdateOrgSchema = z.object({
  organization_id: z.string().min(1),
  status: z.enum(['active', 'suspended']).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `SELECT organization_id, created_at, updated_at
       FROM linear_tokens
       ORDER BY created_at DESC`
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

export default router;
```

## Related Patterns

- [User Context API](./user-context-api.md) - For user-specific operations
- [Webhook Handler](./webhook-handler.md) - For system operations
- [API Integration Test](../testing/api-integration-test.md) - Testing admin routes

---

**Pattern Source**: `src/webhooks/handler.ts`, `src/index.ts`
**Last Updated**: 2026-03
**Validated By**: System Architect
