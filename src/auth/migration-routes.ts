/**
 * OAuth token migration API routes
 *
 * Provides endpoints for migrating long-lived tokens to short-lived + refresh token
 * rotation, and checking token migration/expiration status.
 */

import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as logger from '../utils/logger';
import { migrateExistingToken, getTokenStatus } from './tokens';

const router = Router();

// Rate limiter for admin migration endpoints (defense-in-depth)
const migrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: 'Too many requests, try again later' }
});

/**
 * Timing-safe admin API key verification.
 * Uses crypto.timingSafeEqual to prevent timing side-channel attacks.
 * Returns false if ADMIN_API_KEY is not configured (defense-in-depth).
 */
function verifyAdminKey(providedKey: string | string[] | undefined): boolean {
  const expectedKey = process.env.ADMIN_API_KEY;

  // If ADMIN_API_KEY is not configured, reject ALL requests
  if (!expectedKey) {
    logger.error('ADMIN_API_KEY not configured — all admin requests rejected');
    return false;
  }

  if (!providedKey || typeof providedKey !== 'string') {
    return false;
  }

  // Length check before timing-safe comparison (timingSafeEqual requires equal lengths)
  if (Buffer.byteLength(providedKey) !== Buffer.byteLength(expectedKey)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(expectedKey)
  );
}

/**
 * POST /auth/migrate
 *
 * Triggers migration of a long-lived OAuth token to short-lived + refresh token.
 * Admin-only: requires ADMIN_API_KEY header for authentication.
 *
 * Body: { organizationId: string }
 */
router.post('/migrate', migrationLimiter, async (req: Request, res: Response) => {
  try {
    // Admin-only authentication (timing-safe)
    if (!verifyAdminKey(req.headers['x-admin-api-key'])) {
      logger.warn('Unauthorized migration attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { organizationId } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    logger.info('Admin triggered token migration', { organizationId });

    const result = await migrateExistingToken(organizationId);

    if (result.success) {
      return res.status(200).json({
        status: 'success',
        message: result.message,
        alreadyMigrated: result.alreadyMigrated || false
      });
    }

    return res.status(500).json({
      status: 'error',
      message: result.message
    });
  } catch (error: any) {
    logger.error('Migration endpoint error', { error: error?.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/token-status
 *
 * Returns expiration times and migration status for all organizations.
 * Admin-only: requires ADMIN_API_KEY header for authentication.
 */
router.get('/token-status', migrationLimiter, async (req: Request, res: Response) => {
  try {
    // Admin-only authentication (timing-safe)
    if (!verifyAdminKey(req.headers['x-admin-api-key'])) {
      logger.warn('Unauthorized token-status attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const statuses = await getTokenStatus();

    return res.status(200).json({
      tokens: statuses,
      summary: {
        total: statuses.length,
        migrated: statuses.filter(s => s.migrationStatus === 'migrated').length,
        pending: statuses.filter(s => s.migrationStatus === 'pending').length,
        failed: statuses.filter(s => s.migrationStatus === 'failed').length,
        expired: statuses.filter(s => s.isExpired).length
      }
    });
  } catch (error: any) {
    logger.error('Token status endpoint error', { error: error?.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
