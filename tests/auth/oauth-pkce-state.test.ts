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

describe('OAuth PKCE and State Parameter Security', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.use(session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true }
    }));

    // OAuth routes
    app.get('/auth', initiateOAuth);
    app.get('/auth/callback', handleOAuthCallback);
    app.get('/auth/confluence', initiateConfluenceOAuth);
    app.get('/auth/confluence/callback', handleConfluenceCallback);

    app.get('/auth/confluence/success', (req, res) => {
      res.send(`Success for ${req.query.organizationId}`);
    });

    // Setup environment variables
    process.env.LINEAR_CLIENT_ID = 'test-linear-client-id';
    process.env.LINEAR_CLIENT_SECRET = 'test-linear-client-secret';
    process.env.LINEAR_REDIRECT_URI = 'http://localhost:3000/auth/callback';
    process.env.CONFLUENCE_CLIENT_ID = 'test-confluence-client-id';
    process.env.CONFLUENCE_CLIENT_SECRET = 'test-confluence-client-secret';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

    jest.clearAllMocks();
    jest.mocked(mockedTokenManager.encryptToken).mockImplementation((token: string) => token);
    jest.mocked(mockedTokenManager.decryptToken).mockImplementation((token: string) => token);
  });

  afterEach(() => {
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
    delete process.env.LINEAR_REDIRECT_URI;
    delete process.env.CONFLUENCE_CLIENT_ID;
    delete process.env.CONFLUENCE_CLIENT_SECRET;
    delete process.env.APP_URL;
    delete process.env.ENCRYPTION_KEY;
  });

  describe('Linear OAuth - State Parameter', () => {
    it('should include state parameter in authorization URL', async () => {
      const response = await request(app)
        .get('/auth')
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain('state=');
      // State should be 64 hex characters (32 bytes)
      const url = new URL(location);
      const state = url.searchParams.get('state');
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should reject callback without state parameter', async () => {
      const agent = request.agent(app);

      // Initiate to set session state
      await agent.get('/auth').expect(302);

      const response = await agent
        .get('/auth/callback?code=test-code')
        .expect(403);

      expect(response.body.error).toBe('Missing state parameter');
    });

    it('should reject callback with mismatched state parameter', async () => {
      const agent = request.agent(app);

      // Initiate to set session state
      await agent.get('/auth').expect(302);

      // Use a different (wrong) state value
      const wrongState = crypto.randomBytes(32).toString('hex');
      const response = await agent
        .get(`/auth/callback?code=test-code&state=${wrongState}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid OAuth state');
    });

    it('should reject callback without prior session (no initiate)', async () => {
      // Go straight to callback without initiating — no session state exists
      const response = await request(app)
        .get('/auth/callback?code=test-code&state=fakestatevalue')
        .expect(403);

      expect(response.body.error).toBe('Invalid OAuth state - session expired or missing');
    });
  });

  describe('Linear OAuth - PKCE', () => {
    it('should include code_challenge and code_challenge_method in authorization URL', async () => {
      const response = await request(app)
        .get('/auth')
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain('code_challenge=');
      expect(location).toContain('code_challenge_method=S256');
    });

    it('should send code_verifier in token exchange', async () => {
      const agent = request.agent(app);

      // Step 1: Initiate OAuth to set session
      const initiateResponse = await agent.get('/auth').expect(302);
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;

      // Step 2: Mock token exchange and user info
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600
        }
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            viewer: {
              id: 'test-user-id',
              organization: { id: 'test-org-id', name: 'Test Org' }
            }
          }
        }
      });
      jest.mocked(mockedTokenManager.storeTokens).mockResolvedValue(undefined);

      // Step 3: Handle callback with correct state
      await agent
        .get(`/auth/callback?code=test-code&state=${state}`)
        .expect(200);

      // Verify code_verifier was included in the token exchange
      const tokenExchangeCall = mockedAxios.post.mock.calls[0];
      const params = tokenExchangeCall[1] as URLSearchParams;
      expect(params.get('code_verifier')).toBeTruthy();
      // Verify it's a valid base64url string
      expect(params.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should complete full Linear OAuth flow with PKCE and state', async () => {
      const agent = request.agent(app);

      // Initiate
      const initiateResponse = await agent.get('/auth').expect(302);
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;
      const codeChallenge = url.searchParams.get('code_challenge')!;

      // Mock responses
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            viewer: {
              id: 'uid',
              organization: { id: 'oid', name: 'Org' }
            }
          }
        }
      });
      jest.mocked(mockedTokenManager.storeTokens).mockResolvedValue(undefined);

      // Callback
      const callbackResponse = await agent
        .get(`/auth/callback?code=test-code&state=${state}`)
        .expect(200);

      expect(callbackResponse.text).toContain('Authorization Successful!');

      // Verify the code_verifier matches the code_challenge
      const tokenExchangeCall = mockedAxios.post.mock.calls[0];
      const params = tokenExchangeCall[1] as URLSearchParams;
      const verifier = params.get('code_verifier')!;
      const expectedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(expectedChallenge).toBe(codeChallenge);
    });
  });

  describe('Linear OAuth - Replay Prevention', () => {
    it('should clear session state after successful callback', async () => {
      const agent = request.agent(app);

      // Initiate
      const initiateResponse = await agent.get('/auth').expect(302);
      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;

      // Mock responses
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            viewer: {
              id: 'uid',
              organization: { id: 'oid', name: 'Org' }
            }
          }
        }
      });
      jest.mocked(mockedTokenManager.storeTokens).mockResolvedValue(undefined);

      // First callback succeeds
      await agent
        .get(`/auth/callback?code=test-code&state=${state}`)
        .expect(200);

      // Second callback with same state should fail (replay attack)
      const replayResponse = await agent
        .get(`/auth/callback?code=test-code&state=${state}`)
        .expect(403);

      expect(replayResponse.body.error).toBe('Invalid OAuth state - session expired or missing');
    });
  });

  describe('Confluence OAuth - Cryptographic State', () => {
    it('should use cryptographic state instead of org ID', async () => {
      const response = await request(app)
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      const location = response.headers.location;
      const url = new URL(location);
      const state = url.searchParams.get('state');

      // State should be cryptographic (64 hex chars), NOT the org ID
      expect(state).not.toBe('test-org-id');
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should include PKCE parameters in Confluence authorization URL', async () => {
      const response = await request(app)
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain('code_challenge=');
      expect(location).toContain('code_challenge_method=S256');
    });

    it('should reject Confluence callback with mismatched state', async () => {
      const agent = request.agent(app);

      // Initiate
      await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      // Use wrong state
      const wrongState = crypto.randomBytes(32).toString('hex');
      const response = await agent
        .get(`/auth/confluence/callback?code=test-code&state=${wrongState}`)
        .expect(403);

      expect(response.body.error).toBe('Invalid OAuth state');
    });

    it('should reject Confluence callback without state', async () => {
      const agent = request.agent(app);

      await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      const response = await agent
        .get('/auth/confluence/callback?code=test-code')
        .expect(403);

      expect(response.body.error).toBe('Missing state parameter');
    });

    it('should reject Confluence callback without prior session', async () => {
      const response = await request(app)
        .get('/auth/confluence/callback?code=test-code&state=fakestatevalue')
        .expect(403);

      expect(response.body.error).toBe('Invalid OAuth state - session expired or missing');
    });
  });

  describe('Confluence OAuth - Full Flow with PKCE', () => {
    it('should complete full Confluence OAuth flow with PKCE and state', async () => {
      const agent = request.agent(app);

      // Step 1: Initiate
      const initiateResponse = await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;
      const codeChallenge = url.searchParams.get('code_challenge')!;

      // Step 2: Mock token exchange
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-confluence-access-token',
          refresh_token: 'test-confluence-refresh-token',
          expires_in: 3600,
          scope: 'read:confluence-content.all'
        }
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: [{
          id: 'test-site-id',
          name: 'Test Confluence Site',
          url: 'https://test-site.atlassian.net'
        }]
      });

      jest.mocked(mockedModels.storeConfluenceToken).mockResolvedValue(undefined);

      // Step 3: Callback with correct state
      const callbackResponse = await agent
        .get(`/auth/confluence/callback?code=test-auth-code&state=${state}`)
        .expect(302);

      expect(callbackResponse.headers.location).toBe('/auth/confluence/success?organizationId=test-org-id');

      // Verify code_verifier was sent in token exchange
      const tokenExchangeCall = mockedAxios.post.mock.calls[0];
      const tokenBody = tokenExchangeCall[1] as any;
      expect(tokenBody.code_verifier).toBeTruthy();
      expect(tokenBody.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);

      // Verify code_verifier matches the code_challenge
      const expectedChallenge = crypto.createHash('sha256')
        .update(tokenBody.code_verifier)
        .digest('base64url');
      expect(expectedChallenge).toBe(codeChallenge);
    });

    it('should prevent replay attacks on Confluence callback', async () => {
      const agent = request.agent(app);

      // Initiate
      const initiateResponse = await agent
        .get('/auth/confluence?organizationId=test-org-id')
        .expect(302);

      const url = new URL(initiateResponse.headers.location);
      const state = url.searchParams.get('state')!;

      // Mock responses
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'tok', refresh_token: 'ref',
          expires_in: 3600, scope: 'read:confluence-content.all'
        }
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ id: 'site-id', name: 'Site', url: 'https://site.atlassian.net' }]
      });
      jest.mocked(mockedModels.storeConfluenceToken).mockResolvedValue(undefined);

      // First callback succeeds
      await agent
        .get(`/auth/confluence/callback?code=test-code&state=${state}`)
        .expect(302);

      // Replay should fail
      const replayResponse = await agent
        .get(`/auth/confluence/callback?code=test-code&state=${state}`)
        .expect(403);

      expect(replayResponse.body.error).toBe('Invalid OAuth state - session expired or missing');
    });
  });
});
