---
name: pattern-discovery
description: Pattern library discovery for pattern-first development. Use BEFORE implementing any new feature, creating API routes, or adding database operations. Ensures existing patterns are checked first before writing new code.
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---

# Pattern Discovery Skill

## Purpose

Enforce pattern-first development by checking the Pattern library before implementing new functionality. This reduces code duplication, ensures consistency, and leverages battle-tested solutions.

## When to Use

Invoke this skill when:

- About to create a new API route
- About to add database operations
- About to write integration tests
- User asks "how do I implement..." or "how should I build..."
- Starting work on any feature implementation

## Pattern Discovery Protocol

**ALWAYS follow this sequence before writing new code:**

### Step 1: Check Pattern Library

Search `patterns_library/` for existing patterns:

```bash
ls patterns_library/api/      # API route patterns
ls patterns_library/database/  # Database operation patterns
ls patterns_library/testing/   # Testing patterns
ls patterns_library/security/  # Security patterns
ls patterns_library/ci/        # CI/CD patterns
ls patterns_library/config/    # Configuration patterns
```

### Step 2: Review Pattern Index

Check `patterns_library/README.md` for the complete pattern index:

| Category | Patterns Available |
| -------- | ------------------ |
| API | User Context, Admin Context, Webhook Handler, Zod Validation |
| Database | RLS Migration, SQL Transaction |
| Testing | API Integration Test |
| Security | Input Sanitization, Rate Limiting, Secrets Management |
| CI | GitHub Actions Workflow, Deployment Pipeline |
| Config | Environment Config, Structured Logging |

### Step 3: Apply or Escalate

**If pattern exists:**

1. Read the pattern file
2. Copy the code pattern
3. Follow the customization guide
4. Run validation commands

**If pattern is missing:**

1. Search codebase for similar implementations
2. If found, consider extracting as new pattern (BSA/ARCHitect only)
3. If not found, implement from scratch following existing conventions
4. Report pattern gap to BSA for future extraction

## Pattern Library Structure

```
patterns_library/
├── README.md                  # Pattern index and usage guide
├── api/
│   ├── user-context-api.md
│   ├── admin-context-api.md
│   ├── webhook-handler.md
│   └── zod-validation-api.md
├── database/
│   ├── rls-migration.md
│   └── sql-transaction.md
├── testing/
│   └── api-integration-test.md
├── security/
│   ├── input-sanitization.md
│   ├── rate-limiting.md
│   └── secrets-management.md
├── ci/
│   ├── github-actions-workflow.md
│   └── deployment-pipeline.md
└── config/
    ├── environment-config.md
    └── structured-logging.md
```

**Archived patterns** (upstream reference, not active):
- `docs/archive/harness-upstream/patterns-ui/` — React/Next.js UI patterns
- `docs/archive/harness-upstream/patterns-testing/e2e-user-flow.md` — Playwright E2E

## Pattern Matching Guide

| If you need to... | Use this pattern |
| ---------------------------------- | --------------------------------- |
| Create authenticated API endpoint | `api/user-context-api.md` |
| Create admin-only API endpoint | `api/admin-context-api.md` |
| Handle external webhooks | `api/webhook-handler.md` |
| Validate API input with Zod | `api/zod-validation-api.md` |
| Add new table with RLS | `database/rls-migration.md` |
| Run multi-step DB operations | `database/sql-transaction.md` |
| Test API endpoints | `testing/api-integration-test.md` |
| Sanitize user input | `security/input-sanitization.md` |
| Add API rate limiting | `security/rate-limiting.md` |
| Manage secrets/env vars | `security/secrets-management.md` |
| Set up CI/CD pipeline | `ci/github-actions-workflow.md` |
| Configure deployment stages | `ci/deployment-pipeline.md` |
| Load environment configuration | `config/environment-config.md` |
| Add structured logging | `config/structured-logging.md` |

## Security Requirements

All patterns enforce:

- **RLS Context** - Database operations use `withUserContext`, `withAdminContext`, or `withSystemContext`
- **Authentication** - Protected routes verify auth before processing
- **Input Validation** - All inputs validated with Zod schemas
- **Error Handling** - Comprehensive error handling with proper status codes

## Validation Commands

After applying a pattern, run:

```bash
npm test && npm run build
```

## Authoritative Reference

- **Pattern Index**: `patterns_library/README.md`
- **RLS Patterns**: See `rls-patterns` skill for database security
