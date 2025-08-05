# Linear Planning Agent

A comprehensive enterprise-grade CLI tool for SAFe methodology implementation, ART planning automation, and Linear-Confluence integration.

## Overview

The Linear Planning Agent is an advanced command-line tool that provides:

### 🎯 **Core Capabilities**
1. **ART Iteration Planning** - Automated Agile Release Train planning with dependency-aware allocation
2. **Value Delivery Validation** - Sophisticated value stream analysis and working software validation
3. **Story Decomposition** - Intelligent breakdown of large stories into implementable sub-stories
4. **Dependency Mapping** - Automated dependency identification and management
5. **Linear-Confluence Integration** - Bidirectional synchronization with conflict resolution

### 🏛️ **SAFe Methodology Compliance**
- **Program Increment Planning** - Complete PI planning automation
- **Iteration Management** - Capacity-aware work allocation across teams
- **Value Stream Analysis** - 5-stream taxonomy with business impact quantification
- **Quality Gates** - 4-gate validation pipeline ensuring deployable software
- **Dependency Management** - Topological sorting for proper work sequencing
- **Team Capacity** - Multi-factor realistic capacity modeling

### 🚀 **Enterprise Features**
- **Optimization Engine** - AI-driven ART readiness improvement recommendations
- **Performance Analytics** - Comprehensive metrics and business impact tracking
- **Multi-Team Scaling** - Support for large-scale enterprise ART coordination
- **Operational Intelligence** - System health monitoring and Slack notifications

This agent is designed for enterprise automation and agent-to-agent workflows, making it perfect for integration into larger SAFe transformation systems.

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

## 🎯 ART Planning & SAFe Automation

### ART Iteration Planning

The Linear Planning Agent provides sophisticated ART (Agile Release Train) planning capabilities:

```bash
# Plan a complete ART for a Program Increment
npm run cli art-plan --pi-id="PI-2025-Q1" --team-id="your-team-id" --org-id="your-org-id"

# Plan with specific configuration
npm run cli art-plan --pi-id="PI-2025-Q1" --team-id="your-team-id" --iterations=6 --buffer-capacity=0.2

# Validate ART readiness
npm run cli art-validate --pi-id="PI-2025-Q1" --team-id="your-team-id"

# Optimize ART plan for value delivery
npm run cli art-optimize --pi-id="PI-2025-Q1" --team-id="your-team-id" --enable-value-optimization
```

### Story Decomposition & Dependency Mapping

```bash
# Decompose large stories into implementable sub-stories
npm run cli story-decompose --story-id="STORY-123" --max-points=5

# Map dependencies between work items
npm run cli dependency-map --team-id="your-team-id" --scope="current-pi"

# Update story priorities using WSJF
npm run cli story-score --team-id="your-team-id" --update-priorities
```

### Value Delivery Analysis

```bash
# Analyze value delivery for an iteration
npm run cli value-analyze --iteration-id="IT-2025-01" --team-id="your-team-id"

# Validate working software readiness
npm run cli working-software-validate --iteration-id="IT-2025-01" --quality-gates

# Generate value delivery report
npm run cli value-report --pi-id="PI-2025-Q1" --format=json --output=value-report.json
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

### Example 3: Enterprise ART Planning Automation

```bash
# Agent 1: Decompose large stories and map dependencies
npm run cli story-decompose --team-id="your-team-id" --max-points=5 --auto-create
npm run cli dependency-map --team-id="your-team-id" --scope="current-pi" --auto-link

# Agent 2: Execute ART planning with optimization
npm run cli art-plan --pi-id="PI-2025-Q1" --team-id="your-team-id" --enable-value-optimization --output=json > art-plan.json

# Agent 3: Validate and optimize the plan
READINESS=$(npm run cli art-validate --pi-id="PI-2025-Q1" --team-id="your-team-id" --output=json)
if [ $(echo $READINESS | jq '.readinessScore < 0.85') = "true" ]; then
  npm run cli art-optimize --pi-id="PI-2025-Q1" --team-id="your-team-id" --auto-apply
fi

# Agent 4: Generate comprehensive reports
npm run cli value-report --pi-id="PI-2025-Q1" --format=confluence --output=pi-report.md
npm run cli dependency-report --team-id="your-team-id" --format=json --output=dependencies.json

# Agent 5: Update Linear with optimized plan and sync to Confluence
npm run cli linear-sync --pi-id="PI-2025-Q1" --team-id="your-team-id" --create-cycles
npm run sync:start -- --org-id="your-org-id" --team-id="your-team-id" --confluence-url="https://example.atlassian.net/wiki/spaces/PLAN/pages/123456"
```

### Example 4: Continuous Value Delivery Monitoring

```bash
# Agent 1: Monitor iteration progress and value delivery
ITERATION_STATUS=$(npm run cli value-analyze --iteration-id="current" --team-id="your-team-id" --output=json)

# Agent 2: Validate working software readiness
DEPLOYMENT_READY=$(npm run cli working-software-validate --iteration-id="current" --team-id="your-team-id" --output=json)

# Agent 3: Generate alerts if value delivery is at risk
if [ $(echo $ITERATION_STATUS | jq '.valueDeliveryScore < 0.8') = "true" ]; then
  npm run cli alert-send --type="value-risk" --iteration-id="current" --team-id="your-team-id"
fi

# Agent 4: Auto-optimize if deployment readiness is low
if [ $(echo $DEPLOYMENT_READY | jq '.readinessScore < 0.85') = "true" ]; then
  npm run cli working-software-optimize --iteration-id="current" --team-id="your-team-id" --auto-apply
fi
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
