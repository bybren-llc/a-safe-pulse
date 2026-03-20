# API Integration Test Pattern

## What It Does

Tests Express API routes end-to-end using Jest and supertest. Validates authentication, business logic, database operations, and error handling by making real HTTP requests against the Express app.

## When to Use

- Testing API route handlers
- Validating authentication and authorization logic
- End-to-end API validation
- CI/CD automated testing
- Testing webhook handlers

## Code Pattern

```typescript
// tests/integration/{resource}.test.ts
import request from 'supertest';
import express, { Express } from 'express';
import { Pool } from 'pg';

// 1. Create a test app instance with the route under test
function createTestApp(pool: Pool): Express {
  const app = express();
  app.use(express.json());

  // Make pool available to routes
  app.set('db', pool);

  // Mock auth middleware for tests
  app.use((req: any, _res, next) => {
    // Default: authenticated user
    req.user = { id: 'test_org_123', role: 'user' };
    next();
  });

  // Mount the route under test
  // import resourceRouter from '../../src/routes/{resource}';
  // app.use('/api/{resource}', resourceRouter);

  return app;
}

// 2. Mock database pool
function createMockPool(): Pool {
  const mockQuery = jest.fn();

  return {
    query: mockQuery,
    connect: jest.fn().mockResolvedValue({
      query: mockQuery,
      release: jest.fn(),
    }),
  } as unknown as Pool;
}

describe('API Integration: /api/{resource}', () => {
  let app: Express;
  let mockPool: Pool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    app = createTestApp(mockPool);
  });

  describe('GET /api/{resource}', () => {
    it('should return data successfully', async () => {
      // Mock database response
      const mockData = [
        { id: 1, name: 'Test Item', organization_id: 'test_org_123' },
      ];

      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockData });

      const response = await request(app)
        .get('/api/{resource}')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });

    it('should return 401 for unauthenticated request', async () => {
      // Create app without auth
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.set('db', mockPool);

      // No auth middleware -- user is undefined
      // import resourceRouter from '../../src/routes/{resource}';
      // unauthApp.use('/api/{resource}', resourceRouter);

      const response = await request(unauthApp)
        .get('/api/{resource}')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should handle query parameters with validation', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/{resource}?limit=10&offset=5')
        .expect(200);

      // Verify query was called with correct params
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 5])
      );
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/{resource}?limit=-1')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/{resource}', () => {
    it('should create resource successfully', async () => {
      const newResource = {
        id: 1,
        name: 'New Item',
        organization_id: 'test_org_123',
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [newResource],
      });

      const response = await request(app)
        .post('/api/{resource}')
        .send({ name: 'New Item' })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('New Item');
    });

    it('should return 400 for invalid input', async () => {
      // Missing required fields
      const response = await request(app)
        .post('/api/{resource}')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 500 on database error', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/{resource}')
        .send({ name: 'Test' })
        .set('Content-Type', 'application/json')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
```

## Advanced Patterns

### Admin Route Testing

```typescript
describe('Admin API Tests', () => {
  let adminApp: Express;
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = createMockPool();
    adminApp = express();
    adminApp.use(express.json());
    adminApp.set('db', mockPool);

    // Admin auth middleware
    adminApp.use((req: any, _res, next) => {
      req.user = { id: 'admin_123', role: 'admin' };
      next();
    });

    // import adminRouter from '../../src/routes/admin/{resource}';
    // adminApp.use('/api/admin/{resource}', adminRouter);
  });

  it('should allow admin access', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await request(adminApp)
      .get('/api/admin/{resource}')
      .expect(200);
  });

  it('should deny non-admin access', async () => {
    // Create app with regular user
    const userApp = express();
    userApp.use(express.json());
    userApp.set('db', mockPool);
    userApp.use((req: any, _res, next) => {
      req.user = { id: 'user_123', role: 'user' };
      next();
    });
    // import adminRouter from '../../src/routes/admin/{resource}';
    // userApp.use('/api/admin/{resource}', adminRouter);

    await request(userApp)
      .get('/api/admin/{resource}')
      .expect(403);
  });
});
```

