# OAuth Applications Setup Guide

This guide provides step-by-step instructions for creating OAuth applications in Linear and Atlassian Developer Console, and validating the complete OAuth flow in the local Docker environment.

## Overview

The Linear Planning Agent requires OAuth authentication with both Linear and Confluence to function properly. This setup enables:

- **Linear Integration**: Create and manage Linear issues, teams, and projects
- **Confluence Integration**: Read Confluence content, spaces, and user information
- **Secure Token Management**: Encrypted storage and automatic refresh of OAuth tokens

## Prerequisites

- Admin access to a Linear workspace
- Admin access to an Atlassian/Confluence instance
- Docker and Docker Compose installed
- Git repository cloned locally

## Phase 1: Create Linear OAuth Application

### Step 1: Access Linear Settings

1. Log into your Linear workspace as an admin
2. Navigate to **Settings** > **API** > **OAuth Applications**
3. Click **Create OAuth Application**

### Step 2: Configure Linear OAuth Application

Fill in the following details:

- **Name**: `Linear Planning Agent (Development)`
- **Description**: `Development OAuth app for Linear Planning Agent`
- **Redirect URI**: `http://localhost:3000/auth/callback`
- **Scopes**: Leave default (read access to workspace data)

### Step 3: Save Linear Credentials

After creating the application:

1. Copy the **Client ID**
2. Copy the **Client Secret** (keep this secure!)
3. Note these values for environment configuration

## Phase 2: Create Atlassian OAuth Application

### Step 1: Access Atlassian Developer Console

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Log in with your Atlassian account
3. Click **Create** > **OAuth 2.0 (3LO)**

### Step 2: Configure Atlassian OAuth Application

Fill in the following details:

- **Name**: `Linear Planning Agent (Development)`
- **Description**: `Development OAuth app for Confluence integration`
- **App type**: OAuth 2.0 (3LO)

### Step 3: Configure Permissions and Callback URL

1. **Callback URL**: `http://localhost:3000/auth/confluence/callback`
2. **Scopes**: Add the following scopes:
   - `read:confluence-content.all` (read Confluence content)
   - `read:confluence-space.summary` (read space information)
   - `read:confluence-user` (read user information)

### Step 4: Save Atlassian Credentials

After creating the application:

1. Copy the **Client ID**
2. Copy the **Client Secret** (keep this secure!)
3. Note these values for environment configuration

## Phase 3: Environment Configuration

### Step 1: Create .env File

1. Copy the template file:
   ```bash
   cp .env.template .env
   ```

2. Update the `.env` file with your OAuth credentials:

```env
# Linear OAuth Application Credentials
LINEAR_CLIENT_ID=your_linear_client_id_here
LINEAR_CLIENT_SECRET=your_linear_client_secret_here
LINEAR_REDIRECT_URI=http://localhost:3000/auth/callback

# Confluence OAuth Application Credentials
CONFLUENCE_CLIENT_ID=your_confluence_client_id_here
CONFLUENCE_CLIENT_SECRET=your_confluence_client_secret_here

# Application Configuration
APP_URL=http://localhost:3000
SESSION_SECRET=generate_a_strong_random_session_secret_at_least_32_chars

# Webhook Configuration
WEBHOOK_SECRET=generate_a_random_string

# Database Connection
DATABASE_URL=postgresql://username:password@localhost:5432/linear_agent

# Security
ENCRYPTION_KEY=generate_a_strong_random_key_at_least_32_chars

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Step 2: Generate Secure Secrets

Generate secure random strings for:

- **SESSION_SECRET**: At least 32 characters
- **WEBHOOK_SECRET**: Random string
- **ENCRYPTION_KEY**: At least 32 characters

You can use this command to generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Phase 4: Test OAuth Flows

### Step 1: Start Docker Environment

1. Build and start the Docker containers:
   ```bash
   docker-compose up --build
   ```

2. Wait for the application to start (you should see "Server is running on port 3000")

### Step 2: Test Linear OAuth Flow

1. Open your browser and navigate to: `http://localhost:3000/auth`
2. You should be redirected to Linear's authorization page
3. Click **Authorize** to grant permissions
4. You should be redirected back to a success page
5. Check the Docker logs to confirm token storage

### Step 3: Test Confluence OAuth Flow

1. Open your browser and navigate to: `http://localhost:3000/auth/confluence`
2. You should be redirected to Atlassian's authorization page
3. Click **Accept** to grant permissions
4. You should be redirected back to a success page
5. Check the Docker logs to confirm token storage

### Step 4: Verify Token Storage

1. Connect to the PostgreSQL database:
   ```bash
   docker exec -it <postgres_container_id> psql -U postgres -d linear_agent
   ```

2. Check stored tokens:
   ```sql
   SELECT organization_id, created_at FROM linear_tokens;
   SELECT organization_id, created_at FROM confluence_tokens;
   ```

