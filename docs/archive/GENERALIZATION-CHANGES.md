# Onboarding Documentation Generalization Changes

## Overview

This document tracks the changes made to generalize onboarding documentation for broader adoption.

## Automated Script

Run the following script to apply all changes automatically:

```bash
bash scripts/generalize-onboarding-docs.sh
```

The script creates backups (.bak files) before making changes.

## Manual Changes (if script not used)

If you need to make changes manually, here are the specific updates required:

### Files to Update

1. `docs/onboarding/DAY-1-CHECKLIST.md`
2. `docs/onboarding/SOCIAL-MEDIA-SETUP.md`
3. `docs/onboarding/AGENT-SETUP-GUIDE.md`
4. `docs/onboarding/META-PROMPTS-FOR-USERS.md`
5. `docs/onboarding/USER-JOURNEY-VALIDATION-REPORT.md`

### Changes to Apply

#### 1. Replace "ASP SAFe" with "SAFe"

**Find:**

- `ASP SAFe Multi-Agent Development` → `SAFe Multi-Agent Development`
- `ASP SAFe methodology` → `SAFe multi-agent methodology`
- `the ASP methodology` → `the SAFe methodology`
- `ASP SAFe` → `SAFe multi-agent` (general references)

#### 2. Generalize GitHub URLs

**Find:** `https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow`
**Replace:** `https://github.com/bybren-llc/a-safe-pulse`

**Locations:**

- Clone commands
- Repository links
- PR links
- Discussion links

#### 3. Generalize GitIngest URLs

**Find:** `https://gitingest.com/bybren-llc/a-safe-pulse-Agentic-Workflow`
**Replace:** `https://gitingest.com/bybren-llc/{{GITHUB_REPO}}`

#### 4. Generalize Project Name

**Find:** `cd a-safe-pulse-Agentic-Workflow`
**Replace:** `cd a-safe-pulse`

#### 5. Generalize Ticket Prefixes

**Find:** `ASP-{number}` (e.g., `ASP-326`, `ASP-123`)
**Replace:** `ASP-{number}`

**Find:** `PROJ-{number}` (example tickets)
**Replace:** `ASP-{number}`

#### 6. Keep Generic Examples

