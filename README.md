# Linear Planning Agent

A powerful CLI tool for integrating Linear with Confluence, implementing SAFe methodology, and automating planning workflows.

## Overview

The Linear Planning Agent is a command-line tool that:

1. **Parses Confluence documents** to extract planning information
2. **Creates Linear issues** following SAFe hierarchy (Epics, Features, Stories, Enablers)
3. **Maintains SAFe relationships** between issues
4. **Synchronizes bidirectionally** between Linear and Confluence
5. **Resolves conflicts** when changes occur in both systems

This agent is designed for automation and agent-to-agent workflows, making it perfect for integration into larger automated systems.

## Installation

### Prerequisites

- Node.js 16+ and npm installed
- Docker and Docker Compose (optional, for containerized deployment)
- Linear workspace with admin access
- Confluence access

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/ByBren-LLC/A-SAFe-Pulse.git
   cd A-SAFe-Pulse
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment
   ```bash
   cp .env.template .env
   # Edit .env with your credentials
   ```

   **⚠️ IMPORTANT**: OAuth setup is required! See [OAuth Setup Guide](docs/oauth-setup.md) for detailed instructions on creating OAuth applications in Linear and Atlassian Developer Console.

4. Build the CLI
   ```bash
   npm run cli:build
   ```

## CLI Usage

The Linear Planning Agent provides a unified CLI for all operations:

```bash
# Show help
npm run cli -- --help

# Parse a Confluence document
npm run parse -- --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"

# Create Linear issues from a Confluence document
npm run create -- --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456" --org-id="your-org-id" --team-id="your-team-id"

# Start synchronization
npm run sync:start -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"

# Get synchronization status
npm run sync:status -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"

# Manually trigger synchronization
npm run sync:trigger -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"

# Stop synchronization
npm run sync:stop -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"
```

## Agent-to-Agent Workflow Examples

The CLI design enables powerful agent-to-agent workflows:

### Example 1: Automated Planning Pipeline

```bash
# Agent 1: Parse Confluence document and save planning data
npm run parse -- --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456" --output=json > planning-data.json

# Agent 2: Create Linear issues from planning data
npm run create -- --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456" --org-id="your-org-id" --team-id="your-team-id"

# Agent 3: Start synchronization to keep Linear and Confluence in sync
npm run sync:start -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"
```

### Example 2: Monitoring and Reporting

```bash
# Agent 1: Check synchronization status
STATUS=$(npm run sync:status -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456" --output=json)

# Agent 2: Generate report based on status
echo $STATUS | report-generator --format=markdown > sync-report.md

# Agent 3: Publish report to Confluence
confluence-publisher --file=sync-report.md --space=PLAN --parent=123456
```

## Docker Deployment

The Linear Planning Agent is designed to run in Docker for consistent deployment across environments.

### Quick Start with Docker

```bash
# 1. Build and start all services (PostgreSQL + App)
docker-compose up --build -d

# 2. Verify services are running
docker-compose ps

# 3. Test CLI access
docker-compose exec app npm run cli -- --help
```

### Docker CLI Access Methods

#### Method 1: Execute Commands in Running Container (Recommended)

```bash
# Start services in background
docker-compose up -d

# Run CLI commands
docker-compose exec app npm run cli -- --help
docker-compose exec app npm run cli parse --confluence-url "https://your-confluence-url"
docker-compose exec app npm run cli create --confluence-url "https://url" --org-id wordstofilmby --team-id LIN
```

#### Method 2: Interactive Shell Access

```bash
# Get shell access to the container
docker-compose exec app bash

# Inside container, run commands directly
npm run cli --help
npm run cli parse --confluence-url "https://cheddarfox.atlassian.net/wiki/spaces/..."
npm run cli create --confluence-url "https://url" --org-id wordstofilmby --team-id LIN
```

#### Method 3: One-off Commands

```bash
# Run single commands without persistent container
docker-compose run --rm app npm run cli -- --help
docker-compose run --rm app npm run cli parse --confluence-url "https://your-url"
```

### Docker CLI Examples

#### Parse a Confluence Page

```bash
docker-compose exec app npm run cli parse \
  --confluence-url "https://cheddarfox.atlassian.net/wiki/spaces/YOUR_SPACE/pages/123456/Your+Page" \
  --output json
```

