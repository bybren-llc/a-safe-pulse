import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import axios from 'axios';
import * as tokenManager from '../../src/auth/tokens';
import * as models from '../../src/db/models';

// Mock external dependencies
jest.mock('axios');
jest.mock('../../src/auth/tokens');
jest.mock('../../src/db/models');
jest.mock('../../src/utils/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTokenManager = tokenManager as jest.Mocked<typeof tokenManager>;
const mockedModels = models as jest.Mocked<typeof models>;

// Import the actual OAuth functions (not mocked)
import { initiateOAuth, handleOAuthCallback } from '../../src/auth/oauth';
import { initiateConfluenceOAuth, handleConfluenceCallback } from '../../src/auth/confluence-oauth';

describe('OAuth End-to-End Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a test Express app
    app = express();
    app.use(express.json());

    // Session middleware
    app.use(session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));

    // OAuth routes
    app.get('/auth', initiateOAuth);
    app.get('/auth/callback', handleOAuthCallback);
    app.get('/auth/confluence', initiateConfluenceOAuth);
    app.get('/auth/confluence/callback', handleConfluenceCallback);

    // Success page
    app.get('/auth/confluence/success', (req, res) => {
      const organizationId = req.query.organizationId;
      res.send(`Success for ${organizationId}`);
    });

    // Setup environment variables
    process.env.LINEAR_CLIENT_ID = 'test-linear-client-id';
    process.env.LINEAR_CLIENT_SECRET = 'test-linear-client-secret';
    process.env.LINEAR_REDIRECT_URI = 'http://localhost:3000/auth/callback';
    process.env.CONFLUENCE_CLIENT_ID = 'test-confluence-client-id';
    process.env.CONFLUENCE_CLIENT_SECRET = 'test-confluence-client-secret';
    process.env.APP_URL = 'http://localhost:3000';

    // Reset mocks
    jest.clearAllMocks();

    // Mock encryptToken/decryptToken to pass through values (used by Confluence OAuth)
    jest.mocked(mockedTokenManager.encryptToken).mockImplementation((token: string) => token);
    jest.mocked(mockedTokenManager.decryptToken).mockImplementation((token: string) => token);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
    delete process.env.LINEAR_REDIRECT_URI;
    delete process.env.CONFLUENCE_CLIENT_ID;
    delete process.env.CONFLUENCE_CLIENT_SECRET;
    delete process.env.APP_URL;
  });

  describe('Linear OAuth E2E Flow', () => {
    it('should complete the full Linear OAuth flow with PKCE and state', async () => {
      const agent = request.agent(app);

      // Step 1: Initiate OAuth
      const initiateResponse = await agent
        .get('/auth')
        .expect(302);

      expect(initiateResponse.headers.location).toContain('https://linear.app/oauth/authorize');
      expect(initiateResponse.headers.location).toContain('client_id=test-linear-client-id');
      expect(initiateResponse.headers.location).toContain('state=');
      expect(initiateResponse.headers.location).toContain('code_challenge=');
      expect(initiateResponse.headers.location).toContain('code_challenge_method=S256');

      // Extract state from the redirect URL
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;

      // Step 2: Mock the token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600
        }
      });

      // Mock the user info request
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            viewer: {
              id: 'test-user-id',
              organization: {
                id: 'test-org-id',
                name: 'Test Organization'
              }
            }
          }
        }
      });

      // Mock token storage
      jest.mocked(mockedTokenManager.storeTokens).mockResolvedValue(undefined);

      // Step 3: Handle callback with correct state
      const callbackResponse = await agent
        .get(`/auth/callback?code=test-auth-code&state=${state}`)
        .expect(200);

      expect(callbackResponse.text).toContain('Authorization Successful!');
      expect(callbackResponse.text).toContain('Test Organization');

      // Verify token exchange was called with code_verifier
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linear.app/oauth/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );

      // Verify code_verifier was included
      const tokenExchangeCall = mockedAxios.post.mock.calls[0];
      const params = tokenExchangeCall[1] as URLSearchParams;
      expect(params.get('code_verifier')).toBeTruthy();

      // Verify token storage was called
      expect(mockedTokenManager.storeTokens).toHaveBeenCalledWith(
        'test-org-id',
        'Test Organization',
        'test-access-token',
        'test-refresh-token',
        'test-user-id',
        3600
      );
    }, 15000); // 15 second timeout

    it('should handle Linear OAuth errors gracefully', async () => {
      // Test missing authorization code — also needs state validation, but code check is first
      const response = await request(app)
        .get('/auth/callback')
        .expect(400);

      expect(response.body.error).toBe('Missing authorization code');
    }, 10000); // 10 second timeout
  });

  describe('Confluence OAuth E2E Flow', () => {
    it('should complete the full Confluence OAuth flow with PKCE and state', async () => {
      const agent = request.agent(app);

      // Step 1: Initiate Confluence OAuth
      const initiateResponse = await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      expect(initiateResponse.headers.location).toContain('https://auth.atlassian.com/authorize');
      expect(initiateResponse.headers.location).toContain('client_id=test-confluence-client-id');
      expect(initiateResponse.headers.location).toContain('code_challenge=');
      expect(initiateResponse.headers.location).toContain('code_challenge_method=S256');

      // Extract the cryptographic state from the redirect URL
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;
      // State should be cryptographic, not the org ID
      expect(state).not.toBe('test-org-id');
      expect(state).toMatch(/^[0-9a-f]{64}$/);

      // Step 2: Mock the token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-confluence-access-token',
          refresh_token: 'test-confluence-refresh-token',
          expires_in: 3600,
          scope: 'read:confluence-content.all'
        }
      });

      // Mock the accessible resources request
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            id: 'test-site-id',
            name: 'Test Confluence Site',
            url: 'https://test-site.atlassian.net'
          }
        ]
      });

      // Mock token storage
      jest.mocked(mockedModels.storeConfluenceToken).mockResolvedValue(undefined);

      // Step 3: Handle callback with correct cryptographic state
      const callbackResponse = await agent
        .get(`/auth/confluence/callback?code=test-auth-code&state=${state}`)
        .expect(302);

      expect(callbackResponse.headers.location).toBe('/auth/confluence/success?organizationId=test-org-id');

      // Step 4: Check success page
      const successResponse = await agent
        .get('/auth/confluence/success?organizationId=test-org-id')
        .expect(200);

      expect(successResponse.text).toContain('Success for test-org-id');

      // Verify token exchange was called with code_verifier
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://auth.atlassian.com/oauth/token',
        expect.objectContaining({
          grant_type: 'authorization_code',
          client_id: 'test-confluence-client-id',
          client_secret: 'test-confluence-client-secret',
          code: 'test-auth-code',
          code_verifier: expect.any(String)
        })
      );

      // Verify accessible resources was called
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.atlassian.com/oauth/token/accessible-resources',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-confluence-access-token',
            'Accept': 'application/json'
          }
        })
      );

      // Verify token storage was called (encryptToken is mocked to passthrough)
      expect(mockedModels.storeConfluenceToken).toHaveBeenCalledWith(
        'test-org-id',
        'test-confluence-access-token',
        'test-confluence-refresh-token',
        'https://api.atlassian.com/ex/confluence/test-site-id',
        expect.any(Date)
      );
    }, 15000); // 15 second timeout

    it('should handle Confluence OAuth errors gracefully', async () => {
      // Test missing authorization code
      const response = await request(app)
        .get('/auth/confluence/callback')
        .expect(400);

      expect(response.body.error).toBe('No authorization code received');
    }, 10000); // 10 second timeout

    it('should reject callback without session state (no initiate)', async () => {
      const response = await request(app)
        .get('/auth/confluence/callback?code=test-code&state=fakestatevalue')
        .expect(403);

      expect(response.body.error).toBe('Invalid OAuth state - session expired or missing');
    }, 10000); // 10 second timeout
  });

  describe('Environment Variable Validation', () => {
    it('should handle missing Linear OAuth environment variables', async () => {
      delete process.env.LINEAR_CLIENT_ID;

      const response = await request(app)
        .get('/auth')
        .expect(500);

      expect(response.body.error).toContain('Missing LINEAR_CLIENT_ID');
    }, 10000); // 10 second timeout

    it('should handle missing Confluence OAuth environment variables', async () => {
      delete process.env.CONFLUENCE_CLIENT_ID;

      const response = await request(app)
        .get('/auth/confluence?organizationId=test-org')
        .expect(500);

      expect(response.body.error).toBe('Server configuration error');
    }, 10000); // 10 second timeout
  });

  describe('Session State Management', () => {
    it('should maintain session state between Confluence OAuth requests', async () => {
      const agent = request.agent(app);

      // Initiate OAuth (sets session)
      const initiateResponse = await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      // Extract the cryptographic state from the redirect URL
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;

      // Mock successful token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600
        }
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: [{ id: 'site-id', name: 'Site', url: 'https://site.atlassian.net' }]
      });

      jest.mocked(mockedModels.storeConfluenceToken).mockResolvedValue(undefined);

      // Handle callback with correct state (should use session data)
      const response = await agent
        .get(`/auth/confluence/callback?code=test-code&state=${state}`)
        .expect(302);

      expect(response.headers.location).toContain('organizationId=test-org-id');
    }, 15000); // 15 second timeout
  });
});
