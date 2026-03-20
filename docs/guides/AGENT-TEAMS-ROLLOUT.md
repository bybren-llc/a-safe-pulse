# Agent Teams Rollout Guide

## What Agent Teams Changes

Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) enables Claude Code to spawn specialized subagents that work in parallel on independent tasks. When enabled:

- The parent agent can delegate work to specialized teammate agents (be-developer, qas, system-architect, etc.)
- Teammates run in-process and share the conversation context
- Multiple teammates can work simultaneously on non-overlapping files
- Each teammate has its own tool permissions defined in `.claude/agents/*.md`

## Current Status

- **Setting**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in `.claude/settings.template.json`
- **Default**: `"1"` (enabled in template)
- **Feature flag**: Experimental -- behavior may change between Claude Code releases

## How to Enable/Disable

### Enable (default in this repo)

The settings template already has Agent Teams enabled. When you copy `settings.template.json` to `settings.json`, the feature is on.

### Disable

Set in your local `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0"
  }
}
```

## Readiness Criteria

Before relying on Agent Teams for production workflows:

- [x] Harness adoption complete (ASP-120)
- [ ] Harness alignment with tech stack complete (ASP-121)
- [ ] All 11 agent definitions validated for correct tool permissions
- [ ] Agent Teams tested in at least 3 real development sessions
- [ ] No regression in single-agent workflow quality

## Known Limitations

- Experimental feature -- API may change between Claude Code versions
- Teammates cannot use the Agent tool themselves (no nested spawning)
- File conflicts possible if teammates edit overlapping files
- Permission denials in subagents require parent intervention
- Context window is shared -- large codebases may hit limits faster with multiple agents

## Agent Definitions

Agent Teams uses the definitions in `.claude/agents/`:

| Agent | Role | Status |
|-------|------|--------|
| be-developer | Backend implementation | Active |
| fe-developer | Frontend implementation | DORMANT |
| data-engineer | Database/migrations | Active |
| data-provisioning-eng | Test data/ETL | Active |
| bsa | Specs/acceptance criteria | Active |
| system-architect | Architecture review | Active |
| qas | Testing/quality gates | Active |
| security-engineer | Security audits | Active |
| rte | Release/PR coordination | Active |
| tdm | Delivery management | Active |
| tech-writer | Documentation | Active |

## References

- [AGENTS.md](../../AGENTS.md) -- Full agent role descriptions
- [.claude/agents/](../../.claude/agents/) -- Agent definition files
- [.claude/team-config.json](../../.claude/team-config.json) -- Team configuration