#### Create Linear Issues from Confluence

```bash
docker-compose exec app npm run cli create \
  --confluence-url "https://cheddarfox.atlassian.net/wiki/spaces/YOUR_SPACE/pages/123456/Your+Page" \
  --org-id wordstofilmby \
  --team-id LIN \
  --dry-run  # Optional: test without creating issues
```

#### Start Synchronization

```bash
docker-compose exec app npm run cli sync start \
  --confluence-url "https://your-confluence-url" \
  --org-id wordstofilmby \
  --team-id LIN \
  --interval 300000 \
  --auto-resolve false
```

#### Check Sync Status

```bash
docker-compose exec app npm run cli sync status \
  --confluence-url "https://your-confluence-url" \
  --org-id wordstofilmby \
  --team-id LIN
```

#### Manually Trigger Sync

```bash
docker-compose exec app npm run cli sync trigger \
  --confluence-url "https://your-confluence-url" \
  --org-id wordstofilmby \
  --team-id LIN
```

#### Stop Synchronization

```bash
docker-compose exec app npm run cli sync stop \
  --confluence-url "https://your-confluence-url" \
  --org-id wordstofilmby \
  --team-id LIN
```

### Docker Environment Configuration

The Docker setup includes:

- **PostgreSQL Database**: For persistent data storage
- **SQLite Database**: For synchronization state
- **Express Server**: For OAuth callbacks and webhooks
- **CLI Interface**: For all planning operations

#### Environment Variables for Docker

```bash
# Database (Docker internal networking)
DATABASE_URL=postgresql://postgres:postgres@db:5432/linear_agent

# Linear Configuration
LINEAR_CLIENT_ID=your_client_id
LINEAR_CLIENT_SECRET=your_client_secret
LINEAR_REDIRECT_URI=http://localhost:3000/auth/callback
LINEAR_ORGANIZATION_ID=wordstofilmby
LINEAR_TEAM_ID=LIN

# Confluence Configuration
CONFLUENCE_USERNAME=your_email@domain.com
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret

# Slack Integration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Docker Logs and Debugging

```bash
# View all logs
docker-compose logs -f

# View app logs only
docker-compose logs -f app

# View database logs
docker-compose logs -f db

# Debug inside container
docker-compose exec app bash
```

### Docker Management

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v

# Rebuild and restart
docker-compose up --build -d

# Update just the app (after code changes)
docker-compose up --build app -d
```

## Project Structure

- `/scripts`: Automation scripts for workflow management and agent assignment
  - `start-planning-agent.sh`: Initialize planning agents for new work
  - `assign-agents.sh`: Complete agent assignment workflow automation
  - `update-wip-counts.sh`: Programmatically update documentation counts
- `/specs`: Work-In-Progress (WIP) methodology and agent specifications
  - `todo/`: Work ready for agent assignment
  - `doing/`: Work currently in progress
  - `done/`: Completed work
  - `templates/`: Reusable templates for planning and implementation
  - `kickoff_notes/`: Detailed instructions for remote agents
  - `remote_agent_assignments/`: Copy-paste ready agent assignments
- `/src`: Source code for the Linear Planning Agent
  - `/src/cli`: CLI implementation
  - `/src/confluence`: Confluence API integration
  - `/src/linear`: Linear API integration
  - `/src/planning`: Planning data extraction and processing
  - `/src/safe`: SAFe methodology implementation
  - `/src/sync`: Synchronization between Linear and Confluence

## 🤖 Automation and Agent Management

The Linear Planning Agent includes comprehensive automation for managing remote agents and workflow execution.

### Planning Automation

```bash
# Initialize planning for new work
./scripts/start-planning-agent.sh "https://confluence-url" "Feature Name"
```

### Agent Assignment Workflow

```bash
# 1. List available work
./scripts/assign-agents.sh list

# 2. Prepare work package for assignment
./scripts/assign-agents.sh prepare

# 3. Update current assignments
./scripts/assign-agents.sh update-current

# 4. Move work through WIP stages
./scripts/assign-agents.sh move [filename] doing
./scripts/assign-agents.sh move [filename] done

# 5. Update documentation counts
./scripts/update-wip-counts.sh
```

### Supported Agent Types

