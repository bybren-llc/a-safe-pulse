# WTFB Linear Agents Specifications

This directory contains all specifications, documentation, and workflow management for the WTFB Linear Agents project, organized using a Work-In-Progress (WIP) methodology.

## WIP Organization Structure

### 📋 `todo/` - Ready to Assign

Implementation specifications and stories ready for remote agent assignment.

- **2 files** ready for immediate assignment
- Implementation documents for features and technical enablers
- User stories and technical specifications

### 🔄 `doing/` - Currently In Progress

Work items currently being implemented by remote agents.

- Move files here when agents start working
- Track active development progress
- Monitor for completion

### ✅ `done/` - Completed Work

Successfully implemented and merged specifications.

- **4 completed implementations**
- Reference materials for completed features
- Historical record of delivered work

### 🚫 `blocked/` - Waiting on Dependencies

Work items blocked by external dependencies.

- **0 blocked files** waiting on authentication infrastructure
- Clear dependency documentation
- Ready to move to `todo/` when unblocked

### 📚 `templates/` - Reusable Templates

Standard templates for consistent documentation.

- Planning templates for SAFe methodology
- Remote agent workflow templates
- User story and technical enabler templates

### 📝 `kickoff_notes/` - Reference Materials

Detailed kickoff instructions for remote agents.

- Comprehensive task context and requirements
- Linear issue creation instructions
- Implementation guidance and dependencies

### 🎯 `remote_agent_assignments/` - Assignment Management

Copy-paste ready assignments for remote agents.

- Current active assignments
- Historical assignment tracking
- Assignment templates for future use

### 📦 `archive/` - Superseded Documents

Old planning documents and superseded specifications.

- Historical planning materials
- Deprecated documentation
- Reference for project evolution

## Workflow Usage

### 🎯 Complete Agent Assignment Process

#### **Phase 1: Planning and Preparation**

```bash
# 1. Update WIP folder counts
./scripts/update-wip-counts.sh

# 2. List available work
./scripts/assign-agents.sh list

# 3. Prepare current work package
./scripts/assign-agents.sh prepare

# 4. Update current assignments
./scripts/assign-agents.sh update-current
```

#### **Phase 2: Agent Assignment**

```bash
# 5. Copy assignments from specs/remote_agent_assignments/current.md
# 6. Send to remote agents:
#    - Augment Code Remote agents
#    - Claude CLI agents
#    - Other SWE agents
```

#### **Phase 3: Work Execution**

```bash
# 7. When agent starts work
./scripts/assign-agents.sh move [filename] doing

# 8. When agent completes work
./scripts/assign-agents.sh move [filename] done

# 9. Update counts after changes
./scripts/update-wip-counts.sh
```

### For Project Managers

1. **Plan Work**: Use `./scripts/start-planning-agent.sh` for new planning
2. **Assign Work**: Use `./scripts/assign-agents.sh` workflow above
3. **Track Progress**: Monitor files moving through `todo/` → `doing/` → `done/`
4. **Manage Blockers**: Review `blocked/` folder for dependency issues

### For Remote Agents (Any Type)

1. **Get Assignment**: Receive copy-paste assignment with all necessary links
2. **Read Kickoff**: Follow kickoff note for detailed context
3. **Study Implementation**: Review implementation document in appropriate WIP folder
4. **Create Linear Issue**: Follow kickoff note instructions
5. **Implement**: Create branch, implement, submit PR
6. **Update Status**: PM moves files through WIP stages

### For ARCHitect-in-the-IDE

1. **Review Progress**: Monitor WIP folder transitions
2. **Unblock Work**: Move items from `blocked/` to `todo/` when dependencies resolve
3. **Quality Control**: Ensure completed work moves to `done/` folder
4. **Architectural Oversight**: Review PRs for architectural compliance

## File Movement Guidelines

### Moving to `doing/`

When an agent starts work:

```bash
git mv specs/todo/[filename] specs/doing/[filename]
```

### Moving to `done/`

When work is completed and merged:

```bash
git mv specs/doing/[filename] specs/done/[filename]
```

### Unblocking Work

When dependencies are resolved:

```bash
git mv specs/blocked/[filename] specs/todo/[filename]
```

## Current Status

- **Todo**: 2 files ready for assignment
- **Doing**: 0 files (ready for active work)
- **Done**: 4 completed implementations
- **Blocked**: 0 blocked files
- **Templates**: 5 reusable templates
- **Kickoff Notes**: 26 detailed agent instructions

## Integration with Tools

### Linear Integration

- All kickoff notes include Linear issue creation instructions
- Implementation documents reference Linear team and project structure
- WIP status aligns with Linear issue states

### GitHub Integration

- All file references use `dev` branch
- PR workflow supports WIP folder transitions
- Branch naming follows WIP organization

### Remote Agent Workflow

- Copy-paste assignments include all necessary file links
- Agents work with local files to reduce API calls
- Clear progression through WIP stages

## 🤖 Automation Scripts

### Planning Scripts

- **`./scripts/start-planning-agent.sh`** - Initialize planning agents for new work
- **`./scripts/update-wip-counts.sh`** - Programmatically update file counts in READMEs

### Assignment Scripts

- **`./scripts/assign-agents.sh list`** - List available work with status
- **`./scripts/assign-agents.sh status`** - Show current WIP status
- **`./scripts/assign-agents.sh prepare`** - Prepare work packages for assignment
- **`./scripts/assign-agents.sh update-current`** - Update current assignments
- **`./scripts/assign-agents.sh move [file] [target]`** - Move files through WIP workflow

### Supported Agent Types

- **Augment Code Remote** - Full-featured remote agents
- **Claude CLI** - Command-line interface agents
- **Other SWE Agents** - Any software engineering agent that can:
  - Read GitHub repositories
  - Create branches and PRs
  - Follow detailed instructions
  - Create Linear issues

## 🎯 Complete Workflow Example

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

This workflow enables systematic deployment of any number of agents across different platforms while maintaining SAFe methodology compliance and architectural oversight.
