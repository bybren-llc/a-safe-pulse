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
import { storeLinearToken, getLinearToken, getAccessToken as getDbAccessToken, deleteLinearToken } from '../db/models';

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
 * If the token is expired, it will attempt to refresh it automatically.
 *
 * @param organizationId The Linear organization ID
 * @returns The valid access token or null if not available
 */
export const getAccessToken = async (organizationId: string): Promise<string | null> => {
  try {
    // Get the token from the database
    const token = await getDbAccessToken(organizationId);

    if (token) {
      return token;
    }

    // If no valid token was found, try to refresh it
    return await refreshToken(organizationId);
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
