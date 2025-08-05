# Linear Planning Agent Setup Checklist

This document provides a comprehensive checklist for setting up and deploying the Linear Planning Agent, with a focus on local Docker Desktop deployment for testing.

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Linear Configuration](#2-linear-configuration)
3. [Confluence Configuration](#3-confluence-configuration)
4. [Database Setup](#4-database-setup)
5. [Application Deployment](#5-application-deployment)
6. [Testing the Integration](#6-testing-the-integration)
7. [Verify Functionality](#7-verify-functionality)
8. [Documentation Reference](#8-documentation-reference)
9. [Environment Variables Checklist](#9-environment-variables-checklist)
10. [Troubleshooting Quick Reference](#10-troubleshooting-quick-reference)
11. [Advanced Configuration](#11-advanced-configuration)

## 1. Environment Setup

- [ ] Clone the repository
  ```bash
  git clone https://github.com/ByBren-LLC/A-SAFe-Pulse.git
  cd A-SAFe-Pulse
  ```

- [ ] Create environment file
  ```bash
  cp .env.template .env
  ```

## 2. Linear Configuration

### OAuth Application Setup

- [ ] Create Linear OAuth application
  - Navigate to Linear > Settings > API > OAuth applications
  - Click "Create new application"
  - Fill in the following details:
    - **Name**: Linear Planning Agent
    - **Redirect URI**: `http://localhost:3000/auth/callback` (for local) or your production URL
    - **Description**: Agent for synchronizing Linear with Confluence following SAFe methodology
    - **Icon**: (Optional) Upload an icon for your application
  - Request the following scopes:
    - **Issues**: Read and Write
    - **Teams**: Read
    - **Users**: Read
    - **Organizations**: Read
    - **Comments**: Read and Write
    - **Cycles**: Read
    - **Projects**: Read
    - **Labels**: Read
  - Click "Create"
  - Copy the **Client ID** and **Client Secret** to your `.env` file:
    ```
    LINEAR_CLIENT_ID=your_client_id
    LINEAR_CLIENT_SECRET=your_client_secret
    LINEAR_REDIRECT_URI=http://localhost:3000/auth/callback
    ```

### Webhook Configuration

- [ ] Configure Linear webhook
  - Navigate to Linear > Settings > API > Webhooks
  - Click "New webhook"
  - Fill in the following details:
    - **URL**: `http://localhost:3000/webhook` (for local) or your production URL
    - **Resource types**: Select Issues, Comments, Projects, Cycles, Labels
  - Click "Create webhook"
  - Copy the **Webhook Secret** to your `.env` file:
    ```
    WEBHOOK_SECRET=your_webhook_secret
    ```

### Team and Organization IDs

- [ ] Get Linear Team and Organization IDs
  - **Team ID**: 
    - Navigate to Linear > Settings > Teams
    - Select your team
    - Copy the ID from the URL: `https://linear.app/settings/teams/{team-id}`
  - **Organization ID**:
    - Navigate to Linear > Settings > Organization
    - Copy the ID from the URL: `https://linear.app/settings/organization/{organization-id}`
  - Add these to your `.env` file:
    ```
    LINEAR_ORGANIZATION_ID=your_organization_id
    LINEAR_TEAM_ID=your_linear_team_id
    ```

## 3. Confluence Configuration

### API Token Creation

- [ ] Create Atlassian API token
  - Go to [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
  - Click "Create API token"
  - Enter a label: "Linear Planning Agent"
  - Click "Create"
  - Copy the token (you won't be able to see it again)
  - Add to your `.env` file:
    ```
    CONFLUENCE_USERNAME=your_atlassian_email
    CONFLUENCE_API_TOKEN=your_api_token
    CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
    ```

### Confluence Page Structure

- [ ] Set up Confluence page structure
  - Create or identify a space for planning documents
  - Create a planning page with the following structure:
    ```
    # Project Planning Document
    
    ## Epic: [Epic Name]
    
    ### Feature: [Feature 1]
    
    #### User Story: [Story 1]
    [Description]
    
    #### User Story: [Story 2]
    [Description]
    
    ### Feature: [Feature 2]
    
    #### Technical Enabler: [Enabler 1]
    [Description]
    ```
  - Note the page URL for later use

### Access Permissions

- [ ] Configure access permissions
  - Ensure your Confluence user has edit permissions for the planning page
  - If using a service account, grant it appropriate permissions

## 4. Database Setup

- [ ] Create data directory for SQLite (if not using Docker)
  ```bash
  mkdir -p data
  ```

- [ ] Update database connection strings in `.env` file
  ```
  DATABASE_URL=postgresql://postgres:postgres@db:5432/linear_agent
  SQLITE_DB_PATH=/app/data/sync.db  # For Docker
  # or
  SQLITE_DB_PATH=./data/sync.db     # For local development
  ```

## 5. Application Deployment

### Docker Deployment (Recommended)

- [ ] Build and start the containers
  ```bash
  docker-compose up --build -d
  ```

- [ ] View logs
  ```bash
  docker-compose logs -f
  ```

### Local Development

- [ ] Install dependencies
  ```bash
  npm install
  ```

- [ ] Start the development server
  ```bash
  npm run dev
  ```

## 6. Testing the Integration

### Linear Authentication

- [ ] Authenticate with Linear
  - Navigate to `http://localhost:3000/auth` in your browser
  - You'll be redirected to Linear to authorize the application
  - Grant the requested permissions
  - You'll be redirected back to the application

### Testing Parsing

- [ ] Test parsing Confluence page
  ```bash
  # Using the CLI
  npm run parse -- --confluence-url="your-confluence-page-url"
  
  # Or using the script
  ./scripts/start-planning-agent.sh "your-confluence-page-url" "Page Title"
  ```

### Testing Webhook

- [ ] Test webhook
  - Create or update an issue in Linear
  - Check application logs for webhook event:
    ```bash
    docker-compose logs -f
    ```

### Testing Synchronization

- [ ] Test synchronization
  ```bash
  npm run sync:start -- --org-id=your-organization-id --team-id=your-linear-team-id --confluence-url="your-confluence-page-url"
  ```

## 7. Verify Functionality

- [ ] Verify Confluence parsing works correctly
  - Check that the planning document structure is correctly parsed
  - Verify that epics, features, stories, and enablers are identified

- [ ] Verify Linear issue creation works correctly
  - Check that issues are created with the correct hierarchy
  - Verify that parent-child relationships are maintained

- [ ] Verify bidirectional synchronization works correctly
  - Make a change in Linear and verify it's reflected in Confluence
  - Make a change in Confluence and verify it's reflected in Linear

- [ ] Verify conflict detection and resolution works correctly
  - Make conflicting changes in both Linear and Confluence
  - Verify that conflicts are detected and resolved according to configuration

## 8. Documentation Reference

If you encounter any issues, refer to these documentation files:

- Main Setup Guide: `docs/setup-guide.md`
- Linear Setup Guide: `docs/linear-setup-guide.md`
- Confluence Setup Guide: `docs/confluence-setup-guide.md`
- Synchronization Documentation: `docs/synchronization.md`

## 9. Environment Variables Checklist

Ensure these variables are set in your `.env` file:

```
# Linear OAuth Application Credentials
LINEAR_CLIENT_ID=your_client_id
LINEAR_CLIENT_SECRET=your_client_secret
LINEAR_REDIRECT_URI=http://localhost:3000/auth/callback

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret

# Linear Organization and Team IDs
LINEAR_ORGANIZATION_ID=your_organization_id
LINEAR_TEAM_ID=your_team_id

# Confluence API Credentials
CONFLUENCE_USERNAME=your_atlassian_email
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@db:5432/linear_agent
SQLITE_DB_PATH=/app/data/sync.db

# Server Configuration
PORT=3000
NODE_ENV=production

# Security
ENCRYPTION_KEY=generate_a_strong_random_key_at_least_32_chars
```

## 10. Troubleshooting Quick Reference

- **Authentication Errors**: 
  - Check Linear/Confluence credentials and OAuth configuration
  - Verify redirect URI matches exactly what's configured in Linear
  - Check that all required scopes are granted

- **Webhook Issues**: 
  - Ensure webhook URL is accessible from the internet
  - Verify webhook secret is correct
  - Check that the webhook is configured for the correct resource types

- **Database Connection Issues**: 
  - Verify connection strings are correct
  - Check that the database exists and is accessible
  - Ensure the application has write permissions to the database

- **Synchronization Issues**: 
  - Check Confluence page structure follows the expected format
  - Verify Linear team and organization IDs are correct
  - Check that the user has appropriate permissions in both systems

- **For detailed logs**: 
  - Run with `NODE_ENV=development` for more verbose output
  - Check Docker logs: `docker-compose logs -f`

## 11. Advanced Configuration

### Customizing Synchronization Behavior

You can customize the synchronization behavior by modifying the following options when starting synchronization:

```bash
npm run sync:start -- --org-id=your-organization-id --team-id=your-linear-team-id --confluence-url="your-confluence-page-url" --interval=300000 --auto-resolve=true
```

- `--interval`: Synchronization interval in milliseconds (default: 300000, or 5 minutes)
- `--auto-resolve`: Whether to automatically resolve conflicts (default: false)

### Running Behind a Proxy

If you're running the application behind a proxy, you'll need to set the following environment variables:

```
HTTP_PROXY=http://your-proxy:port
HTTPS_PROXY=http://your-proxy:port
NO_PROXY=localhost,127.0.0.1
```

### Using a Custom SSL Certificate

If you're using a custom SSL certificate, you can configure it by setting the following environment variables:

```
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### Running Multiple Instances

If you want to run multiple instances of the Linear Planning Agent, you'll need to:

1. Use different ports for each instance
2. Configure different redirect URIs in Linear
3. Use different database paths for each instance

This can be useful for testing different configurations or for supporting multiple teams or projects.
