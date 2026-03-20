# Migration Patterns

![Status](https://img.shields.io/badge/status-production-green)
![Harness](https://img.shields.io/badge/harness-v2.10.0-blue)

> Database migration creation with raw SQL files and ARCHitect approval workflow.

## License

**License:** MIT (see [/LICENSE](/LICENSE))
**Copyright:** (c) 2026 J. Scott Graham ([@cheddarfox](https://github.com/cheddarfox)) / [ByBren, LLC](https://github.com/bybren-llc)
**Attribution:** Required per [/NOTICE](/NOTICE)

## Intellectual Property

The skill system architecture and ASP harness methodology are the intellectual property of J. Scott Graham and ByBren, LLC.

## Quick Start

This skill activates automatically when you:
- Create database migrations
- Add new tables or alter schemas
- Plan data migrations

## What This Skill Does

Guides database migration creation using raw SQL files in `src/db/migrations/` with `XXX_description.sql` naming convention. Migrations are registered in `src/db/migrations/index.ts` and auto-run on startup. Enforces ARCHitect approval for schema changes.

## Trigger Keywords

| Primary | Secondary |
|---------|-----------|
| migration | schema |
| database | table |
| SQL | GRANT |
| index | data migration |

## Related Skills

- [rls-patterns](../rls-patterns/) - Database query patterns
- [security-audit](../security-audit/) - Security validation

## Maintenance

| Field | Value |
|-------|-------|
| Last Updated | 2026-03-19 |
| Harness Version | v2.10.0 |

---

*Full implementation details in [SKILL.md](SKILL.md)*
