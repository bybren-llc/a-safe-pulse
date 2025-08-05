# WTFB Linear Agents Scripts

This directory contains automation scripts for the WTFB Linear Agents project, supporting complete workflow management from planning to agent assignment and execution tracking.

## 🎯 Script Categories

### 📋 Planning Scripts

Scripts for initializing new work and planning sessions.

### 🤖 Assignment Scripts

Scripts for managing agent assignments and workflow automation.

### 📊 Utility Scripts

Scripts for maintenance and status reporting.

---

## 📋 Planning Scripts

### start-planning-agent.sh

Initializes a planning agent with instructions to analyze Confluence documentation and create properly structured Linear issues following SAFe methodology.

#### Usage

```bash
./scripts/start-planning-agent.sh [CONFLUENCE_PAGE_URL] [PLANNING_TITLE]
```

#### Example

```bash
./scripts/start-planning-agent.sh "https://cheddarfox.atlassian.net/wiki/spaces/WA/pages/123456789" "Collaborative Screenplay Editing"
```

#### Features

- Creates planning instructions file with task context
- Generates proper filename from planning title
- Validates required template files exist
- Supports automatic agent startup with AUTOSTART=true
- Follows SAFe methodology for work breakdown

#### Output

- Creates `specs/planning_instructions_[title].md` with complete agent instructions
- Provides command to start Augment agent with proper context

---

## 🤖 Assignment Scripts

### assign-agents.sh

Complete agent assignment workflow automation supporting any type of SWE agent (Augment Code Remote, Claude CLI, etc.).

#### Commands

##### List Available Work

```bash
./scripts/assign-agents.sh list
```

Shows all work items in `/todo` with their status:

- ✅ Kickoff notes available
- 📋 Assignment templates ready
- ⚠️ Missing dependencies

##### Show Assignment Status

```bash
./scripts/assign-agents.sh status
```

Displays current WIP status and active assignments:

- Todo/Doing/Done file counts
- Current assignment summaries

##### Prepare Work Package

```bash
./scripts/assign-agents.sh prepare
```

Prepares current work package for agent deployment:

- Shows available assignments
- Provides deployment guidance
- Lists next steps for assignment

##### Update Current Assignments

```bash
./scripts/assign-agents.sh update-current
```

Updates current assignments with latest work package:

- Copies latest assignments to `specs/remote_agent_assignments/current.md`
- Fixes branch references (main → dev)
- Creates backup of previous assignments

##### Move Files Through Workflow

```bash
./scripts/assign-agents.sh move [filename] [target_folder]
```

Moves files through WIP workflow stages:

- `todo` → `doing` (when agent starts work)
- `doing` → `done` (when work completes)
- Supports any WIP folder transition
- Uses `git mv` for proper version control

##### Help and Documentation

```bash
./scripts/assign-agents.sh help
```

Shows complete command reference and workflow example.

#### Supported Agent Types

- **Augment Code Remote** - Full-featured remote agents
- **Claude CLI** - Command-line interface agents
- **Any SWE Agent** - Supporting GitHub, Linear, branch/PR workflows

#### Features

- Color-coded output for better readability
- Automatic file discovery and status checking
- Proper git integration for file movement
- Complete workflow guidance
- Error handling and validation

---

## 📊 Utility Scripts

### update-wip-counts.sh

Programmatically updates file counts in all WIP folder README files.

#### Usage

```bash
./scripts/update-wip-counts.sh
```

#### Features

- Counts `.md` files in all WIP folders (excluding README.md)
- Updates `specs/README.md` with accurate counts
- Updates `specs/todo/README.md` with todo-specific counts
- Provides commit guidance for changes
- Eliminates manual count maintenance

#### Output

- Updated file counts in README files
- Summary of changes made
- Git commit command suggestions

---

## 🔄 Complete Workflow Example

```bash
# 1. Plan new work (if needed)
./scripts/start-planning-agent.sh "https://confluence-url" "Feature Name"

# 2. Prepare assignments for current work
./scripts/update-wip-counts.sh
./scripts/assign-agents.sh list
./scripts/assign-agents.sh prepare
./scripts/assign-agents.sh update-current

# 3. Send assignments to agents (copy from specs/remote_agent_assignments/current.md)

# 4. Track work progress
./scripts/assign-agents.sh move enhanced-slack-notifier-story.md doing
./scripts/assign-agents.sh move enhanced-slack-notifier-story.md done

# 5. Update documentation
./scripts/update-wip-counts.sh
```

---

## 🛠️ Script Development Guidelines

### Adding New Scripts

When adding new scripts to this directory:

1. **Naming Convention**: Use descriptive names with hyphens
   - Planning: `start-[type]-agent.sh`
   - Assignment: `assign-[function].sh`
   - Utility: `update-[target].sh`

2. **Documentation**: Include detailed comments and usage instructions

3. **Error Handling**: Implement proper error checking and user feedback

4. **Integration**: Ensure compatibility with existing workflow

5. **Testing**: Test all functionality before committing

6. **README Updates**: Update this README with new script information

### Script Standards

- Use `#!/bin/bash` shebang
- Include script description header
- Implement `set -e` for error handling
- Use color-coded output for user feedback
- Provide help/usage information
- Include examples in documentation

### Dependencies

Scripts may require:

- Git (for file movement and version control)
- Linear CLI (for issue management)
- Augment CLI (for agent startup)
- Standard Unix utilities (find, grep, sed, etc.)

---

## 📚 Integration

These scripts integrate with:

- **specs/** folder structure and WIP methodology
- **Linear** project management and issue tracking
- **GitHub** repository and branch management
- **SAFe** methodology and workflow compliance
- **Remote agents** across multiple platforms

For detailed workflow documentation, see:

- `specs/README.md` - Complete WIP methodology
- `specs/templates/remote_agent_workflow.md` - Agent workflow details
