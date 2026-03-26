/**
 * Token management utility for Linear OAuth tokens
 *
 * This module provides functions for securely storing, retrieving, refreshing,
 * and revoking Linear OAuth tokens. Tokens are stored in the database with
 * AES-256-CBC encryption for security.
 */

import axios from 'axios';
import crypto from 'crypto';
import * as logger from '../utils/logger';
import { storeLinearToken, getLinearToken, getAccessToken as getDbAccessToken, deleteLinearToken, updateLinearTokenMigration, getAllLinearTokens } from '../db/models';

/**
 * Encryption utilities for token security using secure AES-256-CBC
 */
const ALGORITHM = 'aes-256-cbc';

/**
 * Gets the encryption key as a Buffer, ensuring it's 32 bytes for AES-256
 */
const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  try {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
    }
    return key;
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string (64 characters)');
  }
};

/**
 * Encrypts a token using secure AES-256-CBC with random IV
 */
export const encryptToken = (token: string): string => {
  if (!token) return token;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // Generate random IV for each encryption

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data (IV needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Error encrypting token', { error });
    throw new Error('Token encryption failed');
  }
};

/**
 * Decrypts a token using secure AES-256-CBC
 */
export const decryptToken = (encryptedData: string): string => {
  if (!encryptedData || !encryptedData.includes(':')) {
    // Handle legacy unencrypted tokens gracefully
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting token', { error });
    throw new Error('Token decryption failed');
  }
};

/**
 * Stores OAuth tokens for a Linear organization
 *
 * @param organizationId The Linear organization ID
 * @param organizationName The Linear organization name
 * @param accessToken The OAuth access token
 * @param refreshToken The OAuth refresh token
 * @param appUserId The Linear app user ID
 * @param expiresIn The token expiration time in seconds
 */
export const storeTokens = async (
  organizationId: string,
  organizationName: string,
  accessToken: string,
  refreshToken: string | null,
  appUserId: string,
  expiresIn: number
): Promise<void> => {
  try {
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // Encrypt tokens before storage
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;

    // Store encrypted tokens in the database
    await storeLinearToken(
      organizationId,
      encryptedAccessToken,
      encryptedRefreshToken,
      appUserId,
      expiresAt
    );

    logger.info('Encrypted tokens stored for organization', { organizationId });
  } catch (error) {
    logger.error('Error storing tokens', { error, organizationId });
    throw error;
  }
};

/**
 * Refreshes an expired access token using the refresh token
 *
 * @param organizationId The Linear organization ID
 * @returns The new access token or null if refresh fails
 */
export const refreshToken = async (organizationId: string): Promise<string | null> => {
  try {
    // Get the token data from the database
    const tokenData = await getLinearToken(organizationId);

    if (!tokenData) {
      logger.error(`No tokens found for organization ${organizationId}`);
      return null;
    }

    if (!tokenData.refresh_token) {
      logger.error(`No refresh token available for organization ${organizationId}`);
      return null;
    }

    // Decrypt the refresh token
    const decryptedRefreshToken = decryptToken(tokenData.refresh_token);

    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('Missing LINEAR_CLIENT_ID or LINEAR_CLIENT_SECRET environment variables');
      return null;
    }

    // Exchange the refresh token for a new access token
    const tokenResponse = await axios.post('https://api.linear.app/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token'
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      logger.error('Failed to refresh access token');
      return null;
    }

    // Calculate new expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt new tokens before storage
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : tokenData.refresh_token;

    // Store the new encrypted tokens
    await storeLinearToken(
      organizationId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenData.app_user_id,
      expiresAt
    );

    logger.info('Token refreshed for organization', { organizationId });
    return access_token;
  } catch (error) {
    logger.error('Error refreshing token', { error, organizationId });
    return null;
  }
};

/**
 * Retrieves the access token for a Linear organization
 *
 * Proactively refreshes if within 1 hour of expiry (not just on 401 failure).
 * If the token is expired, it will attempt to refresh it automatically.
 *
 * @param organizationId The Linear organization ID
 * @returns The valid access token or null if not available
 */
