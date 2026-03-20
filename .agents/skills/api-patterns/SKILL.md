---
name: api-patterns
description: >
  Express API route implementation patterns with validation and error handling.
  Use when creating Express routes, implementing CRUD endpoints, adding
  server-side validation, handling webhooks, or implementing error handling.
  This project uses Express.js with direct pg queries -- no Next.js, no ORM.
---

# API Patterns Skill

> **TEMPLATE**: This skill uses `{{PLACEHOLDER}}` tokens. Replace with your project values before use.

## Purpose

Route to existing API patterns and provide checklists for safe, validated Express API route implementation.

## When This Skill Applies

- Creating new Express API routes
- Implementing CRUD endpoints
- Adding request/response validation
- Handling webhooks (Linear, Confluence)
- Implementing error handling patterns

## Authoritative References (MUST READ)

| Pattern           | Location                                         | Purpose                     |
| ----------------- | ------------------------------------------------ | --------------------------- |
| User Context API  | `patterns_library/api/user-context-api.md`       | User-scoped operations      |
| Admin Context API | `patterns_library/api/admin-context-api.md`      | Admin-scoped operations     |
| Zod Validation    | `patterns_library/api/zod-validation-api.md`     | Request/response validation |
| Webhook Handler   | `patterns_library/api/webhook-handler.md`        | Webhook processing          |

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```typescript
// FORBIDDEN: SQL injection via string interpolation
const result = await query(`SELECT * FROM users WHERE id = '${userId}'`);

// FORBIDDEN: Missing authentication check
router.get('/api/data', async (req, res) => {
  return res.json(await getAllData()); // No auth check!
});

// FORBIDDEN: Unvalidated user input
const { userId } = req.body;
// Must validate with Zod schema

// FORBIDDEN: Generic error responses
res.status(500).send("Error");
// Must use structured error response
```

### CORRECT Patterns

```typescript
// CORRECT: Parameterized queries
const result = await query('SELECT * FROM sessions WHERE org_id = $1', [orgId]);

// CORRECT: Auth check + validation
router.post('/api/resource', async (req: Request, res: Response) => {
  // 1. Validate input
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  // 2. Execute with parameterized query
  const result = await query(
    'INSERT INTO resources (name, org_id) VALUES ($1, $2) RETURNING *',
    [parsed.data.name, req.params.orgId]
  );

  // 3. Structured response
  res.status(201).json({ data: result.rows[0], success: true });
});
```

## API Route Checklist

Before ANY API route:

- [ ] Authentication/authorization check (OAuth middleware or session)
- [ ] Proper 401/403 response for unauthorized
- [ ] Request validation with Zod schema
- [ ] Parameterized SQL queries (never interpolate)
- [ ] Structured error responses with appropriate status codes
- [ ] TypeScript types for request/response

## Standard Response Patterns

### Success Response

```json
{ "data": { ... }, "success": true }
```

### Error Response

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "optional_details"
}
```

### Status Codes

| Code | When to Use                                  |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 201  | Created (POST)                               |
| 400  | Bad request / validation error               |
| 401  | Not authenticated                            |
| 403  | Forbidden (authenticated but not authorized) |
| 404  | Resource not found                           |
| 429  | Rate limit exceeded                          |
| 500  | Server error                                 |

## Express Route Template

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '{{DB_CONNECTION_IMPORT}}';

const router = Router();

// Request validation schema
const CreateResourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
});

router.post('/api/resource', async (req: Request, res: Response) => {
  try {
    // 1. Validate request body
    const parsed = CreateResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    // 2. Execute database operation
    const result = await query(
      'INSERT INTO resources (name, type) VALUES ($1, $2) RETURNING *',
      [parsed.data.name, parsed.data.type]
    );

    // 3. Return success response
    res.status(201).json({ data: result.rows[0], success: true });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

## Related Skills

- **rls-patterns**: Database query patterns (REQUIRED for all DB operations)
- **security-audit**: API security validation
- **testing-patterns**: Express API endpoint testing
