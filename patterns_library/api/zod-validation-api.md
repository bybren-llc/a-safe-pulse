# Zod Validation API Pattern

## What It Does

Creates type-safe Express API routes with comprehensive input validation using Zod schemas. Provides automatic validation, type inference, and helpful error messages for both request bodies and query parameters.

## When to Use

- Form submission endpoints
- Complex data validation requirements
- Type-safe API development
- When you need runtime type checking
- APIs with strict data contracts

## Code Pattern

```typescript
// src/routes/{resource}.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';

const router = Router();

// 1. Define Zod schemas for validation
const CreateResourceSchema = z.object({
  // Basic types
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),

  email: z.string()
    .email('Invalid email address'),

  age: z.number()
    .int('Age must be an integer')
    .min(18, 'Must be at least 18')
    .max(120, 'Age must be realistic'),

  // Enums
  role: z.enum(['admin', 'user', 'guest'], {
    errorMap: () => ({ message: 'Invalid role' })
  }),

  // Optional fields
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),

  // Nullable fields
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
    .nullable()
    .optional(),

  // Arrays
  tags: z.array(z.string())
    .min(1, 'At least one tag required')
    .max(10, 'Maximum 10 tags'),

  // Nested objects
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    zipCode: z.string().regex(/^\d{5}$/, 'Invalid ZIP code')
  }).optional(),

  // Dates
  birthdate: z.string()
    .datetime('Invalid datetime format')
    .transform((str) => new Date(str)),

  // Custom validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    )
});

// 2. Infer TypeScript types from schema
type CreateResourceInput = z.infer<typeof CreateResourceSchema>;

// 3. Query parameters schema
const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  filter: z.string().optional(),
  status: z.enum(['active', 'inactive', 'ALL']).default('ALL')
});

/**
 * POST /api/{resource} - Create with validation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate with Zod (throws ZodError if invalid)
    const validated = CreateResourceSchema.parse(req.body);

    // At this point, `validated` is fully type-safe!
    // TypeScript knows exact types: validated.name is string, etc.

    // Create resource with parameterized SQL
    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `INSERT INTO {table_name} (name, email, organization_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [validated.name, validated.email, userId]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    console.error('Error creating {resource}:', error);
    return res.status(500).json({ error: 'Failed to create {resource}' });
  }
});

/**
 * GET /api/{resource} - List with query validation
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate query parameters
    const query = QuerySchema.parse({
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
      filter: req.query.filter,
      status: req.query.status
    });

    // Calculate pagination
    const offset = (query.page - 1) * query.limit;

    // Build dynamic query with parameterized SQL
    const pool: Pool = req.app.get('db');
    const conditions: string[] = ['organization_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (query.filter) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${query.filter}%`);
      paramIndex++;
    }

    if (query.status !== 'ALL') {
      conditions.push(`status = $${paramIndex}`);
      params.push(query.status);
      paramIndex++;
    }

    params.push(query.limit, offset);

    const sortDirection = query.sort === 'asc' ? 'ASC' : 'DESC';
    const result = await pool.query(
      `SELECT * FROM {table_name}
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ${sortDirection}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return res.json({
      data: result.rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.rows.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    return res.status(500).json({ error: 'Failed to fetch {resource}' });
  }
});

/**
 * PUT /api/{resource}/:id - Update with partial validation
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Partial schema - all fields optional for updates
    const UpdateSchema = CreateResourceSchema.partial();
    const validated = UpdateSchema.parse(req.body);

    // Build dynamic UPDATE with parameterized SQL
    const pool: Pool = req.app.get('db');
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(validated)) {
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE {table_name}
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '{Resource} not found' });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    return res.status(500).json({ error: 'Failed to update {resource}' });
  }
});

export default router;
```

## Advanced Zod Patterns

### Conditional Validation

```typescript
const ConditionalSchema = z
  .object({
    userType: z.enum(['individual', 'business']),
    // Conditionally require business fields
    businessName: z.string().optional(),
    taxId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.userType === 'business') {
        return data.businessName && data.taxId;
      }
      return true;
    },
    {
      message: 'Business name and tax ID required for business accounts',
      path: ['businessName'],
    },
  );
```

### Transform Data

```typescript
const TransformSchema = z.object({
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive()),

  tags: z
    .string()
    .transform((val) => val.split(',').map((t) => t.trim()))
    .pipe(z.array(z.string().min(1))),
});
```

### Union Types

```typescript
const PaymentMethodSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('card'),
    cardNumber: z.string().length(16),
    cvv: z.string().length(3),
  }),
  z.object({
    type: z.literal('bank'),
    accountNumber: z.string(),
    routingNumber: z.string(),
  }),
]);
```

## Customization Guide

1. **Replace placeholders**:
   - `{resource}` -- Your resource name
   - `{table_name}` -- PostgreSQL table name

2. **Define your schemas**:
   - Add fields specific to your data
   - Use appropriate Zod types
   - Add custom validation rules

3. **Handle errors**:
   - Return formatted validation errors
   - Include field paths
   - Provide helpful messages

4. **Type safety**:
   - Use `z.infer<>` for TypeScript types
   - Let Zod handle runtime validation

## Security Checklist

- [x] **Input Validation**: All inputs validated with Zod
- [x] **Type Safety**: TypeScript types inferred from schemas
- [x] **Error Messages**: Clear, helpful validation errors
- [x] **Parameterized SQL**: No string concatenation in queries
- [x] **XSS Prevention**: Sanitize string inputs if needed

## Validation Commands

```bash
# Type checking (will catch Zod type errors)
npm run build

# Run tests
npm test

# Full validation
npm test && npm run build && echo "BE SUCCESS" || echo "BE FAILED"
```

## Example: Planning Session Validation

```typescript
import { z } from 'zod';

const PlanningSessionSchema = z
  .object({
    confluence_page_url: z.string().url('Must be a valid URL'),
    planning_title: z.string().min(1).max(255),
    organization_id: z.string().min(1),
    status: z.enum(['pending', 'active', 'completed']).default('pending'),
  });

// In your route handler:
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = PlanningSessionSchema.parse(req.body);

    const pool: Pool = req.app.get('db');
    const result = await pool.query(
      `INSERT INTO planning_sessions
         (organization_id, confluence_page_url, planning_title, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [validated.organization_id, validated.confluence_page_url, validated.planning_title, validated.status]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    return res.status(500).json({ error: 'Failed to create planning session' });
  }
});
```

## Related Patterns

- [User Context API](./user-context-api.md) - Combine with authentication
- [Admin Context API](./admin-context-api.md) - Admin validation
- [API Integration Test](../testing/api-integration-test.md) - Test validation

---

**Pattern Source**: `src/routes/`, `src/webhooks/handler.ts`
**Last Updated**: 2026-03
**Validated By**: System Architect