**DO NOT CHANGE** these generic GitHub URLs (they're useful examples):

- `https://github.com/settings/tokens`
- `https://linear.app/settings/api`
- `https://id.atlassian.com/manage-profile/security/api-tokens`

## File-Specific Changes

### DAY-1-CHECKLIST.md

```diff
- # Day 1 Checklist: ASP SAFe Multi-Agent Development
+ # Day 1 Checklist: SAFe Multi-Agent Development

- **Purpose**: Your first day with the ASP SAFe methodology
+ **Purpose**: Your first day with the SAFe multi-agent methodology

- git clone https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
- cd a-safe-pulse-Agentic-Workflow
+ git clone https://github.com/bybren-llc/a-safe-pulse
+ cd a-safe-pulse

- Visit: https://gitingest.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ Visit: https://gitingest.com/bybren-llc/{{GITHUB_REPO}}

- I want to create a test Linear ticket to validate my ASP SAFe setup.
+ I want to create a test Linear ticket to validate my SAFe multi-agent setup.

- Title: `PROJ-1: Add Hello World endpoint...`
+ Title: `ASP-1: Add Hello World endpoint...`

- **Congratulations!** You've completed Day 1 of the ASP SAFe Multi-Agent Development methodology.
+ **Congratulations!** You've completed Day 1 of the SAFe Multi-Agent Development methodology.

- GitHub Discussions: https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow/discussions
+ GitHub Discussions: See your repository's discussions page

- Email: scott@cheddarfox.com
+ (Remove or replace with your contact)
```

### SOCIAL-MEDIA-SETUP.md

```diff
- How to configure social sharing for the ASP SAFe Multi-Agent Development repository.
+ How to configure social sharing for the SAFe Multi-Agent Development repository.

- 1. Go to: https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ 1. Go to: https://github.com/bybren-llc/a-safe-pulse

- **Project Name**: "ASP SAFe Multi-Agent Development"
+ **Project Name**: "a-safe-pulse SAFe Multi-Agent Development"

- content="https://bybren-llc.github.io/a-safe-pulse-Agentic-Workflow/"
+ content="https://bybren-llc.github.io/{{GITHUB_REPO}}/"
```

### AGENT-SETUP-GUIDE.md

```diff
- ## Installing and Using the 11-Agent ASP SAFe System
+ ## Installing and Using the 11-Agent SAFe System

- The ASP SAFe methodology uses **11 specialized AI agents**
+ The SAFe multi-agent methodology uses **11 specialized AI agents**

- git clone https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
- cd a-safe-pulse-Agentic-Workflow
+ git clone https://github.com/bybren-llc/a-safe-pulse
+ cd a-safe-pulse

- Create spec for ASP-123
+ Create spec for ASP-123

- I need to implement ASP-123 (user profile feature).
+ I need to implement ASP-123 (user profile feature).

- You've successfully set up the ASP SAFe 11-agent system.
+ You've successfully set up the SAFe 11-agent system.
```

### META-PROMPTS-FOR-USERS.md

```diff
- # Meta-Prompts for ASP SAFe Multi-Agent Development
+ # Meta-Prompts for SAFe Multi-Agent Development

- **Repository**: https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ **Repository**: https://github.com/bybren-llc/a-safe-pulse

- I want to set up the ASP SAFe Multi-Agent Development methodology
+ I want to set up the SAFe Multi-Agent Development methodology

- I've cloned the repository from https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ I've cloned the repository from https://github.com/bybren-llc/a-safe-pulse

- I'm working on a task and need to know which ASP SAFe agent to invoke.
+ I'm working on a task and need to know which SAFe agent to invoke.

- Based on the ASP SAFe methodology with 11 agent roles:
+ Based on the SAFe multi-agent methodology with 11 agent roles:

- I've cloned the ASP SAFe Agentic Workflow repository
+ I've cloned the SAFe Agentic Workflow repository

- I want to integrate the ASP SAFe multi-agent workflow
+ I want to integrate the SAFe multi-agent workflow

- I've just set up the ASP SAFe Multi-Agent Development methodology.
+ I've just set up the SAFe Multi-Agent Development methodology.

- Repository cloned: `git clone https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow`
+ Repository cloned: `git clone https://github.com/bybren-llc/a-safe-pulse`

- I'm having trouble with the ASP SAFe Multi-Agent Development setup.
+ I'm having trouble with the SAFe Multi-Agent Development setup.

- **GitIngest Link**: https://gitingest.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ **GitIngest Link**: https://gitingest.com/bybren-llc/{{GITHUB_REPO}}
```

### USER-JOURNEY-VALIDATION-REPORT.md

```diff
- ## a-safe-pulse-Agentic-Workflow Repository
+ ## SAFe-Agentic-Workflow Repository

- **Ticket**: ASP-326
+ **Ticket**: ASP-326

- **Repository**: https://github.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ **Repository**: https://github.com/bybren-llc/a-safe-pulse

- **URL**: https://gitingest.com/bybren-llc/a-safe-pulse-Agentic-Workflow
+ **URL**: https://gitingest.com/bybren-llc/{{GITHUB_REPO}}

- ### ✅ COMPLETED (ASP-326)
+ ### ✅ COMPLETED (ASP-326)

- ### Future Enhancements (Post-ASP-326)
+ ### Future Enhancements (Post-ASP-326)

- **ASP-326 Achievement**: Transformed user onboarding
+ **ASP-326 Achievement**: Transformed user onboarding
```

## Verification

After making changes, verify with:

```bash
# Check for remaining ASP references (should find none)
grep -r "ASP" docs/onboarding/*.md

# Check for hardcoded GitHub URLs (should find only generic ones)
grep -r "bybren-llc" docs/onboarding/*.md

# Check for ASP- ticket prefixes (should find none)
grep -r "ASP-" docs/onboarding/*.md
```

## Rollback

If you used the automated script and need to rollback:

```bash
for f in docs/onboarding/*.bak; do
  mv "$f" "${f%.bak}"
done
```

## Impact

These changes make the onboarding documentation:

1. **Portable**: Works for any project using this methodology
2. **Customizable**: Clear placeholders for project-specific values
3. **Professional**: No hardcoded references to original project
4. **Reusable**: Can be adopted without modification

## Next Steps

After generalization, teams adopting this methodology should:

1. Replace `https://github.com/bybren-llc/a-safe-pulse` with their repository URL
2. Replace `bybren-llc` and `{{GITHUB_REPO}}` with their GitHub org/repo names
3. Replace `a-safe-pulse` with their project directory name
4. Replace `ASP` with their ticket prefix (e.g., `PROJ`, `TASK`, `FEAT`)
5. Update contact information (remove or replace email addresses)

These replacements can be done with a single script or manually as part of repository customization.
