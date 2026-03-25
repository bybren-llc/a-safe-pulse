---
description: Start work on a new Linear ticket with proper workflow
argument-hint: [ASP-number]
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, mcp__linear-mcp__*]
---

You are starting work on a new Linear ticket.

**Workflow Authority**: This harness command provides execution steps. CONTRIBUTING.md is the northstar for conventions (branch naming, commit format, SAFe patterns). Follow both:

## Session Resume (if returning to existing work)

Before starting fresh, check for a prior session checkpoint:

1. Check if `.claude/state/checkpoints/current.md` exists
2. If it exists, read the ticket ID from it
3. Read the matching checkpoint file: `.claude/state/checkpoints/ASP-{number}.md`
4. **Verify match**:
   - Ticket in pointer matches the requested ticket
   - Checkpoint file exists
   - Current branch matches checkpoint branch or ticket
5. **If all match**: Display the checkpoint summary to the user and ask:
   > "Found a checkpoint for ASP-{number} from {date}. Resume from this checkpoint, or start fresh?"
   - **Resume**: Skip branch creation (branch already exists), use checkpoint as context
   - **Start fresh**: Proceed with Pre-Flight Checklist below
6. **If mismatch**: Show warning with details and offer:
   - Resume the checkpoint anyway
   - Start fresh on the requested ticket
   - Clear the stale pointer
7. **If no checkpoint or no `current.md`**: Proceed normally with Pre-Flight Checklist

## Pre-Flight Checklist

1. **Linear Ticket Exists?**
   - If no ticket number provided in arguments, ask user for Linear ticket number
   - Verify ticket exists in Linear using `mcp__linear-mcp__get_issue`
   - Confirm ticket is in appropriate status (Todo, In Progress)

2. **Stop-the-Line: AC/DoD Check** (MANDATORY)
   - Verify ticket has **Acceptance Criteria** or **Definition of Done**
   - If AC/DoD is missing or unclear:
     - **STOP** - Do not proceed with implementation
     - Route back to BSA/POPM to define AC/DoD
     - Dev agents are NOT responsible for inventing AC/DoD
   - Work begins ONLY when AC/DoD exists

3. **Branch Naming**
   - Format: `ASP-{number}-{short-description}`
   - Must start with ASP- and ticket number
   - Use lowercase with hyphens

4. **Start from Latest Dev**
   - Ensure starting from clean dev branch: `git checkout dev && git pull origin dev`
   - Verify no uncommitted changes

5. **Create Feature Branch**
   - Create branch: `git checkout -b ASP-{number}-{description}`
   - Confirm branch created successfully

## Workflow

If argument provided ($1):

- Use as ticket number (e.g., `/start-work 347` → ASP-347)
- Fetch ticket details from Linear
- Suggest branch name based on ticket title
- Execute checkout workflow

If no argument:

- Ask user for Linear ticket number
- Proceed with workflow

## Success Criteria

- ✅ Linear ticket verified
- ✅ AC/DoD confirmed (Stop-the-Line gate passed)
- ✅ On latest dev branch
- ✅ Feature branch created with correct naming
- ✅ Ready to begin work

Report status and any blockers. If AC/DoD is missing, report blocker and route to BSA.
