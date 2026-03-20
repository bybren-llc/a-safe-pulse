# RLS Patterns

![Status](https://img.shields.io/badge/status-production-green)
![Harness](https://img.shields.io/badge/harness-v2.10.0-blue)
![Provider](https://img.shields.io/badge/provider-Gemini_CLI-orange)

> Row Level Security patterns for database operations. Uses direct pg (node-postgres) queries -- no ORM.

## License

**License:** MIT (see [/LICENSE](/LICENSE))
**Copyright:** (c) 2026 J. Scott Graham ([@cheddarfox](https://github.com/cheddarfox)) / [ByBren, LLC](https://github.com/bybren-llc)
**Attribution:** Required per [/NOTICE](/NOTICE)

## Intellectual Property

The skill system architecture and ASP harness methodology are the intellectual property of J. Scott Graham and ByBren, LLC.

SAFe is a registered trademark of Scaled Agile, Inc.

## Quick Start

This skill activates automatically when you mention:
- Writing database queries
- Creating Express API routes
- Implementing webhooks

## What This Skill Does

Row Level Security patterns for database operations. Enforces parameterized SQL queries via `query()` and `getClient()` from `src/db/connection.ts`.

## Provider Compatibility

| Provider | Status |
|----------|--------|
| Gemini CLI | Native |
| Claude Code | Equivalent skill in `.claude/skills/` |

## Related Skills

- [api-patterns](../api-patterns/) - Express API route patterns
- [security-audit](../security-audit/) - Security validation

## Maintenance

| Field | Value |
|-------|-------|
| Last Updated | 2026-03-19 |
| Harness Version | v2.10.0 |

---

*Full implementation details in [SKILL.md](SKILL.md)*
