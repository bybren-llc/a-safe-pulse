---
name: api-patterns
description: Express API route implementation patterns with Zod validation and error handling. Use when creating Express routes, implementing endpoints, or adding server-side validation. This project uses Express.js with direct pg queries -- no Next.js, no ORM.
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# API Patterns Skill

## Purpose

Route to existing API patterns and provide checklists for safe, validated Express API route implementation.

## Current Tech Stack

- **Server**: Express.js (`src/index.ts`)
- **Database**: Direct `pg` queries via `src/db/connection.ts`
- **Auth**: OAuth 2.0 (Linear + Confluence) in `src/auth/`
- **Validation**: Zod for request schema validation
- **No frontend framework**: CLI + API server only

## When This Skill Applies

Invoke this skill when:

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
// Must use: parameterized queries with $1, $2, etc.

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
// CORRECT: Parameterized query + structured response
router.get('/api/planning/:orgId/sessions', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    const result = await query(
      'SELECT * FROM planning_sessions WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ data: result.rows, success: true });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CORRECT: Zod validation
const CreateSessionSchema = z.object({
  name: z.string().min(1),
  orgId: z.string().min(1),
});

router.post('/api/sessions', async (req: Request, res: Response) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  // ... proceed with validated data
});
```

## API Route Checklist

Before ANY API route:

- [ ] Authentication/authorization check (OAuth session or webhook signature)
- [ ] Proper 401/403 response for unauthorized
- [ ] Request validation with Zod schema
- [ ] Parameterized SQL queries (never string interpolation)
- [ ] Structured error responses with appropriate status codes
- [ ] TypeScript types for request/response

## Existing Routes Reference

| Route Pattern                | Method | File                    | Purpose                |
| ---------------------------- | ------ | ----------------------- | ---------------------- |
| `/auth`                      | GET    | `src/auth/oauth.ts`     | Linear OAuth start     |
| `/auth/callback`             | GET    | `src/auth/oauth.ts`     | Linear OAuth callback  |
| `/auth/confluence`           | GET    | `src/auth/confluence-oauth.ts` | Confluence OAuth |
| `/webhook`                   | POST   | `src/webhooks/handler.ts` | Linear webhooks      |
| `/api/planning/*`            | GET    | `src/api/planning.ts`   | Planning API           |
| `/api/health`                | GET    | `src/api/health.ts`     | Health check           |

## Standard Response Patterns

### Success Response

```typescript
res.json({ data: result.rows, success: true });
```

### Error Response

```typescript
res.status(400).json({
  error: 'Human-readable error message',
  code: 'ERROR_CODE',
  details: validationErrors,
});
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
import { query } from '../db/connection';
import * as logger from '../utils/logger';

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

    // 2. Execute database operation with parameterized query
    const result = await query(
      'INSERT INTO resources (name, type) VALUES ($1, $2) RETURNING *',
      [parsed.data.name, parsed.data.type]
    );

    // 3. Return success response
    res.status(201).json({ data: result.rows[0], success: true });
  } catch (error) {
    logger.error('API error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

## Webhook Handler Pattern

```typescript
import { Request, Response } from 'express';
import crypto from 'crypto';
import { getClient } from '../db/connection';

async function handleWebhook(req: Request, res: Response) {
  // 1. Verify webhook signature (HMAC-SHA256)
  const signature = req.headers['x-signature'] as string;
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Process in transaction
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Idempotent processing
    const existing = await client.query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [req.body.id]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ status: 'already processed' });
    }

    // Process event...
    await client.query('COMMIT');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Processing failed' });
  } finally {
    client.release();
  }
}
```

## API Documentation Template

For documenting new endpoints:

```markdown
## Endpoint: POST /api/resource

### Description
Creates a new resource.

### Authentication
Required: OAuth session

### Request Body
| Field | Type   | Required | Description   |
| ----- | ------ | -------- | ------------- |
| name  | string | Yes      | Resource name |
| type  | string | No       | Resource type |

### Response
**Success (201)**: `{ "data": { "id": 1, "name": "..." }, "success": true }`
**Error (400)**: `{ "error": "Validation failed", "details": {...} }`
```

## Related Skills

- **rls-patterns**: Database query patterns (REQUIRED for all DB operations)
- **security-audit**: API security validation
- **testing-patterns**: Express API endpoint testing
