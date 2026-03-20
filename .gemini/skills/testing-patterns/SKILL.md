---
name: testing-patterns
description: Testing patterns for Jest unit and integration tests. Use when writing tests, setting up test fixtures, or validating implementations. Jest only -- tests in `tests/` directory.
---

# Testing Patterns Skill

## Purpose

Guide consistent and effective testing. Routes to existing test patterns and provides evidence templates.

## When This Skill Applies

- Writing unit or integration tests
- Setting up test fixtures
- Running test suites
- Packaging test evidence

## Critical Rules

### FORBIDDEN

```typescript
// Shared test state causes flaky tests
let sharedData: any;
beforeAll(() => { sharedData = createData(); });

// Hard-coded IDs cause test pollution
const userId = "user-123";
```

### CORRECT

```typescript
// Isolated test state per test
beforeEach(() => {
  const testData = createTestData();
});

// Unique identifiers
const userId = `user-${crypto.randomUUID()}`;
```

## Test Commands

```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode
npx jest tests/specific-file.test.ts  # Single file
npx jest --testPathPattern="keyword"  # Pattern match
npm test -- --coverage                # With coverage
```

## Coverage Thresholds

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 70%       |
| Functions  | 80%       |
| Lines      | 80%       |
| Statements | 80%       |

## Test Directory Structure

```
tests/
├── unit/              # Fast, isolated tests
├── integration/       # API and database tests
└── setup.ts           # Global setup
```

## Evidence Template

```markdown
**Test Execution Evidence**

**Test Suite**: [unit/integration]
**Files Changed**: [list files]

**Test Results:**
- Total Tests: [X]
- Passed: [X]
- Failed: [0]

**Commands Run:**
```bash
npm test -- --coverage
```
```

## Reference

- **Jest Config**: `jest.config.js`
- **Test Directory**: `tests/`
