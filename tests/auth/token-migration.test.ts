/**
 * Tests for OAuth token migration functionality (ASP-87)
 */
import * as tokenManager from '../../src/auth/tokens';
import * as models from '../../src/db/models';
import axios from 'axios';

// Mock dependencies
jest.mock('../../src/db/models');
jest.mock('axios');

const mockedModels = models as jest.Mocked<typeof models>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Token Migration (ASP-87)', () => {
  const organizationId = 'test-org-id';
  const accessToken = 'test-access-token';
  const refreshToken = 'test-refresh-token';
  const appUserId = 'test-app-user-id';

  const baseTokenData: models.LinearToken = {
    id: 1,
    organization_id: organizationId,
    access_token: accessToken,
    refresh_token: refreshToken,
    app_user_id: appUserId,
    expires_at: new Date(Date.now() + 86400000), // 24h from now
    created_at: new Date(),
    updated_at: new Date(),
    migration_status: 'pending',
    old_access_token: null,
    migrated_at: null
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.LINEAR_CLIENT_ID = 'test-client-id';
    process.env.LINEAR_CLIENT_SECRET = 'test-client-secret';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  describe('migrateExistingToken', () => {
    it('should return error when no tokens found for organization', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(null);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No tokens found');
    });

    it('should skip migration if already migrated (idempotent)', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        migration_status: 'migrated'
      });

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(true);
      expect(result.alreadyMigrated).toBe(true);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should successfully migrate a pending token', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(baseTokenData);
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-short-lived-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        }
      });
      mockedModels.storeLinearToken.mockResolvedValueOnce(undefined);
      mockedModels.updateLinearTokenMigration.mockResolvedValueOnce(undefined);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token migrated successfully');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linear.app/oauth/migrate_old_token',
        expect.objectContaining({
          client_id: 'test-client-id',
          client_secret: 'test-client-secret'
        })
      );
      expect(mockedModels.storeLinearToken).toHaveBeenCalled();
      expect(mockedModels.updateLinearTokenMigration).toHaveBeenCalledWith(
        organizationId,
        'migrated',
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should mark as failed when migration API returns no access token', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(baseTokenData);
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: null }
      });
      mockedModels.updateLinearTokenMigration.mockResolvedValueOnce(undefined);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(false);
      expect(mockedModels.updateLinearTokenMigration).toHaveBeenCalledWith(
        organizationId,
        'failed',
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should mark as failed when migration API call fails', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(baseTokenData);
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
      mockedModels.updateLinearTokenMigration.mockResolvedValueOnce(undefined);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
      expect(mockedModels.updateLinearTokenMigration).toHaveBeenCalledWith(
        organizationId,
        'failed',
        null,
        expect.any(Date)
      );
    });

    it('should return error when OAuth credentials are missing', async () => {
      delete process.env.LINEAR_CLIENT_ID;
      mockedModels.getLinearToken.mockResolvedValueOnce(baseTokenData);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing LINEAR_CLIENT_ID');
    });

    it('should retry a failed migration', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        migration_status: 'failed'
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600
        }
      });
      mockedModels.storeLinearToken.mockResolvedValueOnce(undefined);
      mockedModels.updateLinearTokenMigration.mockResolvedValueOnce(undefined);

      const result = await tokenManager.migrateExistingToken(organizationId);

      expect(result.success).toBe(true);
    });
  });

  describe('getAccessToken (proactive refresh)', () => {
    it('should return token directly when not near expiry', async () => {
      const futureExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        expires_at: futureExpiry
      });

      const result = await tokenManager.getAccessToken(organizationId);

      // Should return decrypted token without calling refresh
      expect(result).toBeDefined();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should proactively refresh when within 1 hour of expiry', async () => {
      const nearExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        expires_at: nearExpiry,
        refresh_token: refreshToken
      });

      // For the refresh call, getLinearToken is called again
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        expires_at: nearExpiry,
        refresh_token: refreshToken
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh',
          expires_in: 3600
        }
      });
      mockedModels.storeLinearToken.mockResolvedValueOnce(undefined);

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBe('refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linear.app/oauth/token',
        expect.objectContaining({ grant_type: 'refresh_token' })
      );
    });

    it('should return current token if proactive refresh fails but token not yet expired', async () => {
      const nearExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        expires_at: nearExpiry,
        refresh_token: refreshToken
      });

      // For refresh, getLinearToken called again
      mockedModels.getLinearToken.mockResolvedValueOnce({
        ...baseTokenData,
        expires_at: nearExpiry,
        refresh_token: refreshToken
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      const result = await tokenManager.getAccessToken(organizationId);

      // Should fall back to current token since it's not yet expired
      expect(result).toBeDefined();
    });

    it('should return null when no tokens found', async () => {
      mockedModels.getLinearToken.mockResolvedValueOnce(null);

      const result = await tokenManager.getAccessToken(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('getTokenStatus', () => {
    it('should return status for all organizations', async () => {
      const tokens: models.LinearToken[] = [
        {
          ...baseTokenData,
          organization_id: 'org-1',
          migration_status: 'migrated',
          migrated_at: new Date('2026-03-20T00:00:00Z')
        },
        {
          ...baseTokenData,
          organization_id: 'org-2',
          migration_status: 'pending',
          expires_at: new Date(Date.now() - 1000), // expired
          refresh_token: null
        }
      ];
      mockedModels.getAllLinearTokens.mockResolvedValueOnce(tokens);

      const statuses = await tokenManager.getTokenStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0].organizationId).toBe('org-1');
      expect(statuses[0].migrationStatus).toBe('migrated');
      expect(statuses[0].hasRefreshToken).toBe(true);
      expect(statuses[1].organizationId).toBe('org-2');
      expect(statuses[1].migrationStatus).toBe('pending');
      expect(statuses[1].isExpired).toBe(true);
      expect(statuses[1].hasRefreshToken).toBe(false);
    });

    it('should return empty array when no tokens exist', async () => {
      mockedModels.getAllLinearTokens.mockResolvedValueOnce([]);

      const statuses = await tokenManager.getTokenStatus();

      expect(statuses).toHaveLength(0);
    });
  });
});
