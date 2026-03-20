---
description: Full local development sync after git pull
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

> **📋 TEMPLATE**: This command is a template. See "Customization Guide" below to adapt for your infrastructure.

Perform complete local development environment sync after pulling from dev branch.
This ensures dependencies, database, and validation are all up-to-date.

## Workflow

### 1. Git Branch Cleanup (Best Practice)

**Check current branch and switch to dev if needed:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"
```

**If on feature branch:**

- Check for uncommitted changes
- If clean, switch to dev: `git checkout dev`
- If dirty, offer to stash: `git stash && git checkout dev`
- Save feature branch name for cleanup

**Switch to dev branch:**

```bash
git checkout dev
```

### 2. Git Pull

Pull latest changes from origin/dev:

```bash
git pull origin dev
```

If pull fails due to uncommitted changes:

- Stash changes: `git stash`
- Pull again
- Reapply stash: `git stash pop`

### 3. Branch Cleanup (Git Best Practice)

**After pulling latest dev, clean up merged branches:**

**Check if previous feature branch is merged:**

```bash
# If we switched from a feature branch, check if it's merged
git branch --merged dev | grep -v "^\*" | grep -v "dev" | grep -v "master"
```

**Offer to delete merged feature branch:**

```bash
# Example: ASP-381-rename-slash-commands-remote-prefix
git branch -d ASP-381-rename-slash-commands-remote-prefix
```

**Prune remote tracking branches:**

```bash
# Remove stale remote tracking branches
git fetch --prune origin
```

**List stale local branches:**

```bash
# Show branches not updated in 30+ days
git for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short) | %(committerdate:relative)' | grep -E 'weeks|months|years' ago
```

**Offer to delete stale branches** (interactive)

### 4. Smart Change Detection

Detect what changed to determine necessary steps:

```bash
# Check if package.json changed
DEPS_CHANGED=$(git diff HEAD@{1} HEAD -- package.json package-lock.json)

# Check if database migrations changed
SCHEMA_CHANGED=$(git diff HEAD@{1} HEAD -- src/db/migrations/)
```

**Decision Logic:**

- If `$DEPS_CHANGED` is empty → **Skip Step 5 (npm install)**
- If `$SCHEMA_CHANGED` is empty → **Skip Step 6 (migration check)**
- If both empty → **Fast path: Jump to Step 7 (Docker check)**

### 5. Install Dependencies (Conditional)

#### Only run if package.json or package-lock.json changed

If `$DEPS_CHANGED` has content:

```bash
npm install
```

Show summary:

- Packages added
- Packages removed
- Packages updated

If `$DEPS_CHANGED` is empty:

```text
⏭️  Skipped: No dependency changes detected
```

### 6. Database Migration Check (Conditional)

#### Only run if migrations changed

If `$SCHEMA_CHANGED` has content:

Check for new migration files:

```bash
ls -la src/db/migrations/
```

Note: Raw SQL migrations in `src/db/migrations/` run automatically on application startup.
Review any new migration files to understand schema changes.

If `$SCHEMA_CHANGED` is empty:

```text
⏭️  Skipped: No migration changes detected
```

### 7. Validation (Optional)

#### Only run if user opts in

Ask user: "Run full validation (npm test && npm run build)? This takes ~30s. (y/N)"

If user chooses Yes:

```bash
npm test && npm run build
```

This runs:

1. `npm test` - Jest test suite
2. `npm run build` - TypeScript production build

If user chooses No or skips:

```text
⏭️  Skipped: Run 'npm test && npm run build' manually if needed
```

### 8. Docker Services Check

Verify Docker services are running:

```bash
docker ps --filter name=a-safe-pulse --format 'table {{.Names}}\t{{.Status}}\t{{.State}}'
```

If services not running:

- Suggest: `./scripts/dev-docker.sh start`
- OR: `docker-compose up -d`

### 9. Status Report

Generate comprehensive sync report:

```text
🔄 Local Development Sync Complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Git Sync
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch:        dev
Commits:       3 new commits pulled
Latest:        fd85ba3 - feat(marketing): RenderTrust pages [ASP-379]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dependencies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