## Phase 5: Testing and Validation

### Manual Testing Checklist

- [ ] Linear OAuth application created successfully
- [ ] Atlassian OAuth application created successfully
- [ ] Environment variables configured correctly
- [ ] Docker environment starts without errors
- [ ] Linear OAuth flow completes successfully
- [ ] Confluence OAuth flow completes successfully
- [ ] Tokens stored correctly in database
- [ ] Success pages display correctly

### Error Scenario Testing

Test the following error scenarios:

1. **OAuth Denial**: Click "Cancel" during OAuth flow
2. **Invalid Credentials**: Use incorrect client ID/secret
3. **Network Errors**: Test with network connectivity issues
4. **Token Expiration**: Test token refresh mechanisms

### API Integration Testing

After successful OAuth setup, test API calls:

1. **Linear API Test**:
   ```bash
   curl -H "Authorization: Bearer <access_token>" \
        -H "Content-Type: application/json" \
        -d '{"query": "{ viewer { id name } }"}' \
        https://api.linear.app/graphql
   ```

2. **Confluence API Test**:
   ```bash
   curl -H "Authorization: Bearer <access_token>" \
        https://api.atlassian.com/ex/confluence/<site_id>/rest/api/content
   ```

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Ensure the redirect URI in your OAuth app matches exactly: `http://localhost:3000/auth/callback`
   - Check for trailing slashes or typos

2. **"Client authentication failed"**
   - Verify CLIENT_ID and CLIENT_SECRET are correct
   - Ensure no extra spaces or characters in environment variables

3. **"Session not found"**
   - Ensure SESSION_SECRET is set
   - Check that session middleware is properly configured

4. **Database connection errors**
   - Verify PostgreSQL container is running
   - Check DATABASE_URL format and credentials

5. **Token storage failures**
   - Ensure ENCRYPTION_KEY is set and at least 32 characters
   - Check database permissions and table creation

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed logs for OAuth flows and token management.

### Reset OAuth Setup

To reset and start over:

1. Stop Docker containers: `docker-compose down`
2. Remove volumes: `docker volume prune`
3. Delete OAuth applications from Linear and Atlassian
4. Clear `.env` file and start from Phase 3

## Phase 6: Token Migration (Long-lived to Short-lived)

Linear is deprecating long-lived OAuth access tokens. This section covers migrating existing tokens to short-lived access tokens with refresh token rotation.

### Prerequisites

1. Enable refresh tokens in your Linear OAuth application:
   - Go to **Settings** > **API** > **OAuth Applications** > your app
   - Enable **"Use refresh tokens"**
   - Save changes

2. Set the `ADMIN_API_KEY` environment variable (used to authenticate migration endpoints):
   ```bash
   ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   ```

### Step 1: Check Current Token Status

```bash
curl -H "x-admin-api-key: YOUR_ADMIN_API_KEY" \
     http://localhost:3000/auth/token-status
```

This returns expiration times and migration status for all organizations.

### Step 2: Migrate Tokens

For each organization with `migration_status: "pending"`:

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "x-admin-api-key: YOUR_ADMIN_API_KEY" \
     -d '{"organizationId": "YOUR_ORG_ID"}' \
     http://localhost:3000/auth/migrate
```

The migration is idempotent -- safe to re-run if needed.

### Step 3: Verify Migration

```bash
curl -H "x-admin-api-key: YOUR_ADMIN_API_KEY" \
     http://localhost:3000/auth/token-status
```

Confirm all organizations show `migration_status: "migrated"`.

### Rollback

If migration causes issues, the old access token is preserved in the database (`old_access_token` column). Contact the development team for manual rollback procedures.

### How Token Refresh Works Post-Migration

After migration, the system automatically:
- Checks token expiry before each Linear API call
- Proactively refreshes tokens within 1 hour of expiry (not just on 401)
- Rotates refresh tokens on each refresh (Linear provides a new refresh token with each refresh)

## Security Best Practices

1. **Never commit OAuth credentials** to version control
2. **Use strong, unique secrets** for SESSION_SECRET and ENCRYPTION_KEY
3. **Regularly rotate OAuth credentials** in production
4. **Monitor OAuth application usage** in Linear and Atlassian consoles
5. **Use HTTPS in production** environments
6. **Implement proper session management** with appropriate timeouts

## Production Considerations

When deploying to production:

1. **Update redirect URIs** to production URLs
2. **Create separate OAuth applications** for production
3. **Use environment-specific secrets**
4. **Enable HTTPS** for all OAuth flows
5. **Implement proper logging and monitoring**
6. **Set up automated token refresh** monitoring

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs app`
3. Verify OAuth application configurations
4. Test with minimal setup first
5. Contact the development team with specific error messages

---

This guide ensures secure and proper OAuth setup for the Linear Planning Agent. Follow all steps carefully and test thoroughly before proceeding to production deployment.
