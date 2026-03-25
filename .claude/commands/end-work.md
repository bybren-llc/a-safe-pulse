---
description: Complete work session with final checklist
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

You are completing a work session. Execute final checklist before context switch or session end.

## Completion Checklist

### 1. Work Status

Verify current state:

```bash
git status
git log origin/dev..HEAD --oneline
```

Status options:

- **Work Complete**: Ready for PR
- **Work In Progress**: Safe stopping point, commit and document
- **Blocked**: Document blockers

### 2. Commit All Work

If uncommitted changes:

```bash
git add .
git commit -m "type(scope): description [ASP-XXX]"
```

Verify all work committed:

```bash
git status  # Should show clean working tree
```

### 3. Documentation Status

Quick check:

- [ ] Inline comments for complex logic?
- [ ] README updated if new feature?
- [ ] CLAUDE.md/CONTRIBUTING.md updated if workflow changed?
- [ ] Linear ticket status current?

### 4. Update Linear Ticket

> **Note**: Tickets referenced in commit messages (e.g., `[ASP-XXX]`) auto-sync to Done when the PR merges via the GitHub-Linear integration. Manually close any child stories not referenced in commits.

Based on work status:

**If Complete**:

- Update ticket status to "Ready for Review" or "In Progress"
- Add comment summarizing work done
- Link to PR if created

**If In Progress**:

- Update ticket with progress notes
- Document any blockers or questions
- Set status appropriately

**If Blocked**:

- Document blocker clearly
- Add comments to ticket
- Tag appropriate people

Use Linear MCP:

```text
mcp__linear-mcp__update_issue
mcp__linear-mcp__create_comment
```

### 5. Save Checkpoint (conditional)

Save a session checkpoint if meaningful work was done:

**Required when ALL of these are true:**
- Branch matches `ASP-\d+` pattern (SAFe ticket branch)
- There is meaningful progress, a blocker, or pending next steps
- Not in detached HEAD or non-SAFe branch

**Skip checkpoint when:**
- No ticket branch (e.g., `dev`, `main`, detached HEAD)
- No meaningful work was done this session
- User explicitly declines

**If checkpointing:**
1. Determine ticket from branch: `git branch --show-current | grep -oE 'ASP-[0-9]+'`
2. Gather git state: last commit, unpushed count, uncommitted status
3. Summarize: completed, next steps, decisions, blockers, open questions
4. Write to `.claude/state/checkpoints/ASP-{number}.md`
5. Update `.claude/state/checkpoints/current.md` pointer
6. If status is "Ready for Review" or "Done", clear `current.md` (delete the file)

**If skipping:**
- Output: "No checkpoint created (reason: {reason})"

**Security rule**: Do NOT store secrets, raw tokens, credentials, or sensitive data in checkpoint files.

### 6. Branch Status

Decide next action:

**If Ready for PR**:

- Push branch: `git push origin {branch-name}`
- Create PR (or remind to create)
- Reference `/pre-pr` command

**If In Progress**:

- Push work: `git push origin {branch-name}` (if exists)
- Or: Keep local until next session

**If Experimental**:

- Consider creating WIP PR for visibility
- Or: Keep local and document intent

## Output Format

Provide summary:

- ✅ Work status (complete/in-progress/blocked)
- ✅ All changes committed
- ✅ Documentation current
- ✅ Linear ticket updated
- ✅ Checkpoint saved (or skipped with reason)
- ✅ Ready for next session

Include any action items for user:

- PR creation needed?
- Blockers to resolve?
- Questions to answer?
- Follow-up tasks?

## Success Criteria

Session ends cleanly:

- No uncommitted work (if complete)
- or: Safe stopping point documented (if in-progress)
- Linear ticket reflects current status
- Next session can pick up smoothly

This ensures continuity and prevents context loss.
