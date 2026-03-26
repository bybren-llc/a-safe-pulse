import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import axios from 'axios';
import * as confluenceOAuth from '../../src/auth/confluence-oauth';
import * as models from '../../src/db/models';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock models
jest.mock('../../src/db/models');
const mockedModels = models as jest.Mocked<typeof models>;

// Mock logger
jest.mock('../../src/utils/logger');

// Define session interface for testing
interface TestSession {
  organizationId?: string;
  oauthState?: string;
  codeVerifier?: string;
  [key: string]: any;
}

describe('Confluence OAuth', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup environment variables
    process.env.CONFLUENCE_CLIENT_ID = 'test-client-id';
    process.env.CONFLUENCE_CLIENT_SECRET = 'test-client-secret';
    process.env.APP_URL = 'https://example.com';
    // Valid 64-hex-char encryption key for AES-256 (needed by encryptToken/decryptToken)
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.CONFLUENCE_CLIENT_ID;
    delete process.env.CONFLUENCE_CLIENT_SECRET;
    delete process.env.APP_URL;
  });

  describe('initiateConfluenceOAuth', () => {
    it('should redirect to the Atlassian authorization URL with cryptographic state and PKCE', () => {
      const session: TestSession = {};
      const req = {
        query: { organizationId: 'test-org-id' },
        session
      };

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      confluenceOAuth.initiateConfluenceOAuth(req, res);

      expect(session.organizationId).toBe('test-org-id');
      // State should be cryptographic, not the org ID
      expect(session.oauthState).toBeDefined();
      expect(session.oauthState).toMatch(/^[0-9a-f]{64}$/);
      expect(session.codeVerifier).toBeDefined();
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('https://auth.atlassian.com/authorize'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('client_id=test-client-id'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('code_challenge='));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('code_challenge_method=S256'));
      // State in URL should be the cryptographic state, not the org ID
      const redirectUrl = (res.redirect as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(redirectUrl);
      expect(url.searchParams.get('state')).toBe(session.oauthState);
      expect(url.searchParams.get('state')).not.toBe('test-org-id');
    }, 10000); // 10 second timeout

    it('should handle missing client ID', () => {
      delete process.env.CONFLUENCE_CLIENT_ID;

      const req = {
        query: { organizationId: 'test-org-id' },
        session: {}
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      confluenceOAuth.initiateConfluenceOAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
    });
  });

  describe('handleConfluenceCallback', () => {
    it('should exchange the authorization code for tokens with PKCE verifier', async () => {
      const oauthState = crypto.randomBytes(32).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const req = {
        query: {
          code: 'test-auth-code',
          state: oauthState
        },
        session: {
          organizationId: 'test-org-id',
          oauthState,
          codeVerifier
        } as TestSession
      };

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock token response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          scope: 'read:confluence-content.all'
        }
      });

      // Mock resource response
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            id: 'test-site-id',
            name: 'Test Site',
            url: 'https://test-site.atlassian.net'
          }
        ]
      });

      await confluenceOAuth.handleConfluenceCallback(req, res);

      // Verify token exchange request includes code_verifier
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://auth.atlassian.com/oauth/token',
        {
          grant_type: 'authorization_code',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          code: 'test-auth-code',
          redirect_uri: 'https://example.com/auth/confluence/callback',
          code_verifier: codeVerifier
        }
      );

      // Verify resource request
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.atlassian.com/oauth/token/accessible-resources',
        {
          headers: {
            'Authorization': 'Bearer test-access-token',
            'Accept': 'application/json'
          }
        }
      );

      // Verify token storage (tokens are encrypted before storage)
      expect(mockedModels.storeConfluenceToken).toHaveBeenCalledWith(
        'test-org-id',
        expect.any(String), // encrypted access token
        expect.any(String), // encrypted refresh token
        'https://api.atlassian.com/ex/confluence/test-site-id',
        expect.any(Date)
      );

      // Verify redirect
      expect(res.redirect).toHaveBeenCalledWith('/auth/confluence/success?organizationId=test-org-id');

      // Verify session state was cleared (replay prevention)
      expect(req.session.oauthState).toBeUndefined();
      expect(req.session.codeVerifier).toBeUndefined();
    });

    it('should handle missing authorization code', async () => {
      const req = {
        query: {},
        session: {
          organizationId: 'test-org-id',
          oauthState: 'some-state'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await confluenceOAuth.handleConfluenceCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No authorization code received' });
    });

    it('should reject callback with missing session state', async () => {
      const req = {
        query: {
          code: 'test-auth-code',
          state: 'some-state'
        },
        session: {}
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await confluenceOAuth.handleConfluenceCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid OAuth state - session expired or missing' });
    });

    it('should reject callback with mismatched state', async () => {
      const oauthState = crypto.randomBytes(32).toString('hex');
      const wrongState = crypto.randomBytes(32).toString('hex');
      const req = {
        query: {
          code: 'test-auth-code',
          state: wrongState
        },
        session: {
          organizationId: 'test-org-id',
          oauthState,
          codeVerifier: 'some-verifier'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await confluenceOAuth.handleConfluenceCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid OAuth state' });
    });
  });

  describe('refreshConfluenceToken', () => {
    it('should refresh an expired token', async () => {
      const organizationId = 'test-org-id';

      // Mock token data
      mockedModels.getConfluenceToken.mockResolvedValueOnce({
        id: 1,
        organization_id: organizationId,
        access_token: 'old-access-token',
        refresh_token: 'test-refresh-token',
        site_url: 'https://api.atlassian.com/ex/confluence/test-site-id',
        expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      // Mock token refresh response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        }
      });

      const result = await confluenceOAuth.refreshConfluenceToken(organizationId);

      // Verify token refresh request
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://auth.atlassian.com/oauth/token',
        {
          grant_type: 'refresh_token',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          refresh_token: 'test-refresh-token'
        }
      );

      // Verify token storage (tokens are encrypted before storage)
      expect(mockedModels.storeConfluenceToken).toHaveBeenCalledWith(
        organizationId,
        expect.any(String), // encrypted access token
        expect.any(String), // encrypted refresh token
        'https://api.atlassian.com/ex/confluence/test-site-id',
        expect.any(Date)
      );

      expect(result).toBe('new-access-token');
    });

    it('should handle missing token data', async () => {
      const organizationId = 'test-org-id';

      // Mock missing token data
      mockedModels.getConfluenceToken.mockResolvedValueOnce(null);

      const result = await confluenceOAuth.refreshConfluenceToken(organizationId);

      expect(result).toBeNull();
    });

    it('should handle refresh failure', async () => {
      const organizationId = 'test-org-id';

      // Mock token data
      mockedModels.getConfluenceToken.mockResolvedValueOnce({
        id: 1,
        organization_id: organizationId,
        access_token: 'old-access-token',
        refresh_token: 'test-refresh-token',
        site_url: 'https://api.atlassian.com/ex/confluence/test-site-id',
        expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      // Mock token refresh error
      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      const result = await confluenceOAuth.refreshConfluenceToken(organizationId);

      expect(result).toBeNull();
    });
  });
});
