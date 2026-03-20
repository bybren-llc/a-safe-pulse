---
name: testing-patterns
description: >
  Testing patterns for Jest unit and integration tests. Use when writing tests,
  setting up test fixtures, or validating implementations. Jest only -- no
  no E2E framework. Tests live in `tests/` directory.
---

# Testing Patterns Skill

> **TEMPLATE**: This skill uses `{{PLACEHOLDER}}` tokens. Replace with your project values before use.

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
npx jest tests/specific-file.test.ts  # Run a single test file
npx jest --testPathPattern="keyword"  # Run tests matching pattern
npm test -- --coverage                # Run with coverage
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
└── setup.ts           # Global test setup (if any)
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

**Coverage** (if applicable):
- Branches: X% (threshold: 70%)
- Functions: X% (threshold: 80%)
- Lines: X% (threshold: 80%)
- Statements: X% (threshold: 80%)

**Commands Run:**
```bash
npm test -- --coverage
```
```

## Reference

- **Jest Config**: `jest.config.js`
- **Test Directory**: `tests/`
- **Pattern Library**: `patterns_library/testing/`