### Webhook Handler Testing

```typescript
import crypto from 'crypto';

describe('Webhook Handler Tests', () => {
  const WEBHOOK_SECRET = 'test_webhook_secret';

  function generateSignature(body: any): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  it('should accept valid webhook signature', async () => {
    const body = { type: 'Issue', action: 'create', data: { id: '123' } };

    await request(app)
      .post('/webhook')
      .set('linear-signature', generateSignature(body))
      .send(body)
      .expect(200);
  });

  it('should reject invalid webhook signature', async () => {
    await request(app)
      .post('/webhook')
      .set('linear-signature', 'invalid')
      .send({ type: 'Issue' })
      .expect(401);
  });

  it('should reject missing signature', async () => {
    await request(app)
      .post('/webhook')
      .send({ type: 'Issue' })
      .expect(401);
  });
});
```

### Database Transaction Testing

```typescript
describe('Transaction Tests', () => {
  it('should rollback on failure', async () => {
    const mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Simulate failure on second query
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
      .mockRejectedValueOnce(new Error('Constraint violation')) // Second INSERT
      .mockResolvedValueOnce(undefined); // ROLLBACK

    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    await expect(
      createResourceWithRelations(mockPool, 'org_123', {
        name: 'Test',
        items: [{ name: 'Item 1', quantity: 1 }],
      })
    ).rejects.toThrow('Constraint violation');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
```

## Customization Guide

1. **Replace placeholders**:
   - `{resource}` -- API resource name
   - `{table}` -- Database table name

2. **Mock dependencies**:
   - Mock the database pool for unit-style integration tests
   - Use a real test database for full integration tests
   - Mock external services (Linear API, Confluence API)

3. **Test scenarios**:
   - Happy path (200/201)
   - Authentication (401)
   - Authorization (403)
   - Validation (400)
   - Not found (404)
   - Server errors (500)

4. **Assertions**:
   - Status codes
   - Response body structure
   - Database query parameters
   - Error messages

## Security Checklist

- [x] **Auth Testing**: Test authenticated and unauthenticated requests
- [x] **Admin Testing**: Verify admin-only routes reject regular users
- [x] **Error Cases**: Test all error scenarios
- [x] **Input Validation**: Test with invalid inputs
- [x] **Webhook Signatures**: Test valid, invalid, and missing signatures

## Validation Commands

```bash
# Run all tests
npm test

# Run specific test file
npx jest tests/integration/{resource}.test.ts

# Run with coverage
npx jest --coverage tests/integration/

# Run tests matching a pattern
npx jest --testPathPattern="integration"
```

## Example: Planning Session API Test

```typescript
import request from 'supertest';
import express from 'express';

describe('GET /api/planning/sessions', () => {
  it('returns planning sessions for organization', async () => {
    const mockSessions = [
      {
        id: 1,
        organization_id: 'org_123',
        planning_title: 'PI 25.1',
        status: 'active',
      },
    ];

    (mockPool.query as jest.Mock).mockResolvedValue({
      rows: mockSessions,
    });

    const response = await request(app)
      .get('/api/planning/sessions')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].planning_title).toBe('PI 25.1');
  });

  it('returns empty array for organization with no sessions', async () => {
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const response = await request(app)
      .get('/api/planning/sessions')
      .expect(200);

    expect(response.body.data).toEqual([]);
  });
});
```

## Related Patterns

- [User Context API](../api/user-context-api.md) - APIs to test
- [Admin Context API](../api/admin-context-api.md) - Admin APIs to test
- [Webhook Handler](../api/webhook-handler.md) - Webhook testing

---

**Pattern Source**: `tests/`, Jest + supertest
**Last Updated**: 2026-03
**Validated By**: System Architect