export const getAccessToken = async (organizationId: string): Promise<string | null> => {
  try {
    // Get the raw token data to check expiry proactively
    const tokenData = await getLinearToken(organizationId);

    if (!tokenData) {
      logger.warn('No tokens found for organization', { organizationId });
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Proactive refresh: if token expires within 1 hour, refresh now
    if (expiresAt <= oneHourFromNow) {
      logger.info('Token expiring soon, proactively refreshing', {
        organizationId,
        expiresAt: expiresAt.toISOString(),
        minutesUntilExpiry: Math.round((expiresAt.getTime() - now.getTime()) / 60000)
      });
      const refreshed = await refreshToken(organizationId);
      if (refreshed) {
        return refreshed;
      }
      // If refresh failed but token is not yet expired, return current token
      if (expiresAt > now) {
        return decryptToken(tokenData.access_token);
      }
      return null;
    }

    // Token is still valid and not near expiry
    return decryptToken(tokenData.access_token);
  } catch (error) {
    logger.error('Error retrieving access token', { error, organizationId });
    return null;
  }
};

/**
 * Retrieves the app user ID for a Linear organization
 *
 * @param organizationId The Linear organization ID
 * @returns The app user ID or null if not available
 */
export const getAppUserId = async (organizationId: string): Promise<string | null> => {
  try {
    // Get the token data from the database
    const tokenData = await getLinearToken(organizationId);

    if (!tokenData) {
      logger.warn('No tokens found for organization', { organizationId });
      return null;
    }

    return tokenData.app_user_id;
  } catch (error) {
    logger.error('Error retrieving app user ID', { error, organizationId });
    return null;
  }
};

/**
 * Revokes tokens for a Linear organization
 *
 * @param organizationId The Linear organization ID
 * @returns True if tokens were successfully revoked, false otherwise
 */
export const revokeTokens = async (organizationId: string): Promise<boolean> => {
  try {
    // Delete the tokens from the database
    const deleted = await deleteLinearToken(organizationId);

    if (deleted) {
      logger.info('Tokens revoked for organization', { organizationId });
    } else {
      logger.warn('No tokens found to revoke for organization', { organizationId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error revoking tokens', { error, organizationId });
    return false;
  }
};

/**
 * Migrates an existing long-lived OAuth token to a short-lived + refresh token pair.
 *
 * Calls Linear's migrate_old_token endpoint to exchange the existing long-lived
 * access token for a short-lived access token and refresh token.
 *
 * Idempotent: safe to re-run. If already migrated, returns success without re-migrating.
 * Preserves old token in old_access_token column for safe rollback.
 *
 * @param organizationId The Linear organization ID
 * @returns Migration result with status and details
 */
export const migrateExistingToken = async (
  organizationId: string
): Promise<{ success: boolean; message: string; alreadyMigrated?: boolean }> => {
  logger.info('Token migration initiated', { organizationId });

  try {
    // Get existing token data
    const tokenData = await getLinearToken(organizationId);

    if (!tokenData) {
      logger.error('Token migration failed: no tokens found', { organizationId });
      return { success: false, message: 'No tokens found for organization' };
    }

    // Idempotent: skip if already migrated
    if (tokenData.migration_status === 'migrated') {
      logger.info('Token already migrated, skipping', { organizationId });
      return { success: true, message: 'Token already migrated', alreadyMigrated: true };
    }

    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('Token migration failed: missing OAuth credentials', { organizationId });
      return { success: false, message: 'Missing LINEAR_CLIENT_ID or LINEAR_CLIENT_SECRET' };
    }

    // Decrypt the current access token
    const currentAccessToken = decryptToken(tokenData.access_token);

    // Preserve old token for rollback before attempting migration
    const encryptedOldToken = tokenData.access_token;

    logger.info('Calling Linear migrate_old_token endpoint', { organizationId });

    // Call Linear's migration endpoint
    const migrationResponse = await axios.post(
      'https://api.linear.app/oauth/migrate_old_token',
      {
        access_token: currentAccessToken,
        client_id: clientId,
        client_secret: clientSecret
      }
    );

    const { access_token, refresh_token, expires_in } = migrationResponse.data;

    if (!access_token) {
      logger.error('Token migration failed: no access token in response', { organizationId });
      await updateLinearTokenMigration(organizationId, 'failed', encryptedOldToken, new Date());
      return { success: false, message: 'Migration response did not contain access token' };
    }

    // Calculate new expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (expires_in || 3600));

    // Encrypt new tokens
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : null;

    // Store new tokens
    await storeLinearToken(
      organizationId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenData.app_user_id,
      expiresAt
    );

    // Update migration status with old token preserved for rollback
    await updateLinearTokenMigration(organizationId, 'migrated', encryptedOldToken, new Date());

    logger.info('Token migration completed successfully', {
      organizationId,
      hasRefreshToken: !!refresh_token,
      expiresAt: expiresAt.toISOString()
    });

    return { success: true, message: 'Token migrated successfully' };
  } catch (error: any) {
    logger.error('Token migration failed', {
      organizationId,
      error: error?.message,
      status: error?.response?.status,
      data: error?.response?.data
    });

    // Mark as failed but preserve ability to retry
    try {
      await updateLinearTokenMigration(organizationId, 'failed', null, new Date());
    } catch (updateError) {
      logger.error('Failed to update migration status after error', { organizationId, updateError });
    }

    return {
      success: false,
      message: `Migration failed: ${error?.response?.data?.error || error?.message || 'Unknown error'}`
    };
  }
};

/**
 * Gets token status for all organizations (admin view)
 *
 * @returns Array of token status objects with expiration and migration info
 */
export const getTokenStatus = async (): Promise<Array<{
  organizationId: string;
  expiresAt: string;
  isExpired: boolean;
  minutesUntilExpiry: number;
  hasRefreshToken: boolean;
  migrationStatus: string;
  migratedAt: string | null;
}>> => {
  try {
    const tokens = await getAllLinearTokens();
    const now = new Date();

    return tokens.map(token => {
      const expiresAt = new Date(token.expires_at);
      const msUntilExpiry = expiresAt.getTime() - now.getTime();

      return {
        organizationId: token.organization_id,
        expiresAt: expiresAt.toISOString(),
        isExpired: msUntilExpiry <= 0,
        minutesUntilExpiry: Math.round(msUntilExpiry / 60000),
        hasRefreshToken: !!token.refresh_token,
        migrationStatus: token.migration_status || 'pending',
        migratedAt: token.migrated_at ? new Date(token.migrated_at).toISOString() : null
      };
    });
  } catch (error) {
    logger.error('Error getting token status', { error });
    throw error;
  }
};
