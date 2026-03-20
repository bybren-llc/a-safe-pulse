---
name: release-patterns
description: PR creation, CI/CD validation, and release coordination patterns. Use when creating pull requests, running pre-PR validation, checking CI status, or coordinating merges.
disable-model-invocation: true
argument-hint: "[ticket-id]"
allowed-tools: Read, Bash, Grep, Glob
---

# Release Patterns Skill

## Purpose

Ensure consistent PR creation, CI/CD validation, and release coordination following rebase-first workflow.

## When This Skill Applies

Invoke this skill when:

- Creating pull requests
- Running pre-PR validation (`npm test && npm run build`)
- Checking CI/CD status
- Coordinating merge timing
- Verifying rebase status

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```bash
# FORBIDDEN: Missing ticket reference
gh pr create --title "feat: add feature"  # Missing [ASP-XXX]

# FORBIDDEN: Using squash/merge commits
gh pr merge --squash  # Breaks linear history
gh pr merge --merge   # Creates merge commit

# FORBIDDEN: Skipping CI validation
git push origin feature  # Without npm test && npm run build first

# FORBIDDEN: Pushing without rebase
git push origin feature  # When branch is behind dev
```

### CORRECT Patterns

```bash
# CORRECT: Ticket reference in title
gh pr create --title "feat(scope): description [ASP-XXX]"

# CORRECT: Rebase merge only
gh pr merge --rebase --delete-branch

# CORRECT: CI validation before push
npm test && npm run build && git push --force-with-lease

# CORRECT: Always rebase first
git fetch origin && git rebase origin/dev
git push --force-with-lease origin ASP-XXX-description
```

## Pre-PR Checklist (MANDATORY)

Before creating any PR:

- [ ] Branch name: `ASP-{number}-{description}`
- [ ] Commits follow: `type(scope): description [ASP-XXX]`
- [ ] Rebased on latest dev: `git fetch origin && git rebase origin/dev`
- [ ] CI passes locally: `npm test && npm run build`
- [ ] Linear history: No merge commits (`git log --oneline --graph -10`)

## CI/CD Validation Command

```bash
# MANDATORY before any PR
npm test && npm run build && echo "READY FOR PR" || echo "FIX ISSUES FIRST"
```

## PR Creation Template

````bash
gh pr create --title "feat(scope): description [ASP-XXX]" --body "$(cat <<'EOF'
## Summary

Implements [feature/fix] as specified in Linear ticket ASP-XXX.

**Linear Ticket**: https://linear.app/cheddarfox/issue/ASP-XXX

## Changes Made

- Change 1
- Change 2

## Testing

```bash
npm test && npm run build
# All checks passed
````

## Pre-merge Checklist

- [x] Rebased on latest dev
- [x] CI passes
- [x] Linear ticket referenced

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

````

## Merge Strategy

**ONLY** use rebase merge:

```bash
# CORRECT
gh pr merge --rebase --delete-branch

# NEVER
gh pr merge --squash   # Loses commit history
gh pr merge --merge    # Creates merge commits
````

## QAS Gate (MANDATORY)

Before merging any PR, invoke QAS for independent review:

```text
Task tool: QAS subagent
Prompt: "Review PR #XXX for ASP-YYY. Validate commit format, CI status, patterns."
```

## Authoritative References

- **PR Template**: `.github/pull_request_template.md`
- **Workflow Guide**: `CONTRIBUTING.md` (Pull Request Process section)
- **CI/CD Pipeline**: `docs/CI-CD-Pipeline-Guide.md`
- **Agent Workflow SOP**: `docs/sop/AGENT_WORKFLOW_SOP.md` (3-stage review chain)
