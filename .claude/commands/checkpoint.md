---
description: Save structured session state for cross-session continuity
argument-hint: [ASP-number] (optional, auto-detected from branch)
allowed-tools: [Read, Write, Edit, Bash]
---

You are saving a session checkpoint for cross-session continuity.

**Security rule**: Do NOT store secrets, raw tokens, credentials, or sensitive customer data in checkpoint files.

## 1. Determine Ticket

Extract the ticket number:

```bash
# Auto-detect from branch name
TICKET=$(git branch --show-current 2>/dev/null | grep -oE 'ASP-[0-9]+')
echo "Detected ticket: $TICKET"
```

If `$ARGUMENTS` was provided, use that instead. If no ticket can be determined, inform the user and stop — checkpoints require a ticket context.

## 2. Gather Git State

```bash
# Last commit
git log -1 --oneline

# Unpushed commits
git log origin/dev..HEAD --oneline 2>/dev/null | wc -l

# Uncommitted changes
git status --porcelain | wc -l
```

## 3. Summarize Session

Based on conversation context, create a summary covering:
- **Completed**: What was accomplished this session
- **Next Steps**: What should happen next (ordered by priority)
- **Decisions Made**: Key decisions with rationale
- **Blockers**: Any blocking issues (or "None")
- **Open Questions / Risks**: Unresolved uncertainty that would get lost across sessions
- **Status**: In Progress / Blocked / Ready for Review

## 4. Write Checkpoint (Canonical)

Write the checkpoint to `.claude/state/checkpoints/ASP-{number}.md`:

```markdown
## Session Checkpoint — {today's date}

**Ticket**: ASP-{number}
**Branch**: {branch name}
**Status**: {status}

### Completed
- {bullets from summary}

### Next Steps
- {bullets from summary}

### Decisions Made
- {bullets with rationale}

### Blockers
- {if any, or "None"}

### Open Questions / Risks
- {unresolved items}

### Git State
- Last commit: {hash} {message}
- Unpushed: {count} commits
- Uncommitted: {yes/no}
```

## 5. Update Pointer

Write the ticket ID to `.claude/state/checkpoints/current.md`:

```
ASP-{number}
```

This overwrites any previous pointer. Only one ticket is "current" at a time.

## 6. Optional: Mirror to Memory

If the Claude Code memory system is available, optionally mirror the checkpoint to:
`~/.claude/projects/.../memory/checkpoint.md`

This is a **convenience cache only** — the canonical source is always `.claude/state/checkpoints/ASP-{number}.md`.

## Output

Confirm:
- ✅ Checkpoint saved: `.claude/state/checkpoints/ASP-{number}.md`
- ✅ Current pointer updated
- 📋 Show the checkpoint summary to the user