- **Augment Code Remote**: Full-featured remote agents
- **Claude CLI**: Command-line interface agents
- **Any SWE Agent**: Supporting GitHub, Linear, branch/PR workflows

### WIP Methodology

The project follows a Work-In-Progress methodology for systematic agent deployment:

- **todo/**: Work ready for immediate assignment
- **doing/**: Work currently being implemented by agents
- **done/**: Successfully completed and merged work
- **blocked/**: Work waiting on dependencies

For complete automation documentation, see `scripts/README.md` and `specs/README.md`.

## Webhook Integration

The Linear Planning Agent supports comprehensive webhook integration for real-time synchronization between Linear and Slack.

### Webhook Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LINEAR APP    │───▶│  YOUR SERVER    │───▶│   SLACK APP     │
│  (OAuth App)    │    │ (Planning Agent)│    │ (Incoming Hook) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
    Webhook                 Processes &              Incoming
    Events                  Forwards to              Webhook
                           Slack                     URL
```

### Required Webhooks

#### 1. Linear Webhooks (Incoming to Your Server)

- **Purpose**: Receive events from Linear (issue updates, comments, etc.)
- **URL**: `https://your-domain.com/webhook` (or `http://localhost:3000/webhook` for local)
- **Events**: Issues, Comments, Projects, Cycles, Labels, Issue attachments, Users, Permission changes
- **Security**: Verified using `WEBHOOK_SECRET` from Linear app settings

#### 2. Slack Incoming Webhooks (Outgoing from Your Server)

- **Purpose**: Send notifications TO Slack channels
- **URL**: Generated when creating Slack app (`https://hooks.slack.com/services/...`)
- **Format**: JSON payloads with formatted messages
- **Usage**: Agent notifications, error alerts, planning completion notices

### Webhook Setup Guide

#### Step 1: Linear Webhook Configuration

1. In your Linear OAuth app settings
2. Add webhook URL: `https://your-domain.com/webhook`
3. Select events: Issues, Comments, Projects, Cycles, Labels
4. Copy the webhook signing secret to `WEBHOOK_SECRET` in `.env`

#### Step 2: Slack App Creation

1. Go to https://api.slack.com/apps
2. Create new app: "WTFB Linear Planning Agent"
3. Enable "Incoming Webhooks"
4. Add webhook to workspace and select channel
5. Copy webhook URL to `SLACK_WEBHOOK_URL` in `.env`

#### Step 3: Environment Configuration

```bash
# Linear Webhook (for receiving events)
WEBHOOK_SECRET=lin_wh_your_webhook_secret_here

# Slack Webhook (for sending notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
```

### Webhook Event Flow

1. **Linear Event Occurs** (issue created, comment added, etc.)
2. **Linear Sends Webhook** to your server endpoint
3. **Server Verifies Signature** using webhook secret
4. **Server Processes Event** based on event type and action
5. **Server Sends Notification** to Slack (if configured)
6. **Slack Displays Message** in configured channel

### Supported Linear Events

- **Issues**: Created, updated, deleted, assigned, status changed
- **Comments**: Created, updated, deleted, mentions
- **Projects**: Created, updated, deleted, status changed
- **Cycles**: Created, updated, deleted, started, completed
- **Labels**: Created, updated, deleted, applied, removed
- **Users**: Permission changes, team assignments

### Slack Notification Types

- **Planning Completion**: When planning documents are processed
- **Issue Creation**: When Linear issues are created from Confluence
- **Sync Status**: Synchronization success/failure notifications
- **Error Alerts**: When errors occur in the planning agent
- **Agent Mentions**: When the agent is mentioned in Linear issues/comments

## Documentation

For detailed setup and usage instructions, see:

- [Linear Setup Guide](docs/linear-setup-guide.md)
- [Confluence Setup Guide](docs/confluence-setup-guide.md)
- [Synchronization Documentation](docs/synchronization.md)
- [OAuth Setup Guide](docs/oauth-setup.md)

## Resources

- [Linear API Documentation](https://linear.app/docs/api)
- [Linear OAuth 2.0 Authentication](https://linear.app/docs/oauth/authentication)
- [Confluence API Documentation](https://developer.atlassian.com/cloud/confluence/rest/v1/intro/)
- [SAFe Framework](https://www.scaledagileframework.com/)