package.json:  ✅ No changes
package-lock.json:     ✅ No changes
Status:        ⏭️  Skipped (no changes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migrations:    ✅ No changes (7 total in src/db/migrations/)
Status:        ⏭️  Skipped (no migration changes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:        ⏭️  Skipped (user opted out)
Suggestion:    Run `npm test && npm run build` manually if needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Docker Services (ASP-401: STANDARD Ports)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

a-safe-pulse-dev-app:        ✅ Up 3 hours (healthy) → port 3000
a-safe-pulse-dev-postgres:   ✅ Up 3 hours (healthy) → port 5432

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Local environment fully synced and validated
✅ Ready for development

Next Steps:
• Start dev server: npm run dev
• View local app: http://localhost:3000
• Check health: /local-health
```

## Error Handling

### Git Pull Fails (Merge Conflicts)

If pull fails due to conflicts:

```text
⚠️  MERGE CONFLICT DETECTED

Files with conflicts:
• app/example/page.tsx
• lib/helper.ts

Resolution:
1. Resolve conflicts manually
2. Stage resolved files: git add .
3. Complete merge: git commit
4. Re-run /local-sync
```

### npm Install Fails

If dependency installation fails:

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules
npm install
```

### Migration Issues

If migrations fail on startup:

```bash
# Check migration files
ls -la src/db/migrations/

# Connect to database directly to inspect state
docker exec -it cheddarfox-team-postgres-1 psql -U cheddarfox_app_user -d linear_agent
```

### Validation Fails

If validation fails, show specific failures:

- **Test failures**: Run `npm test` to see details
- **Build errors**: Run `npm run build` to see details

Provide command to fix each type of error.

### Database Migration Pending

If new migrations detected:

```text
⚠️  NEW MIGRATIONS DETECTED

New migration files in src/db/migrations/:
• 006_add_user_roles.sql
• 007_add_audit_fields.sql

Migrations run automatically on application startup.
Restart the app to apply: npm run dev
```

## Success Criteria

- ✅ Git pull successful
- ✅ Dependencies installed (if changed)
- ✅ Migration files reviewed (if changed)
- ✅ No unexpected migration changes
- ✅ Docker services running
- ✅ Clear status report with skip reasons provided
- ⚠️ CI validation optional (user choice)

## Related Commands

- `/local-health` - Check local environment health
- `/local-restart` - Restart Docker services
- `/local-logs` - View application logs
- `npm run dev` - Start development server
- `npm test && npm run build` - Run validation manually

## Notes

**When to Run**:

- After receiving Slack notification in `#github-feed` (ASP-411)
- After every `git pull origin dev`
- When switching branches
- After long periods away from project
- When seeing unexpected errors

**Slack Notifications (ASP-411)**:

- Normal PRs: Basic merge notification
- High-Risk PRs: `@channel` mention - sync immediately!
- High-risk files: schema, migrations, Docker, dependencies

**What Gets Checked**:

- Git status and latest commits
- Docker services status
- Package.json/package-lock.json changes (detection only)
- Database migration file changes (detection only)

**What Gets Skipped** (Smart Detection):

- npm install (if no dependency changes)
- Migration review (if unchanged)

- CI validation (user must opt in - not run by default)

**Performance**:

- Fast path (no changes): ~5-10 seconds
- With dependencies: ~30 seconds
- With validation opt-in: ~60 seconds

## Customization Guide

To adapt this command for your infrastructure, replace these placeholders:

| Placeholder       | Description               | Example               |
| ----------------- | ------------------------- | --------------------- |
| `ASP` | Your Linear ticket prefix | `WOR`, `PROJ`, `TASK` |
