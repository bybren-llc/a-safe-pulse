# RLS Patterns

![Status](https://img.shields.io/badge/status-production-green)
![Harness](https://img.shields.io/badge/harness-v2.10.0-blue)

> Row Level Security patterns for database operations. Uses direct pg (node-postgres) queries -- no ORM.

## License

**License:** MIT (see [/LICENSE](/LICENSE))
**Copyright:** (c) 2026 J. Scott Graham ([@cheddarfox](https://github.com/cheddarfox)) / [ByBren, LLC](https://github.com/bybren-llc)
**Attribution:** Required per [/NOTICE](/NOTICE)

## Intellectual Property

The skill system architecture and ASP harness methodology are the intellectual property of J. Scott Graham and ByBren, LLC.

## Quick Start

This skill activates automatically when you:
- Write any database query via `query()` or `getClient()`
- Create or modify Express API routes that access the database
- Implement webhook handlers
- Work with organization-scoped data

## What This Skill Does

Enforces data isolation patterns for all database operations. All queries MUST use parameterized SQL (`$1`, `$2`, etc.) via the `query()` and `getClient()` helpers in `src/db/connection.ts`. Documents current application-level isolation and target PostgreSQL RLS architecture.

## Trigger Keywords

| Primary | Secondary |
|---------|-----------|
| database | query |
| SQL | pg |
| connection | transaction |
| data isolation | parameterized |

## Related Skills

- [api-patterns](../api-patterns/) - Express API route implementation
- [security-audit](../security-audit/) - Security validation
- [migration-patterns](../migration-patterns/) - Database schema changes

## Maintenance

| Field | Value |
|-------|-------|
| Last Updated | 2026-03-19 |
| Harness Version | v2.10.0 |

---

*Full implementation details in [SKILL.md](SKILL.md)*
