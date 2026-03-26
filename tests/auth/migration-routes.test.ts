/**
 * Tests for OAuth token migration API routes (ASP-87)
 */
import express from 'express';
import request from 'supertest';
import migrationRoutes from '../../src/auth/migration-routes';
import * as tokenManager from '../../src/auth/tokens';

jest.mock('../../src/auth/tokens');

const mockedTokenManager = tokenManager as jest.Mocked<typeof tokenManager>;

describe('Migration Routes (ASP-87)', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ADMIN_API_KEY = 'test-admin-key';

    app = express();
    app.use(express.json());
    app.use('/auth', migrationRoutes);
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  describe('POST /auth/migrate', () => {
    it('should return 403 without admin API key', async () => {
      const res = await request(app)
        .post('/auth/migrate')
        .send({ organizationId: 'org-1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should return 403 with wrong admin API key', async () => {
      const res = await request(app)
        .post('/auth/migrate')
        .set('x-admin-api-key', 'wrong-key')
        .send({ organizationId: 'org-1' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when organizationId is missing', async () => {
      const res = await request(app)
        .post('/auth/migrate')
        .set('x-admin-api-key', 'test-admin-key')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('organizationId is required');
    });

    it('should return 200 on successful migration', async () => {
      mockedTokenManager.migrateExistingToken.mockResolvedValueOnce({
        success: true,
        message: 'Token migrated successfully'
      });

      const res = await request(app)
        .post('/auth/migrate')
        .set('x-admin-api-key', 'test-admin-key')
        .send({ organizationId: 'org-1' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockedTokenManager.migrateExistingToken).toHaveBeenCalledWith('org-1');
    });

    it('should return 200 with alreadyMigrated flag for idempotent call', async () => {
      mockedTokenManager.migrateExistingToken.mockResolvedValueOnce({
        success: true,
        message: 'Token already migrated',
        alreadyMigrated: true
      });

      const res = await request(app)
        .post('/auth/migrate')
        .set('x-admin-api-key', 'test-admin-key')
        .send({ organizationId: 'org-1' });

      expect(res.status).toBe(200);
      expect(res.body.alreadyMigrated).toBe(true);
    });

    it('should return 500 on migration failure', async () => {
      mockedTokenManager.migrateExistingToken.mockResolvedValueOnce({
        success: false,
        message: 'Migration failed: Network error'
      });

      const res = await request(app)
        .post('/auth/migrate')
        .set('x-admin-api-key', 'test-admin-key')
        .send({ organizationId: 'org-1' });

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /auth/token-status', () => {
    it('should return 403 without admin API key', async () => {
      const res = await request(app)
        .get('/auth/token-status');

      expect(res.status).toBe(403);
    });

    it('should return token statuses for admin', async () => {
      mockedTokenManager.getTokenStatus.mockResolvedValueOnce([
        {
          organizationId: 'org-1',
          expiresAt: '2026-04-01T00:00:00.000Z',
          isExpired: false,
          minutesUntilExpiry: 7200,
          hasRefreshToken: true,
          migrationStatus: 'migrated',
          migratedAt: '2026-03-20T00:00:00.000Z'
        },
        {
          organizationId: 'org-2',
          expiresAt: '2026-03-25T00:00:00.000Z',
          isExpired: true,
          minutesUntilExpiry: -1440,
          hasRefreshToken: false,
          migrationStatus: 'pending',
          migratedAt: null
        }
      ]);

      const res = await request(app)
        .get('/auth/token-status')
        .set('x-admin-api-key', 'test-admin-key');

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveLength(2);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.summary.migrated).toBe(1);
      expect(res.body.summary.pending).toBe(1);
      expect(res.body.summary.expired).toBe(1);
    });

    it('should handle empty token list', async () => {
      mockedTokenManager.getTokenStatus.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/auth/token-status')
        .set('x-admin-api-key', 'test-admin-key');

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveLength(0);
      expect(res.body.summary.total).toBe(0);
    });
  });
});
