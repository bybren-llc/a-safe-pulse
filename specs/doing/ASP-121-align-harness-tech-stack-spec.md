# ASP-121: Align SAW Harness with a-safe-pulse Tech Stack

## Phase 0 — Inventory Spec

**Linear**: [ASP-121](https://linear.app/cheddarfox/issue/ASP-121)
**Status**: Phase 0 complete — inventory gate passed
**Author**: Claude Opus 4.6 (agent)
**Reviewer**: Scott Graham (@cheddarfox)

---

## Context

The SAW harness v2.10.0 was adopted from a generic full-stack SaaS template. **102 files** reference technologies not in this project's stack. This spec inventories every affected file and assigns it to a story-sized PR for remediation.

### Actual Tech Stack
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js / TypeScript |
| Framework | Express |
| Database | PostgreSQL (raw SQL migrations in `src/db/migrations/`) |
| Dev DB | SQLite (`SQLITE_DB_PATH`) |
| ORM | None (direct `pg` queries) |
| Auth | Custom OAuth 2.0 (Linear + Confluence) in `src/auth/` |
| Testing | Jest only |
| Package manager | npm |
| Interface | CLI tool + API server (no frontend) |
| Payments | None |
| Analytics | None |
| Cache | None |

### Wrong Tech to Remove/Rewrite
`yarn`, `Prisma`, `Playwright`, `Next.js`, `React`, `Clerk`, `shadcn`, `Stripe`, `PostHog`, `Redis`, `Python`, `FastAPI`, `Alembic`, `SQLAlchemy`, `pytest`, `ruff`, `mypy`

### Architectural Constraints
- **Skill names stay stable** — rewrite contents, no renames
- **RLS is first-class** — current state + target architecture, not "future consideration"
- **fe-developer role**: mark dormant, don't remove
- **SAFe workflow sections preserved** in every file
- **Archive** upstream reference material, don't delete
- **Agent Teams**: separate rollout, keep off

---

## Inventory Matrix

### Legend
- **Bucket**: `AC` = active-contract, `OPT` = optional, `ARC` = archive
- **Status**: `NEEDS_EDIT` or `CLEAN`
- **Wrong Tech**: what specific references need fixing

---

### Story 1: Active Workflow Contracts (~12 files)

| File | Bucket | Wrong Tech |
|------|--------|-----------|
| `CONTRIBUTING.md` | AC | yarn (42 matches), Prisma migrations, Stripe test keys, Redis, Playwright/E2E |
| `AGENTS.md` | AC | Prisma in DE tools, Playwright in QAS tools, Prisma migrate command |
| `.claude/commands/audit-deps.md` | AC | yarn |
| `.claude/commands/local-sync.md` | AC | yarn, yarn.lock |
| `.claude/commands/pre-pr.md` | AC | yarn |
| `.claude/commands/quick-fix.md` | AC | yarn |
| `.claude/commands/update-docs.md` | AC | yarn |
| `.claude/commands/remote-logs.md` | AC | yarn/Prisma ref |
| `.claude/commands/search-pattern.md` | AC | Prisma ref |
| `.gemini/commands/audit-deps.toml` | AC | yarn |
| `.gemini/commands/local/sync.toml` | AC | yarn |
| `.gemini/commands/workflow/pre-pr.toml` | AC | yarn |
| `.gemini/commands/workflow/quick-fix.toml` | AC | yarn |
| `.gemini/commands/workflow/update-docs.toml` | AC | yarn |
| `.gemini/commands/remote/logs.toml` | AC | yarn/Prisma ref |
| `.gemini/commands/search-pattern.toml` | AC | Prisma ref |
| `.gemini/commands/media/sketch-to-code.toml` | OPT | Next.js/React ref |
| `.gemini/GEMINI.md` | AC | frontend-patterns, shadcn, Next.js listed |

**Total**: ~18 files

---

### Story 2: Agent Definition Rewrites (~15 files)

#### Claude agents (10 files — rte.md excluded, already clean):
| File | Wrong Tech |
|------|-----------|
| `.claude/agents/be-developer.md` | yarn, Prisma, Clerk, Next.js |
| `.claude/agents/bsa.md` | yarn, lists "Next.js, Prisma, Clerk, Stripe, PostHog" as stack |
| `.claude/agents/data-engineer.md` | yarn, Prisma migrate |
| `.claude/agents/data-provisioning-eng.md` | yarn, Prisma |
| `.claude/agents/fe-developer.md` | yarn, entire file assumes Next.js/Clerk/shadcn (mark dormant) |
| `.claude/agents/qas.md` | yarn, Playwright, shadcn |
| `.claude/agents/security-engineer.md` | yarn |
| `.claude/agents/system-architect.md` | yarn, Clerk auth ref |
| `.claude/agents/tdm.md` | yarn |
| `.claude/agents/tech-writer.md` | yarn |

#### Codex agents (5 files — 6 excluded, already clean):
| File | Wrong Tech |
|------|-----------|
| `.codex/agents/be-developer.toml` | Prisma, direct prisma calls |
| `.codex/agents/data-engineer.toml` | Prisma migrations |
| `.codex/agents/data-provisioning-eng.toml` | Prisma |
| `.codex/agents/fe-developer.toml` | Next.js/Playwright (mark dormant) |
| `.codex/agents/security-engineer.toml` | Prisma/RLS ORM refs |

#### Also:
| File | Wrong Tech |
|------|-----------|
| `.codex/config.toml` | Prisma ref in context |

---

### Story 3: Skill Content Rewrites (~35 files)

#### Must-Fix (active-contract, wrong tech in guidance):

| Skill | Files (×3 providers) | Wrong Tech |
|-------|---------------------|-----------|
| `rls-patterns` | `.agents/`, `.claude/skills/`, `.gemini/skills/` (5 files) | Prisma ORM, NextResponse |
| `testing-patterns` | 5 files | Playwright E2E, Prisma fixtures |
| `migration-patterns` | 5 files | Prisma, Alembic |
| `api-patterns` | 5 files | NextResponse, Clerk, Prisma, Next.js App Router |

#### Should-Fix (rewrite to dormant stub):

| Skill | Files (×3 providers) | Action |
|-------|---------------------|--------|
| `stripe-patterns` | 5 files | Rewrite to `<!-- STATUS: DORMANT -->` stub |
| `frontend-patterns` | 5 files | Rewrite to `<!-- STATUS: DORMANT -->` stub |

#### Needs yarn→npm (semantic, per-file):

| File | Provider |
|------|---------|
| `.claude/skills/agent-coordination/SKILL.md` | Claude |
| `.claude/skills/confluence-docs/SKILL.md` | Claude |
| `.claude/skills/deployment-sop/SKILL.md` | Claude |
| `.claude/skills/git-advanced/SKILL.md` | Claude |
| `.claude/skills/orchestration-patterns/SKILL.md` | Claude |
| `.claude/skills/pattern-discovery/SKILL.md` | Claude |
| `.claude/skills/release-patterns/SKILL.md` + `README.md` | Claude |
| `.claude/skills/safe-workflow/SKILL.md` | Claude |
| `.claude/skills/security-audit/SKILL.md` | Claude |
| `.claude/skills/spec-creation/SKILL.md` | Claude |
| `.gemini/skills/deployment-sop/SKILL.md` | Gemini |
| `.gemini/skills/git-advanced/SKILL.md` | Gemini |
| `.gemini/skills/orchestration-patterns/SKILL.md` | Gemini |
| `.gemini/skills/security-audit/SKILL.md` | Gemini |

#### Also update indexes:
| File | Wrong Tech |
|------|-----------|
| `.claude/skills/README.md` | Playwright, Next.js/Clerk/shadcn, Stripe refs |
| `.gemini/skills/README.md` | Same |

---

### Story 4: Pattern Library Rewrites + Archive (~15 files)

#### Rewrite for actual tech:
| File | Wrong Tech |
|------|-----------|
| `patterns_library/api/user-context-api.md` | NextResponse, Clerk, Prisma |
| `patterns_library/api/admin-context-api.md` | NextResponse, Clerk, Prisma |
| `patterns_library/api/webhook-handler.md` | NextResponse, Prisma |
| `patterns_library/api/zod-validation-api.md` | NextResponse, Prisma |
| `patterns_library/database/prisma-transaction.md` | Prisma → rewrite as raw SQL transactions |
| `patterns_library/database/rls-migration.md` | Prisma → rewrite as raw SQL RLS |
| `patterns_library/testing/api-integration-test.md` | NextResponse, Clerk mocks |
| `patterns_library/security/input-sanitization.md` | Minor Prisma refs |
| `patterns_library/security/rate-limiting.md` | Minor Prisma refs |
| `patterns_library/security/secrets-management.md` | Stripe key refs |
| `patterns_library/ci/github-actions-workflow.md` | yarn, Prisma |
| `patterns_library/ci/deployment-pipeline.md` | yarn |
| `patterns_library/config/structured-logging.md` | Prisma ref |

#### Archive (move to `docs/archive/harness-upstream/`):
| File | Destination |
|------|------------|
| `patterns_library/ui/authenticated-page.md` | `docs/archive/harness-upstream/patterns-ui/` |
| `patterns_library/ui/form-with-validation.md` | `docs/archive/harness-upstream/patterns-ui/` |
| `patterns_library/ui/data-table.md` | `docs/archive/harness-upstream/patterns-ui/` |
| `patterns_library/testing/e2e-user-flow.md` | `docs/archive/harness-upstream/patterns-testing/` |

#### Update index + repair inbound refs:
| File | Action |
|------|--------|
| `patterns_library/README.md` | Update counts, note archived patterns, fix yarn refs |

---

### Story 5: Cursor Rules Alignment (~10 files)

#### Rewrite:
| File | Wrong Tech |
|------|-----------|
| `.cursor/rules/12-database-sql.mdc` | Alembic, SQLAlchemy, Prisma |
| `.cursor/rules/13-testing.mdc` | pytest |
| `.cursor/rules/21-agent-backend.mdc` | pytest, ruff, mypy, FastAPI |

#### Edit:
| File | Wrong Tech |
|------|-----------|
| `.cursor/rules/01-git-workflow.mdc` | Stripe commit example |
| `.cursor/rules/02-pattern-discovery.mdc` | Prisma reference |
| `.cursor/rules/22-agent-qas.mdc` | Prisma ref |
| `.cursor/rules/30-background-agents.mdc` | Prisma ref |
| `.cursor/rules/README.md` | Deleted rule refs, wrong tech descriptions |

#### Move out of active path:
| File | Destination |
|------|------------|
| `.cursor/rules/10-backend-python.mdc` | `docs/archive/harness-upstream/cursor-rules/` |
| `.cursor/rules/11-frontend-react.mdc` | `docs/archive/harness-upstream/cursor-rules/` |
| `.cursor/rules/16-stripe-payments.mdc` | `docs/archive/harness-upstream/cursor-rules/` |

---

### Story 6: Agent Teams Rollout Prep (~2 files)

| File | Action |
|------|--------|
| `.claude/settings.template.json` | Keep `AGENT_TEAMS: "0"` — no change |
| `docs/guides/AGENT-TEAMS-ROLLOUT.md` | New file: readiness criteria, opt-in docs |

---

## Non-Goals

- No application source code changes (`src/`, `tests/`)
- No new features or capabilities
- No changes to `.claude/team-config.json` (already clean)
- No changes to `.claude/hooks-config.json` (already clean)
- No renaming of skill directory names
- No removal of SAFe workflow sections from any file

## Acceptance Criteria

- [ ] Zero `yarn`, `Prisma` (as ORM), `Playwright`, `NextResponse`, `Alembic`, `pytest` in active surfaces
- [ ] Dormant skills use standard `<!-- STATUS: DORMANT -->` header
- [ ] Archived files moved to `docs/archive/harness-upstream/`, not deleted
- [ ] No dangling references to moved/archived files
- [ ] `npm test && npm run build` passes after each story
- [ ] Each story is an independent PR with targeted verification
- [ ] SAFe workflow sections unchanged in all edited files
- [ ] RLS treated as first-class architectural concern in all rewrites
