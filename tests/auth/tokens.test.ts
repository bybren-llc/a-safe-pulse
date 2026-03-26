/**
 * Tests for token management functionality
 */
import * as tokenManager from '../../src/auth/tokens';
import * as models from '../../src/db/models';
import axios from 'axios';

// Mock dependencies
jest.mock('../../src/db/models');
jest.mock('axios');

const mockedModels = models as jest.Mocked<typeof models>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Token Management', () => {
  // Mock data
  const organizationId = 'test-org-id';
  const organizationName = 'Test Organization';
  const accessToken = 'test-access-token';
  const refreshToken = 'test-refresh-token';
  const appUserId = 'test-app-user-id';
  const expiresIn = 3600;

  // Reset mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();

    // Mock environment variables
    process.env.LINEAR_CLIENT_ID = 'test-client-id';
    process.env.LINEAR_CLIENT_SECRET = 'test-client-secret';
    // Valid 64-hex-char encryption key for AES-256
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  });

  describe('storeTokens', () => {
    it('should store tokens in the database', async () => {
      // Mock storeLinearToken to succeed
      mockedModels.storeLinearToken.mockResolvedValueOnce(undefined);

      await tokenManager.storeTokens(
        organizationId,
        organizationName,
        accessToken,
        refreshToken,
        appUserId,
        expiresIn
      );

      // Verify storeLinearToken was called with correct parameters
      // Tokens are encrypted before storage, so we check for any string
      expect(mockedModels.storeLinearToken).toHaveBeenCalledWith(
        organizationId,
        expect.any(String), // encrypted access token
        expect.any(String), // encrypted refresh token
        appUserId,
        expect.any(Date)
      );
    });

    it('should throw an error if database query fails', async () => {
      // Mock storeLinearToken to throw an error
      const dbError = new Error('Database error');
      mockedModels.storeLinearToken.mockRejectedValueOnce(dbError);

      await expect(
        tokenManager.storeTokens(
          organizationId,
          organizationName,
          accessToken,
          refreshToken,
          appUserId,
          expiresIn
        )
      ).rejects.toThrow(dbError);
    });
  });

  describe('getAccessToken', () => {
    it('should return null if no tokens are found', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(null);

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBeNull();
      expect(mockedModels.getLinearToken).toHaveBeenCalledWith(organizationId);
    });

    it('should return the access token if valid and not near expiry', async () => {
      const tokenData = {
        id: 1,
        organization_id: organizationId,
        access_token: accessToken,
        refresh_token: refreshToken,
        app_user_id: appUserId,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        created_at: new Date(),
        updated_at: new Date(),
        migration_status: 'pending' as const,
        old_access_token: null,
        migrated_at: null
      };
      mockedModels.getLinearToken.mockResolvedValueOnce(tokenData);

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBeDefined();
      expect(mockedModels.getLinearToken).toHaveBeenCalledWith(organizationId);
    });

    it('should attempt to refresh the token if expired', async () => {
      const newAccessToken = 'new-access-token';

      // Mock getLinearToken for proactive refresh (token expired)
      const tokenData = {
        id: 1,
        organization_id: organizationId,
        access_token: accessToken,
        refresh_token: refreshToken,
        app_user_id: appUserId,
        expires_at: new Date(Date.now() - 1000), // already expired
        created_at: new Date(),
        updated_at: new Date(),
        migration_status: 'pending' as const,
        old_access_token: null,
        migrated_at: null
      };
      mockedModels.getLinearToken.mockResolvedValueOnce(tokenData);

      // For refresh, getLinearToken is called again
      mockedModels.getLinearToken.mockResolvedValueOnce(tokenData);

      // Mock axios for token refresh
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: newAccessToken,
          expires_in: 7200
        }
      });

      // Mock storeLinearToken for storing refreshed token
      mockedModels.storeLinearToken.mockResolvedValueOnce(undefined);

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBe(newAccessToken);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linear.app/oauth/token',
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      );
    });

    it('should return null if token refresh fails', async () => {
      // Mock getLinearToken with expired token
      const tokenData = {
        id: 1,
        organization_id: organizationId,
        access_token: accessToken,
        refresh_token: refreshToken,
        app_user_id: appUserId,
        expires_at: new Date(Date.now() - 1000), // already expired
        created_at: new Date(),
        updated_at: new Date(),
        migration_status: 'pending' as const,
        old_access_token: null,
        migrated_at: null
      };
      mockedModels.getLinearToken.mockResolvedValueOnce(tokenData);

      // For refresh, getLinearToken is called again
      mockedModels.getLinearToken.mockResolvedValueOnce(tokenData);

      // Mock axios to throw an error during token refresh
      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('revokeTokens', () => {
    it('should delete tokens from the database', async () => {
      // Mock deleteLinearToken to return true (successful deletion)
      mockedModels.deleteLinearToken.mockResolvedValueOnce(true);

      const result = await tokenManager.revokeTokens(organizationId);

      expect(result).toBe(true);
      expect(mockedModels.deleteLinearToken).toHaveBeenCalledWith(organizationId);
    });

    it('should return false if no tokens are found', async () => {
      // Mock deleteLinearToken to return false (no tokens found)
      mockedModels.deleteLinearToken.mockResolvedValueOnce(false);

      const result = await tokenManager.revokeTokens(organizationId);

      expect(result).toBe(false);
      expect(mockedModels.deleteLinearToken).toHaveBeenCalledWith(organizationId);
    });

    it('should return false if delete operation fails', async () => {
      // Mock deleteLinearToken to throw an error
      mockedModels.deleteLinearToken.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await tokenManager.revokeTokens(organizationId);

      expect(result).toBe(false);
      expect(mockedModels.deleteLinearToken).toHaveBeenCalledWith(organizationId);
    });
  });
});
