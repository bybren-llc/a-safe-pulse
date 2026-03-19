# CLAUDE.md

## AI Assistant Context for SAFe Multi-Agent Development

**Repository**: a-safe-pulse
**Methodology**: SAFe (Scaled Agile Framework) Agentic Workflow
**Philosophy**: "Round Table" - Equal voice, mutual respect, shared responsibility

---

## Quick Start

This is a **SAFe multi-agent development project** with 11 specialized AI agents working collaboratively. You are part of a team where your input has equal weight with human contributors.

**Core Principles**:
- Search for existing patterns before creating new ones ("Search First, Reuse Always")
- Attach evidence to Linear tickets for all work
- You have "stop-the-line" authority for architectural/security concerns
- Follow SAFe methodology: Epic → Feature → Story → Enabler

**Key Resources**:
- [AGENTS.md](AGENTS.md) - All 11 agent roles, invocation patterns, capabilities
- [CONTRIBUTING.md](CONTRIBUTING.md) - Git workflow, commit standards, PR process
- [docs/onboarding/](docs/onboarding/) - Setup guides and daily workflows
- [docs/guides/ROUND-TABLE-PHILOSOPHY.md](docs/guides/ROUND-TABLE-PHILOSOPHY.md) - Collaboration principles
- [patterns_library/](patterns_library/) - Reusable code patterns (18+ patterns, 7 categories)

---

## Commands

### Development

- `npm run dev` - Start development server with hot reload (nodemon + ts-node)
- `npm run build` - Build TypeScript for production (uses `tsconfig.prod.json`, excludes tests)
- `npm run build:dev` - Build TypeScript including tests (uses `tsconfig.json`)
- `npm start` - Run the built application (`dist/index.js`)

### Testing

- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npx jest tests/specific-file.test.ts` - Run a single test file
- `npx jest --testPathPattern="keyword"` - Run tests matching a pattern
- Coverage thresholds: 70% branches, 80% functions/lines/statements

### CLI Operations

- `npm run cli` - Run the CLI with TypeScript directly
- `npm run cli:build` - Build CLI and make executable
- `npm run parse -- --confluence-url="URL"` - Parse Confluence document
- `npm run create -- --confluence-url="URL" --org-id="ID" --team-id="ID"` - Create Linear issues
- `npm run sync:start -- --org-id="ID" --team-id="ID" --confluence-url="URL"` - Start synchronization
- `npm run sync:status` / `sync:trigger` / `sync:stop` - Manage synchronization (same flags)

### Docker

- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start containers (PostgreSQL + App)
- `npm run docker:down` - Stop containers

---

## Architecture

### Technology Stack

- **Backend**: Node.js / Express / TypeScript
- **Database**: PostgreSQL (prod) / SQLite (dev)
- **Authentication**: OAuth 2.0 (Linear + Confluence)

### Core System Design

A Linear Planning Agent that integrates Linear with Confluence following SAFe (Scaled Agile Framework) methodology. Two main interfaces:

1. **CLI Tool** (`src/cli/index.ts`): Commander.js-based CLI for parsing, creating, and syncing. Outputs JSON for agent-to-agent workflows.
2. **Web Server** (`src/index.ts`): Express app providing OAuth flows, webhook endpoints, and API routes.

### Repository Structure

```
a-safe-pulse/
├── CLAUDE.md                    # This file - AI assistant context
├── AGENTS.md                    # Agent team quick reference
├── CONTRIBUTING.md              # Git workflow and commit standards
├── src/                         # Application source code
├── tests/                       # Test files
├── docs/                        # Documentation (onboarding, database, security, sop, workflow)
├── specs/                       # SAFe specifications (Epic/Feature/Story)
├── patterns_library/            # Reusable code patterns (7 categories)
├── .claude/                     # Claude Code harness (hooks, commands, skills, agents)
├── .gemini/                     # Gemini CLI harness
├── .codex/                      # Codex CLI harness
├── .cursor/                     # Cursor IDE rules
├── .agents/                     # Shared cross-provider skills
├── dark-factory/                # Remote agent team infrastructure (optional)
└── scripts/                     # Utility scripts
```

### Major Modules

#### Authentication (`src/auth/`)
OAuth 2.0 flows for both Linear and Confluence. Tokens are encrypted with AES-256-CBC before database storage. Key detail: **Linear OAuth must complete before Confluence OAuth** because the Confluence flow requires the `organizationId` created during the Linear flow.

#### Agent System (`src/agent/`) — ~45 files
Autonomous agent that responds to Linear events. The `@saafepulse` mention in Linear triggers command parsing and execution.
- **Behavior registry** (`behavior-registry.ts`) — Global registry for enabled behaviors, initialized on startup if `LINEAR_ACCESS_TOKEN` is set
- **Command pipeline**: `command-parser.ts` → `parameter-extractor.ts` → `parameter-validator.ts` → `parameter-translator.ts` → `cli-executor.ts`
- **Autonomous behaviors** (in `behaviors/`): story monitoring, ART health, dependency detection, workflow automation, anomaly detection, periodic reporting
- **Response system**: Template-based response generation with agent personality

#### Webhook System (`src/webhooks/`)
Processes Linear webhook events. Verification uses HMAC-SHA256 with timestamp validation (5-minute window, timing-safe comparison). Event types: `AppUserNotification`, `Issue`, `Comment`, `IssueLabel`. Six specialized processors handle assignment, status changes, mentions, comment mentions, reactions, and new comments.

#### SAFe Framework (`src/safe/`) — ~40 files
Full SAFe implementation. Key subsystems:
- **Hierarchy**: Epic → Feature → Story/Enabler with validation and synchronization
- **PI Planning**: Program Increment planning with ART iteration allocation
- **Story Decomposition**: Breaks large stories into implementable sub-stories
- **Dependency Mapping**: Automated dependency identification with topological sorting
- **WSJF Scoring**: Weighted Shortest Job First prioritization
- **Capacity Management**: Multi-factor team capacity modeling and iteration allocation
- **Value Delivery**: 5-stream taxonomy analysis and 4-gate quality validation pipeline

#### Planning System (`src/planning/`)
Orchestrates the parse → create → sync pipeline. Extracts planning data from Confluence documents into `PlanningDocument` interfaces, then creates Linear issues with proper SAFe hierarchy.

#### Linear Integration (`src/linear/`)
`LinearClientWrapper` built on `@linear/sdk` with retry logic (exponential backoff) and rate limiting. Includes issue creation, update, search, and planning-to-Linear mapping.

#### Confluence Integration (`src/confluence/`)
`ConfluenceClient` with OAuth and automatic token refresh. Parses Confluence pages using cheerio/jsdom, handles macros, and extracts structured planning content.

#### Synchronization (`src/sync/`)
Bidirectional sync between Linear and Confluence with change detection and conflict resolution.

#### Database (`src/db/`)
Dual database support:
- **PostgreSQL** (`DATABASE_URL`) — Primary storage in Docker deployment
- **SQLite** (`SQLITE_DB_PATH`) — Local development and sync state

Migrations in `src/db/migrations/` (7 files, `001`-`007`). Schema: `linear_tokens`, `confluence_tokens`, `planning_sessions`, `planning_features`, `planning_stories`, `planning_enablers`, `program_increments`, sync tables.

#### Monitoring (`src/monitoring/`)
Health monitoring, operational health, resource monitoring, and budget monitoring. Health endpoint at `GET /api/health`.

#### Notifications (`src/utils/operational-notification-coordinator.ts`)
Coordinates Slack notifications for planning updates, workflow status, alerts, and errors. Uses Slack incoming webhooks.

### Web Server Routes

- `GET /auth`, `GET /auth/callback` — Linear OAuth
- `GET /auth/confluence`, `GET /auth/confluence/callback` — Confluence OAuth
- `POST /webhook` — Linear webhook handler
- `POST /webhook/behaviors` — Behavior webhook handler
- `GET /api/planning/*` — Planning API
- `GET /api/health/*` — Health check API

### Data Flow

1. **Parse**: Confluence document → `ConfluenceClient` → `parser.ts` / `content-extractor.ts` → `PlanningDocument` interface
2. **Create**: `PlanningDocument` → `linear-issue-creator.ts` → Linear issues with SAFe hierarchy (Epic → Feature → Story/Enabler)
3. **Sync**: `sync-manager.ts` orchestrates bidirectional monitoring → `change-detector.ts` identifies changes → `conflict-resolver.ts` handles conflicts
4. **Webhook**: Linear event → HMAC verification → processor routing → behavior registry → notification coordinator → Slack

### Error Handling Patterns

- Structured logging via `src/utils/logger.ts`
- Linear operations use retry with exponential backoff
- Rate limiting prevents API quota exhaustion (both Linear and Confluence)
- OAuth endpoints rate-limited to 5 requests per 15 minutes

---

## SAFe Workflow

All work follows the SAFe hierarchy and specs-driven development:

1. BSA creates spec in `specs/ASP-XXX-feature-spec.md`
2. System Architect validates architectural approach
3. Implementation agents execute with pattern discovery
4. QAS validates against acceptance criteria
5. Evidence attached to Linear ticket before POPM review

### Metacognitive Tags

Use in specs to highlight critical decisions:
- `#PATH_DECISION` - Architectural path chosen (document alternatives)
- `#PLAN_UNCERTAINTY` - Areas requiring validation
- `#EXPORT_CRITICAL` - Security/compliance requirements

### Pattern Discovery Protocol (MANDATORY)

**Before implementing ANY feature:**

1. Search `patterns_library/` for existing patterns
2. Search `specs/` for similar specifications
3. Search codebase for similar implementations
4. Consult documentation: [CONTRIBUTING.md](CONTRIBUTING.md), [docs/database/](docs/database/), [docs/security/](docs/security/)
5. Propose to System Architect before implementation

---

## Development Notes

### Configuration

- Environment variables defined in `.env.template`
- `ENCRYPTION_KEY` must be a 64-character hex string (AES-256)
- Database migrations run automatically on startup
- Behavior registry requires `LINEAR_ACCESS_TOKEN` to initialize

### TypeScript Build

Two tsconfig files:
- `tsconfig.json` — Includes `src/` and `tests/`, used for development
- `tsconfig.prod.json` — Extends base, only includes `src/`, used by `npm run build`

### Database Changes

- Create new migration files in `src/db/migrations/`
- Follow naming convention: `XXX_description.sql`
- Update `src/db/migrations/index.ts` to include new migrations

### SAFe Hierarchy Rules

- Epics contain Features
- Features contain Stories and/or Enablers
- Maintain parent-child relationships in Linear
- Use consistent labeling and issue types

### Docker OAuth Flow

Must complete in order:
1. Start containers: `docker-compose up -d`
2. Linear OAuth first: `http://localhost:3000/auth` — creates organization record
3. Get org ID: `docker-compose exec db psql -U postgres -d linear_agent -c "SELECT organization_id FROM linear_tokens;"`
4. Confluence OAuth second: `http://localhost:3000/auth/confluence?organizationId=YOUR_ORG_ID`

### WIP Methodology

The project uses a Work-In-Progress methodology for agent deployment with specs organized in `specs/` (todo → doing → done → blocked). Automation scripts in `scripts/` manage agent assignment workflows.

---

## CI/CD Pipeline

**MANDATORY**: Read [CONTRIBUTING.md](CONTRIBUTING.md) before any development.

### PR Workflow

1. Create feature branch: `ASP-{number}-{description}`
2. Implement with proper commits: `type(scope): description [ASP-XXX]`
3. Rebase: `git rebase origin/dev`
4. Validate: `npm test && npm run build` (must pass)
5. Push: `git push --force-with-lease`
6. Create PR using `.github/pull_request_template.md`
7. Merge using "Rebase and merge" only

### Branch Protection

- All PRs must be up-to-date with `dev`
- All CI checks must pass
- CODEOWNERS reviewers required
- No direct pushes to `dev`

**Detailed Guides**: [docs/ci-cd/CI-CD-Pipeline-Guide.md](docs/ci-cd/CI-CD-Pipeline-Guide.md) | [docs/workflow/](docs/workflow/)

---

## Linear Workflow Integration

When completing implementation work, update the corresponding Linear issue status:

**Status flow**: `Backlog → Todo → In Progress → In Review → Done`

- Move to "In Progress" when starting work
- Move to "In Review" when PR is submitted
- Move to "Done" when work is merged

Always update both GitHub PR status and Linear issue status for full traceability.
