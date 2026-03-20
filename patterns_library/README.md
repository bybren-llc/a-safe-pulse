# ASP Pattern Library

> **Copy-Paste Ready Code Patterns for Agent-Driven Development**

## Overview

This pattern library provides battle-tested, production-ready code patterns for the ASP codebase. Each pattern is:

- **Copy-Paste Ready** - Minimal customization needed
- **Security Validated** - RLS enforced, auth required, input validated
- **SOLID Compliant** - Follows architectural principles
- **Test Covered** - Includes testing patterns

## Pattern Index

### API Routes

| Pattern                                           | File                                     | Use Case                          |
| ------------------------------------------------- | ---------------------------------------- | --------------------------------- |
| [User Context API](./api/user-context-api.md)     | Authenticated Express API with pg        | User-specific CRUD operations     |
| [Admin Context API](./api/admin-context-api.md)   | Admin-only Express API with elevated permissions | Admin dashboards, management |
| [Webhook Handler](./api/webhook-handler.md)       | Express webhook with HMAC-SHA256 verification | Linear, third-party events   |
| [Zod Validation API](./api/zod-validation-api.md) | Input validation with Zod schemas        | Form submissions, API inputs      |

### Database Operations

| Pattern                                                  | File                              | Use Case             |
| -------------------------------------------------------- | --------------------------------- | -------------------- |
| [RLS Migration](./database/rls-migration.md)             | Raw SQL migration with RLS policies | New data tables    |
| [SQL Transaction](./database/sql-transaction.md)         | pg BEGIN/COMMIT/ROLLBACK pattern  | Complex workflows    |

### Testing

| Pattern                                                   | File                       | Use Case             |
| --------------------------------------------------------- | -------------------------- | -------------------- |
| [API Integration Test](./testing/api-integration-test.md) | Jest + supertest for Express | Endpoint validation |

### Security

| Pattern                                                       | File                              | Use Case                 |
| ------------------------------------------------------------- | --------------------------------- | ------------------------ |
| [Input Sanitization](./security/input-sanitization.md)        | XSS/injection prevention          | User input handling      |
| [Rate Limiting](./security/rate-limiting.md)                  | API rate limiting                  | Abuse prevention         |
| [Secrets Management](./security/secrets-management.md)        | Environment variable management   | Config security          |

### CI/CD

| Pattern                                                       | File                             | Use Case                 |
| ------------------------------------------------------------- | -------------------------------- | ------------------------ |
| [GitHub Actions Workflow](./ci/github-actions-workflow.md)     | Standard CI pipeline             | Automated quality gates  |
| [Deployment Pipeline](./ci/deployment-pipeline.md)             | Staging to production deployment | Release management       |

### Configuration

| Pattern                                                       | File                             | Use Case                 |
| ------------------------------------------------------------- | -------------------------------- | ------------------------ |
| [Environment Config](./config/environment-config.md)           | Typed environment loading        | App configuration        |
| [Structured Logging](./config/structured-logging.md)           | JSON logging with correlation    | Observability            |

### Archived (Upstream Harness Patterns)

These patterns were inherited from the upstream harness template and do not apply to this project's tech stack (Node.js/Express/PostgreSQL -- no frontend UI).

| Pattern | Archive Location | Reason |
| ------- | ---------------- | ------ |
| Authenticated Page | `docs/archive/harness-upstream/patterns-ui/` | No frontend UI in this project |
| Form with Validation | `docs/archive/harness-upstream/patterns-ui/` | No frontend UI in this project |
| Data Table | `docs/archive/harness-upstream/patterns-ui/` | No frontend UI in this project |
| E2E User Flow | `docs/archive/harness-upstream/patterns-testing/` | No browser-based E2E testing |

## How to Use Patterns

### 1. Find the Right Pattern

Use the index above to find a pattern matching your use case.

### 2. Copy the Pattern

Each pattern file contains:

- **What It Does** - Purpose and use case
- **Code Pattern** - Copy-paste ready code
- **Customization Guide** - What to change
- **Security Checklist** - Validation points

### 3. Customize for Your Use Case

Follow the customization guide in each pattern:

- Replace placeholders (marked with `{...}`)
- Update type definitions
- Adjust business logic
- Run validation commands

### 4. Validate

Each pattern includes validation commands:

```bash
npm run build && npm test          # For all patterns
npm test -- --testPathPattern=integration  # For API patterns
```

## Pattern Discovery Protocol

**Before creating new patterns**, check:

1. **This library first** - Use existing patterns when possible
2. **Codebase search** - Look for similar implementations
3. **BSA/Architect** - Propose new patterns for validation

## Pattern Creation Guidelines

When creating new patterns (BSA/Architect only):

### Required Elements

- [ ] Clear use case description
- [ ] Complete, working code example
- [ ] Customization instructions with placeholders
- [ ] Security validation checklist
- [ ] Success validation commands

### Quality Standards

- [ ] RLS enforced (if database operations)
- [ ] Authentication required (if protected)
- [ ] Input validation with Zod
- [ ] Error handling comprehensive
- [ ] TypeScript strict mode compliant

### Documentation Format

```markdown
# Pattern Name

## What It Does

[Clear description of purpose and use case]

## When to Use

- Use case 1
- Use case 2

## Code Pattern

[Complete, copy-paste ready code]

## Customization Guide

1. Replace `{placeholder}` with your value
2. Update type definitions
3. Adjust business logic

## Security Checklist

- [ ] RLS context enforced
- [ ] Auth required
- [ ] Input validated

## Validation

[Commands to verify implementation]
```

## Contributing Patterns

**BSA/System Architect Only**:

1. Discover gap in pattern library
2. Extract pattern from proven implementation
3. Validate with System Architect
4. Document per template above
5. Add to this index

**Execution Agents**:

- Use existing patterns
- Report missing patterns to BSA
- Do NOT create new patterns

## Maintenance

- **Owner**: System Architect
- **Contributors**: BSA (pattern discovery and extraction)
- **Consumers**: All execution agents (FE, BE, QAS, etc.)
- **Update Frequency**: As new patterns emerge from production code

## Pattern Library Evolution

As patterns prove useful:

1. BSA identifies frequently implemented features
2. System Architect validates pattern
3. BSA extracts and documents pattern
4. Pattern added to library
5. Execution agents use pattern for future implementations

---

**Last Updated**: 2026-03
**Active Pattern Count**: 14
**Archived Pattern Count**: 4
**Maintained by**: a-safe-pulse Development Team + System Architect
