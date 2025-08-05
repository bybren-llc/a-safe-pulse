# Todo - Ready to Assign

This folder contains implementation specifications and user stories that are **ready for immediate assignment** to remote agents.

## Current Status

- **2 files** ready for assignment
- All dependencies resolved
- Implementation documents complete
- Kickoff notes available

## Contents

### Implementation Documents

- `create_linear_issues_from_planning_data-implementation.md` - Linear API integration
- `create_planning_session_ui-implementation.md` - User interface development
- `database_schema_design-implementation.md` - Database architecture
- `implement_token_management-implementation.md` - OAuth token handling
- `parse_confluence_documents-implementation.md` - Document parsing
- `synchronize_linear_with_confluence-implementation.md` - Sync functionality

### User Stories

- `system-health-monitoring-story.md` - System monitoring capabilities (LIN-45, 5 points)
- `agile-release-train-planning-story.md` - ART planning parent story (LIN-46, 16 points - DECOMPOSED)
- `story-decomposition-engine-story.md` - Story decomposition engine (LIN-47, 3 points)
- `dependency-mapping-system-story.md` - Dependency mapping system (LIN-48, 5 points)

### Additional Stories (From ART Planning Decomposition)

- `story-scoring-prioritization-story.md` - WSJF prioritization and scoring (LIN-50, 3 points) - **NEEDS IMPLEMENTATION DOC**
- `art-iteration-planning-story.md` - ART iteration planning (LIN-49, 5 points) - **NEEDS IMPLEMENTATION DOC**

### Separate Projects

- `agent-workflow-planner-confluence-planning.md` - OSS project planning (LIN-43) - **SEPARATE PROJECT**

## Assignment Process

### For Project Managers

1. **Select Work**: Choose from available files based on priority
2. **Copy Assignment**: Use `../remote_agent_assignments/current.md` templates
3. **Assign Agent**: Send copy-paste assignment to remote agent
4. **Track Progress**: Monitor agent acknowledgment and Linear issue creation

### For Remote Agents

1. **Receive Assignment**: Get copy-paste assignment with all links
2. **Create Linear Issue**: Follow kickoff note instructions
3. **Move File**: When starting work, move file to `../doing/`
4. **Begin Implementation**: Follow implementation document specifications

## File Movement

### When Agent Starts Work

```bash
git mv specs/todo/[filename] specs/doing/[filename]
```

### Assignment Template Reference

All files in this folder have corresponding:

- **Kickoff Note**: `../kickoff_notes/[task_name]_kickoff.md`
- **Assignment Template**: `../remote_agent_assignments/current.md`

## Quality Assurance

### Before Assignment

- ✅ Implementation document is complete
- ✅ Kickoff note exists and is accurate
- ✅ All dependencies are resolved
- ✅ Linear team and project information is current

### Assignment Checklist

- [ ] Agent receives complete assignment with all links
- [ ] Agent acknowledges assignment and creates Linear issue
- [ ] File is moved to `doing/` folder when work begins
- [ ] Progress is tracked through Linear issue updates

## Dependencies

Files in this folder have **no blocking dependencies** and can be assigned immediately. If dependencies are discovered, move the file to `../blocked/` folder.

## Integration

### Linear Integration

- All files reference correct Linear teams and projects
- Kickoff notes include Linear issue creation instructions
- Implementation documents align with Linear workflow

### GitHub Integration

- All file references use `dev` branch
- Assignment templates include correct repository links
- Branch naming follows project conventions

## Next Steps

1. **Immediate**: Files are ready for assignment
2. **Assignment**: Use remote agent assignment process
3. **Progress**: Track through WIP folder transitions
4. **Completion**: Move to `../done/` when implemented and merged
