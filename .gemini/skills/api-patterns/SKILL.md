---
name: api-patterns
description: Express API route implementation patterns with Zod validation and error handling. Use when creating Express routes, implementing endpoints, or adding server-side validation. This project uses Express.js with direct pg queries -- no Next.js, no ORM.
---

# API Patterns Skill

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
const { userId } = req.body; // Must validate with Zod
```

### CORRECT Patterns

```typescript
// CORRECT: Parameterized query + Zod validation
router.post('/api/resource', async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const result = await query(
    'INSERT INTO resources (name) VALUES ($1) RETURNING *',
    [parsed.data.name]
  );

  res.status(201).json({ data: result.rows[0], success: true });
});
```

## API Route Checklist

- [ ] Authentication/authorization check
- [ ] Request validation with Zod schema
- [ ] Parameterized SQL queries (never interpolate)
- [ ] Structured error responses
- [ ] TypeScript types for request/response

## Status Codes

| Code | When to Use                                  |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 201  | Created (POST)                               |
| 400  | Bad request / validation error               |
| 401  | Not authenticated                            |
| 403  | Forbidden                                    |
| 404  | Not found                                    |
| 429  | Rate limit exceeded                          |
| 500  | Server error                                 |

## Related Skills

- **rls-patterns**: Database query patterns (REQUIRED for all DB operations)
- **security-audit**: API security validation
- **testing-patterns**: Express API endpoint testing
