---
name: testing-patterns
description: Testing patterns for Jest unit and integration tests. Use when writing tests, setting up test fixtures, or validating implementations. Jest only -- tests in `tests/` directory.
allowed-tools: Read, Bash, Grep, Glob
---

# Testing Patterns Skill

## Purpose

Guide consistent and effective testing. Routes to existing test patterns and provides evidence templates for Linear.

## When This Skill Applies

Invoke this skill when:

- Writing new unit tests
- Creating integration tests
- Setting up test fixtures
- Running test suites
- Packaging test evidence for Linear

## Critical Rules

### FORBIDDEN Patterns

```typescript
// FORBIDDEN: Shared test state (causes flaky tests)
let sharedUser: any;
beforeAll(() => { sharedUser = createUser(); });

// FORBIDDEN: Hard-coded IDs (test pollution)
const userId = "user-123";

// FORBIDDEN: Missing cleanup (leaky tests)
it("creates record", async () => {
  await createTestRecord();
  // No cleanup!
});
```

### CORRECT Patterns

```typescript
// CORRECT: Isolated test state per test
beforeEach(() => {
  const testUser = createTestUser();
});

// CORRECT: Unique identifiers
const userId = `user-${crypto.randomUUID()}`;
const email = `test-${Date.now()}@example.com`;

// CORRECT: Proper cleanup
afterEach(async () => {
  await cleanupTestRecords();
});
```

## Test Directory Structure

```
tests/
├── unit/              # Fast, isolated tests
│   ├── services/      # Service layer tests
│   └── utils/         # Utility function tests
├── integration/       # API and database tests
└── setup.ts           # Global test setup (if any)
```

## Configuration Files

- **Jest Config**: `jest.config.js`
- **TypeScript Config**: `tsconfig.json` (includes `tests/`)

## Coverage Thresholds

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 70%       |
| Functions  | 80%       |
| Lines      | 80%       |
| Statements | 80%       |

## Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx jest tests/specific-file.test.ts

# Run tests matching a pattern
npx jest --testPathPattern="keyword"

# Run with coverage
npm test -- --coverage
```

## Common Patterns

### Service Layer Testing

```typescript
import { SomeService } from '../../src/services/some-service';

describe('SomeService', () => {
  let service: SomeService;

  beforeEach(() => {
    service = new SomeService();
  });

  it('should process data correctly', () => {
    const result = service.process({ input: 'test' });
    expect(result).toHaveProperty('output');
    expect(result.output).toBe('expected');
  });
});
```

### Express API Route Testing

```typescript
import request from 'supertest';
import express from 'express';

describe('GET /api/health', () => {
  const app = express();
  // Set up routes...

  it('returns 200 with health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
  });
});
```

### Mocking Database Queries

```typescript
jest.mock('../../src/db/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

import { query } from '../../src/db/connection';

describe('with mocked database', () => {
  it('should query with correct parameters', async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, name: 'test' }],
      rowCount: 1,
    });

    // Call the function under test...

    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM sessions WHERE org_id = $1',
      ['org-123']
    );
  });
});
```

### Test Isolation

Use unique identifiers to prevent test pollution:

```typescript
const uniqueId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const uniqueEmail = `test-${Date.now()}@example.com`;
```

## Evidence Template for Linear

When completing test work, attach this evidence block:

```markdown
**Test Execution Evidence**

**Test Suite**: [unit/integration]
**Files Changed**: [list files]

**Test Results:**

- Total Tests: [X]
- Passed: [X]
- Failed: [0]
- Skipped: [X]

**Coverage** (if applicable):

- Statements: X% (threshold: 80%)
- Branches: X% (threshold: 70%)
- Functions: X% (threshold: 80%)
- Lines: X% (threshold: 80%)

**Commands Run:**

\`\`\`bash
npm test -- --coverage
\`\`\`

**Output:**
[Paste relevant test output]
```

## Pre-Push Validation

Always run before pushing:

```bash
npm test && npm run build && echo "Ready for PR" || echo "Fix issues first"
```

## Authoritative References

- **Jest Config**: `jest.config.js`
- **Test Directory**: `tests/`
- **CI Validation**: `package.json` scripts
- **CLAUDE.md**: Coverage thresholds documented
