# Migration Patterns

![Status](https://img.shields.io/badge/status-production-green)
![Harness](https://img.shields.io/badge/harness-v2.10.0-blue)
![Provider](https://img.shields.io/badge/provider-Gemini_CLI-orange)

> Database migration creation with raw SQL files and ARCHitect approval workflow. Files in `src/db/migrations/` with `XXX_description.sql` naming.

## License

**License:** MIT (see [/LICENSE](/LICENSE))
**Copyright:** (c) 2026 J. Scott Graham ([@cheddarfox](https://github.com/cheddarfox)) / [ByBren, LLC](https://github.com/bybren-llc)
**Attribution:** Required per [/NOTICE](/NOTICE)

## Intellectual Property

The skill system architecture and ASP harness methodology are the intellectual property of J. Scott Graham and ByBren, LLC.

SAFe is a registered trademark of Scaled Agile, Inc.

## Quick Start

This skill activates automatically when you mention:
- Creating database migrations
- Adding tables
- Altering schemas

## What This Skill Does

Database migration creation with raw SQL files and ARCHitect approval workflow. Auto-run on startup via `src/db/migrations/index.ts`.

## Provider Compatibility

| Provider | Status |
|----------|--------|
| Gemini CLI | Native |
| Claude Code | Equivalent skill in `.claude/skills/` |

## Related Skills

- [rls-patterns](../rls-patterns/) - Database query patterns
- [api-patterns](../api-patterns/) - Schema changes

## Maintenance

| Field | Value |
|-------|-------|
| Last Updated | 2026-03-19 |
| Harness Version | v2.10.0 |

---

*Full implementation details in [SKILL.md](SKILL.md)*
