---
description: "Testing rules for Jest, unit and integration tests, and coverage thresholds."
globs: "tests/**/*.ts,tests/**/*.test.ts,tests/**"
alwaysApply: false
---

# Testing Rules

These rules apply when writing or modifying tests.

## Testing Stack

- **Framework**: Jest with TypeScript support
- **Coverage**: Built-in Jest coverage (`--coverage`)
- **Runner**: `npm test`

## Test Organization

```
tests/
  unit/           # Fast, isolated unit tests
  integration/    # API and database integration tests
```

## Running Tests

```bash
# All tests
npm test

# Single test file
npx jest tests/specific-file.test.ts

# Tests matching a pattern
npx jest --testPathPattern="keyword"

# With coverage
npx jest --coverage

# Full CI validation
npm test && npm run build
```

## Coverage Thresholds

These thresholds are enforced in Jest configuration:

| Metric      | Minimum |
|-------------|---------|
| Branches    | 70%     |
| Functions   | 80%     |
| Lines       | 80%     |
| Statements  | 80%     |

## Test Patterns

### API Integration Tests

See `patterns_library/testing/api-integration-test.md` for the full pattern.

Key points:
- Mock authentication for isolated testing
- Verify RLS context is used (no direct query calls)
- Test both success and error paths
- Test authentication failures (401)
- Test authorization failures (403)
- Test input validation errors (400/422)

## Writing Good Tests

1. **Independent**: Tests must not depend on execution order
2. **Repeatable**: Same result every time, no flaky tests
3. **Clear naming**: `describe('module') > it('should do X when Y')`
4. **Arrange-Act-Assert**: Follow the AAA pattern
5. **Edge cases**: Cover boundary conditions, empty states, error paths
6. **RLS isolation**: Verify user A cannot access user B's data

## Coverage Requirements

- Business logic: Aim for high coverage
- API endpoints: All routes should have integration tests
- Security paths: Authentication and authorization MUST be tested
- Error handling: All error responses MUST be tested

## Acceptance Criteria Verification

When testing a spec, map each acceptance criterion to at least one test:

```typescript
// From spec: "User can create new resource"
it('should create a resource for an authenticated user', async () => {
  // ...
});

// From spec: "Validation shows errors for invalid input"
it('should return 422 for invalid input', async () => {
  // ...
});

// From spec: "Unauthorized access returns 401"
it('should return 401 for unauthenticated requests', async () => {
  // ...
});
```

## Key References

- `patterns_library/testing/` -- Test patterns (copy-paste ready)
- `AGENTS.md` -- QAS role definition and validation commands
- `CONTRIBUTING.md` -- CI pipeline test stages
