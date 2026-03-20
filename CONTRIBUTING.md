# Contributing

Welcome to Claude Code Harness for Multi-Agent Team Workflows! This guide covers everything you need to know to contribute effectively, whether you're a human developer, Claude Code, or an AI remote agent.

## 🎯 Quick Start

**For Human Developers**: Follow the complete setup process below
**For AI Agents**: Focus on [AI Agent Guidelines](#ai-agent-guidelines) and [Workflow Process](#workflow-process)

## 📋 Table of Contents

- [Prerequisites & Setup](#prerequisites--setup)
- [AI Agent Guidelines](#ai-agent-guidelines)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Workflow Process](#workflow-process)
- [Pull Request Process](#pull-request-process)
- [CI/CD Pipeline](#cicd-pipeline)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

## Prerequisites & Setup

### For Human Developers

1. **Install Dependencies**:

   ```bash
   # Install Node.js 18+
   node --version  # Should be 18+
   npm --version   # Bundled with Node.js
   ```

2. **Clone and Setup**:

   ```bash
   git clone https://github.com/bybren-llc/a-safe-pulse-app.git
   cd a-safe-pulse-app
   npm install
   ```

3. **Environment Setup**:

   ```bash
   cp .env.template .env
   # Fill in your environment variables
   ```

4. **Database Setup**:

   ```bash
   docker-compose up -d  # Start PostgreSQL
   # Migrations are raw SQL files in src/db/migrations/
   # They run automatically on application startup
   ```

5. **CI/CD Setup** (First time only):
   ```bash
   chmod +x scripts/setup-ci-cd.sh
   ./scripts/setup-ci-cd.sh
   ```

### For AI Agents

AI agents (Claude Code, Augment agents) should:

1. **Read this entire document** before starting work
2. **Follow all workflow processes** exactly as human developers
3. **Use the PR template** at `.github/pull_request_template.md`
4. **Run local validation** with `npm test && npm run build` before pushing
5. **Reference Linear tickets** in all commits and PRs

## AI Agent Guidelines

### Required Behavior for AI Agents

**✅ MUST DO**:

- Follow the exact branch naming convention: `ASP-{number}-{description}`
- Use SAFe commit message format with Linear ticket references
- Run `npm test && npm run build` before pushing any code
- Use the comprehensive PR template completely
- Follow rebase-first workflow (never create merge commits)
- Reference the Linear ticket in all commits and PR title
- **Implementation Tickets**: Follow ready-to-implement tickets in `docs/technical-improvements/07-implementation-roadmap.md#immediate-implementation-tickets`

**❌ NEVER DO**:

- Skip the CI/CD validation steps
- Create branches without Linear ticket numbers
- Use merge commits (always rebase)
- Push without running local validation
- Ignore failing CI checks

### Skills 2.0 and Agent Teams (v2.5.0)

Skills now support fine-grained invocation control via YAML frontmatter fields: `disable-model-invocation`, `user-invocable`, `context: fork`, `allowed-tools`, and `argument-hint`. See the [Skill Authoring Guide](docs/guides/SKILL_AUTHORING_GUIDE.md) for details.

Agent Teams is an experimental feature for real-time multi-agent orchestration. See the [Agent Teams Guide](docs/onboarding/AGENT-TEAMS-GUIDE.md).

### AI Agent Workflow Example

```bash
# 1. Start work (always from latest dev)
git checkout dev && git pull origin dev
git checkout -b ASP-123-implement-feature

# 2. Make changes and commit with SAFe format
git commit -m "feat(scope): implement feature [ASP-123]"

# 3. Before pushing - ALWAYS validate locally
npm test && npm run build

# 4. Rebase and push
git fetch origin && git rebase origin/dev
git push --force-with-lease origin ASP-123-implement-feature

# 5. Create PR using template at .github/pull_request_template.md
```

### Implementation Ticket Workflow

**Ready-to-Implement Tickets**: See `docs/technical-improvements/07-implementation-roadmap.md#immediate-implementation-tickets`

**For each implementation ticket:**

1. **Check Acceptance Criteria**: Ensure all requirements are clearly defined
2. **Verify Dependencies**: Confirm prerequisite tickets are completed
3. **Follow Effort Estimates**: Most tickets are < 1 hour for quick wins
4. **Test Verification**: Use provided verification steps before PR
5. **Separate PRs**: Keep scope tight (one ticket = one PR for easier review)

**Example Implementation Tickets:**

- Remove unused dependencies (15 min)
- Add health endpoints (45 min)
- Wire Slack alerting (2 hours)
- Documentation cleanup (5 min)

## Branch Naming Conventions

**REQUIRED FORMAT**: `ASP-{number}-{short-description}`

### ✅ Correct Examples

- `ASP-42-add-user-authentication`
- `ASP-57-fix-profile-image-upload`
- `ASP-123-implement-oauth-flow`

### ❌ Incorrect Examples

- `feature/add-dark-mode` (missing ticket number)
- `fix/broken-login-form` (missing ticket number)
- `john-new-feature` (personal naming)
- `WIP` (not descriptive)

### Branch Naming Rules

1. **MUST** start with `ASP-{number}` (Linear ticket reference)
2. Use lowercase letters and hyphens for description
3. Keep description short but descriptive (max 50 chars total)
4. Never include personal names or dates
5. Make sure the name reflects the actual work being done

**Note**: The CI/CD pipeline will **automatically reject** branches that don't follow this format.

## Commit Message Guidelines

**REQUIRED FORMAT**: SAFe methodology with Linear ticket reference

```
type(scope): description [ASP-XXX]
```

### Types (Required)

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code formatting (no logic changes)
- `refactor` - Code restructuring (no feature/bug changes)
- `test` - Adding or updating tests
- `chore` - Maintenance tasks, dependencies
- `ci` - CI/CD pipeline changes

### Scope (Optional)

- `safe` - SAFe framework changes
- `auth` - Authentication features
- `cli` - CLI tool changes
- `api` - API routes and backend
- `db` - Database changes

### Examples

✅ **Correct**:

```
feat(auth): add Confluence OAuth integration [ASP-42]
fix(auth): resolve login redirect issue [ASP-57]
docs: update API documentation [ASP-123]
```

❌ **Incorrect**:

```
add new feature (missing ticket reference)
feat: add checkout (missing ticket reference)
WIP: working on stuff (not descriptive)
```

**Note**: The CI/CD pipeline will **automatically reject** commits that don't follow this format.

## Workflow Process

**CRITICAL**: This project uses a **rebase-first workflow** enforced by CI/CD automation.

### 1. Starting Work

```bash
# ALWAYS start from latest dev
git checkout dev
git pull origin dev

# Create feature branch with Linear ticket number
git checkout -b ASP-{number}-{description}
```

### 2. During Development

```bash
# Make changes and commit with SAFe format
git add .
git commit -m "feat(scope): description [ASP-XXX]"

# Keep branch updated (rebase, never merge)
git fetch origin
git rebase origin/dev
```

### 3. Before Creating PR

```bash
# REQUIRED: Run local validation
npm test && npm run build

# This runs:
# - Jest test suite
# - TypeScript compilation (production build)

# Fix any issues before proceeding
```

### 4. Push Changes

```bash
# ALWAYS use force-with-lease after rebase
git push --force-with-lease origin ASP-{number}-{description}
```

### 5. Create Pull Request

- **Use the template** at `.github/pull_request_template.md`
- **Fill out ALL sections** completely
- **Reference Linear ticket** in title: `feat(scope): description [ASP-XXX]`
- **Request appropriate reviewers** (auto-assigned via CODEOWNERS)

### 6. Respond to CI/CD Feedback

The automated pipeline will check:

- ✅ Branch naming format
- ✅ Commit message format
- ✅ Rebase status (no merge commits)
- ✅ All tests passing
- ✅ Code quality (ESLint, TypeScript)
- ✅ Build verification

**If checks fail**: Fix issues and push again (pipeline re-runs automatically)

### 7. Merge Process

- **ONLY use "Rebase and merge"** (maintains linear history)
- **NEVER use "Squash and merge"** or "Create merge commit"
- **Auto-merge available** with `auto-merge` label (if all checks pass)

## Agent Exit States (vNext Contract)

Each agent role has explicit exit states that define handoff points in the workflow:

```
┌─────────────────┬───────────────────────────────────────────┐
│ Role            │ Exit State                                │
├─────────────────┼───────────────────────────────────────────┤
│ BE-Developer    │ "Ready for QAS"                           │
│ FE-Developer    │ "Ready for QAS"                           │
│ Data-Engineer   │ "Ready for QAS"                           │
│ QAS             │ "Approved for RTE"                        │
│ RTE             │ "Ready for HITL Review"                   │
│ System Architect│ "Stage 1 Approved - Ready for ARCHitect"  │
│ HITL            │ MERGED                                    │
└─────────────────┴───────────────────────────────────────────┘
```

### Gate Quick Reference

```
┌─────────────────┬─────────────────┬─────────────────────────┐
│ Gate            │ Owner           │ Blocking?               │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Stop-the-Line   │ Implementer     │ YES - no AC = no work   │
│ QAS Gate        │ QAS             │ YES - no approval = stop│
│ Stage 1 Review  │ System Architect│ YES - pattern check     │
│ Stage 2 Review  │ ARCHitect-CLI   │ YES - architecture check│
│ HITL Merge      │ Scott Graham            │ YES - final authority   │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Role Collapsing (ASP-499)

- **RTE**: Collapsible (PR creation can be done by implementer)
- **QAS**: NOT collapsible (independence gate - spawn subagent)
- **SecEng**: NOT collapsible (security audit requires independence)

See [Agent Workflow SOP v1.4](./docs/sop/AGENT_WORKFLOW_SOP.md) for complete details.

## Pull Request Process

### PR Template Requirements

**MUST USE**: `.github/pull_request_template.md` (comprehensive template)

**Required Sections**:

- 📋 Summary with Linear ticket link
- 🎯 Changes Made (detailed list)
- 🧪 Testing (coverage and results)
- 📊 Impact Analysis (files changed, breaking changes)
- 🔄 Multi-Team Coordination (rebase status, dependencies)
- ✅ Pre-merge Checklist (quality, security, SAFe compliance)

### Automated PR Validation

The CI/CD pipeline automatically validates:

1. **Structure Validation** 🔍
   - Branch naming: `ASP-{number}-{description}`
   - PR title includes Linear ticket: `[ASP-XXX]`
   - Linear ticket exists and is valid

2. **Rebase Status Check** 🔄
   - Branch is up-to-date with `dev`
   - No merge commits (linear history maintained)
   - Auto-comments with rebase instructions if needed

3. **Comprehensive Testing** 🧪
   - Unit tests (fast feedback)
   - Integration tests (API/database)

4. **Quality & Security** 🔍
   - ESLint + TypeScript validation
   - Security audit and secret detection
   - Code formatting (Prettier)

5. **Build Verification** 🏗️
   - TypeScript production build
   - Build artifact validation

6. **Conflict Detection** 🚨
   - High-risk file monitoring (`.env.template`, `config.ts`, `package.json`)
   - Team notification triggers
   - Extra review requirements for sensitive changes

### Review Process

**Automatic Assignment**: Based on CODEOWNERS file

- Core config files → cheddarfox (ARCHitect-in-the-IDE)
- Payment features → @payments-team cheddarfox
- Authentication → @auth-team cheddarfox
- Database schema → @backend-team cheddarfox

**Review Requirements**:

- At least 1 required reviewer approval
- All CI checks must pass
- No merge conflicts
- Linear history maintained

## CI/CD Pipeline

### Local Validation Commands

```bash
# Run all quality checks (REQUIRED before pushing)
npm test && npm run build

# Individual checks
npm test             # Jest test suite (unit + integration)
npm run build        # TypeScript production build
npm run build:dev    # TypeScript build including tests
```

### Pipeline Stages

1. **Structure Validation** → Validates branch/PR format
2. **Rebase Status Check** → Ensures linear history
3. **Comprehensive Testing** → All test suites
4. **Quality & Security** → Code quality and security
5. **Build Verification** → Production build test
6. **Conflict Detection** → High-risk file monitoring

### Pipeline Benefits

- **No merge conflicts** between teams (rebase enforcement)
- **Automatic quality gates** (no broken code reaches `dev`)
- **Team coordination** (automatic notifications and assignments)
- **Parallel development** (teams work simultaneously safely)

## Local Development

### Environment Setup

```bash
# Database (PostgreSQL via Docker)
docker-compose up -d

# Environment variables
cp .env.template .env
# Edit .env with your values

# Database migrations (raw SQL in src/db/migrations/)
# Migrations run automatically on application startup
# To add a new migration, create a SQL file in src/db/migrations/
# and register it in src/db/migrations/index.ts

# RLS Security Setup (Important!)
# The database now uses Row Level Security for data protection
# Use cheddarfox_app_user for proper RLS enforcement in development
# See docs/database/RLS_IMPLEMENTATION_GUIDE.md for details
```

### Development Commands

```bash
# Start development server
npm run dev

# Database management
# Connect directly via psql:
# docker exec -it cheddarfox-team-postgres-1 psql -U cheddarfox_app_user -d linear_agent
# Migrations are raw SQL files in src/db/migrations/

# Testing
npm test                   # All tests (Jest)

# Build
npm run build              # Production build (TypeScript)
npm run build:dev          # Development build (includes tests)

# RLS Security Testing
node scripts/test-rls-phase3-simple.js  # Basic RLS functionality test
# Run comprehensive security validation:
# cat scripts/rls-phase4-final-validation.sql | docker exec -i cheddarfox-team-postgres-1 psql -U cheddarfox_app_user -d linear_agent
```

## Row Level Security (RLS) Development

### 🔒 Security Implementation

The a-safe-pulse application uses **Row Level Security (RLS)** for database-level data protection. This is critical for preventing cross-user data access.

### RLS Development Guidelines

**🚨 CURRENT STATUS:**

- RLS lint is warn-only temporarily; migrate to withRLS()
- DB migrations are manual-only with ARCHitect approval

**✅ MUST DO when working with database operations:**

- Use `withUserContext()`, `withAdminContext()`, or `withSystemContext()` helpers
- Test with `cheddarfox_app_user` role (not `postgres` superuser)
- Validate user data isolation in your tests
- Check RLS context is properly set before database queries

**❌ NEVER DO:**

- Bypass RLS context setting for user operations
- Use `postgres` (superuser) for application testing
- Trust session variables for role validation
- Assume users can access data without proper context

### RLS Testing Requirements

```bash
# Test basic RLS functionality
node scripts/test-rls-phase3-simple.js

# Run comprehensive security validation
cat scripts/rls-phase4-final-validation.sql | docker exec -i cheddarfox-team-postgres-1 psql -U cheddarfox_app_user -d linear_agent

# Test user isolation manually
docker exec cheddarfox-team-postgres-1 psql -U cheddarfox_app_user -d linear_agent -c "
  SET app.current_user_id = 'your_test_user';
  SELECT COUNT(*) FROM user; -- Should see only your test user's data
"
```

### Common RLS Patterns

```typescript
// User operation - automatic context setting
const userTokens = await withUserContext(pool, userId, async (client) => {
  const result = await client.query(
    'SELECT * FROM linear_tokens WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
});

// Admin operation - requires admin role
const webhookEvents = await withAdminContext(pool, userId, async (client) => {
  const result = await client.query('SELECT * FROM webhook_events');
  return result.rows;
});

// System operation - for background tasks
const systemData = await withSystemContext(
  pool,
  "webhook",
  async (client) => {
    const result = await client.query(
      'INSERT INTO webhook_events (event_type, payload) VALUES ($1, $2) RETURNING *',
      [eventType, JSON.stringify(webhookData)]
    );
    return result.rows[0];
  },
);
```

### RLS Documentation

- **Implementation Guide**: `docs/database/RLS_IMPLEMENTATION_GUIDE.md`
- **Troubleshooting**: `docs/guides/RLS_TROUBLESHOOTING.md`
- **Security Scripts**: `scripts/rls-*.sql`

---

## Troubleshooting

### Common CI/CD Issues

**Branch Name Rejected**:

```bash
# Rename branch to correct format
git branch -m ASP-{number}-{description}
git push origin -u ASP-{number}-{description}
git push origin --delete old-branch-name
```

**Rebase Required**:

```bash
git fetch origin
git rebase origin/dev
# Resolve any conflicts
git push --force-with-lease origin your-branch
```

**Commit Message Format Error**:

```bash
# Amend last commit message
git commit --amend -m "feat(scope): description [ASP-XXX]"
git push --force-with-lease origin your-branch
```

**CI Validation Failures**:

```bash
# Run local validation to see specific issues
npm test && npm run build

# Fix issues and commit
git add .
git commit -m "fix: resolve CI validation issues [ASP-XXX]"
```

### Getting Help

- **Documentation**: [CI/CD Pipeline Guide](docs/ci-cd/CI-CD-Pipeline-Guide.md)
- **Implementation Guide**: `docs/CI-CD-Pipeline-Guide.md`
- **Team Workflow**: `docs/a-safe-pulse-Multi-Team-Git-Workflow-Guide.md`
- **Quick Setup**: `docs/ci-cd-implementation-checklist.md`

## Additional Resources

### Key Documentation Files

- **Database Schema**: `docs/database/DATA_DICTIONARY.md` (SINGLE SOURCE OF TRUTH - AI Context)
- **Database Security**: `docs/database/RLS_DATABASE_MIGRATION_SOP.md` (MANDATORY for schema changes)
- **Security Architecture**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md` (REQUIRED for new services)
- **Technical Improvements Strategy**: `docs/technical-improvements/` (Complete implementation roadmap)
- **Implementation Tickets**: `docs/technical-improvements/07-implementation-roadmap.md#immediate-implementation-tickets`
- **CI/CD Setup**: `scripts/setup-ci-cd.sh`
- **Pipeline Guide**: `docs/CI-CD-Pipeline-Guide.md`
- **Team Workflow**: `docs/a-safe-pulse-Multi-Team-Git-Workflow-Guide.md`
- **Implementation Checklist**: `docs/ci-cd-implementation-checklist.md`
- **TypeScript Cleanup**: `docs/archive/asp-139-typescript-cleanup-status.md` (ASP-139)

### Confluence Documentation

- [CI/CD Pipeline Guide](docs/ci-cd/CI-CD-Pipeline-Guide.md)

---

**This document is maintained by the a-safe-pulse development team and reflects our current CI/CD pipeline implementation.**

**Last Updated**: 2025-12-23
**Version**: 2.1 (vNext Workflow Contract - ASP-497/499)
**Maintained by**: a-safe-pulse Development Team + ARCHitect-in-the-IDE (Auggie)
