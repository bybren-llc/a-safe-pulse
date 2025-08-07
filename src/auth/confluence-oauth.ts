/**
 * Confluence OAuth authentication
 *
 * This module provides functions for authenticating with the Confluence API using OAuth 2.0.
 * It handles the OAuth flow, token storage, and token refresh.
 */

import axios from 'axios';
import * as logger from '../utils/logger';
import {
  storeConfluenceToken,
  getConfluenceToken,
  getConfluenceAccessToken
} from '../db/models';
import { encryptToken, decryptToken } from './tokens';

/**
 * Initiates the Confluence OAuth flow
 *
 * @param req The request object
 * @param res The response object
 */
export const initiateConfluenceOAuth = (req: any, res: any): void => {
  try {
    const clientId = process.env.CONFLUENCE_CLIENT_ID;
    if (!clientId) {
      logger.error('Missing CONFLUENCE_CLIENT_ID environment variable');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Store the organization ID in the session for use in the callback
    req.session.organizationId = req.query.organizationId;
    
    // Redirect URL must be registered in the Atlassian Developer Console
    const redirectUri = `${process.env.APP_URL}/auth/confluence/callback`;
    
    // Construct the authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.append('audience', 'api.atlassian.com');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('scope', 'read:confluence-content.summary read:confluence-space.summary read:confluence-content.all read:confluence-space.all');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', req.session.organizationId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('prompt', 'consent');
    
    // Redirect the user to the authorization URL
    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error('Error initiating Confluence OAuth', { error });
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
};

/**
 * Handles the Confluence OAuth callback
 *
 * @param req The request object
 * @param res The response object
 */
export const handleConfluenceCallback = async (req: any, res: any): Promise<void> => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      logger.error('No authorization code received from Confluence');
      res.status(400).json({ error: 'No authorization code received' });
      return;
    }
    
    // Verify the state parameter matches the organization ID
    const organizationId = state || req.session.organizationId;
    if (!organizationId) {
      logger.error('No organization ID found in session or state parameter');
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }
    
    // Exchange the authorization code for an access token
    const clientId = process.env.CONFLUENCE_CLIENT_ID;
    const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL}/auth/confluence/callback`;
    
    if (!clientId || !clientSecret) {
      logger.error('Missing Confluence OAuth credentials');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }
    
    const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    });
    
    const { 
      access_token, 
      refresh_token, 
      expires_in, 
      scope 
    } = tokenResponse.data;
    
    // Get the Confluence site URL from the access token
    const resourceResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!resourceResponse.data || resourceResponse.data.length === 0) {
      logger.error('No accessible Confluence sites found');
      res.status(400).json({ error: 'No accessible Confluence sites found' });
      return;
    }
    
    // Use the first Confluence site
    const confluenceSite = resourceResponse.data[0];
    const siteUrl = `https://api.atlassian.com/ex/confluence/${confluenceSite.id}`;
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens before storage for security
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = encryptToken(refresh_token);

    // Store the encrypted tokens in the database
    await storeConfluenceToken(
      organizationId,
      encryptedAccessToken,
      encryptedRefreshToken,
      siteUrl,
      expiresAt
    );
    
    logger.info('Confluence OAuth successful', { organizationId });
    
    // Redirect to the success page
    res.redirect(`/auth/confluence/success?organizationId=${organizationId}`);
  } catch (error) {
    logger.error('Error handling Confluence OAuth callback', { error });
    res.status(500).json({ error: 'Failed to complete OAuth flow' });
  }
};

/**
 * Refreshes an expired Confluence access token
 *
 * @param organizationId The organization ID
 * @returns The new access token or null if refresh fails
 */
export const refreshConfluenceToken = async (organizationId: string): Promise<string | null> => {
  try {
    // Get the token data from the database
    const tokenData = await getConfluenceToken(organizationId);
    
    if (!tokenData) {
      logger.error(`No Confluence tokens found for organization ${organizationId}`);
      return null;
    }
    
    const clientId = process.env.CONFLUENCE_CLIENT_ID;
    const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      logger.error('Missing CONFLUENCE_CLIENT_ID or CONFLUENCE_CLIENT_SECRET environment variables');
      return null;
    }
    
    // Decrypt the refresh token before using it
    if (!tokenData.refresh_token) {
      logger.error('No refresh token available for Confluence token refresh');
      return null;
    }
    const decryptedRefreshToken = decryptToken(tokenData.refresh_token);

    // Exchange the refresh token for a new access token
    const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefreshToken
    });
    
    const { 
      access_token, 
      refresh_token, 
      expires_in 
    } = tokenResponse.data;
    
    if (!access_token) {
      logger.error('Failed to refresh Confluence access token');
      return null;
    }
    
    // Calculate new expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt new tokens before storage
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : tokenData.refresh_token!;

    // Store the new encrypted tokens
    await storeConfluenceToken(
      organizationId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenData.site_url,
      expiresAt
    );
    
    logger.info('Confluence token refreshed for organization', { organizationId });
    return access_token;
  } catch (error) {
    logger.error('Error refreshing Confluence token', { error, organizationId });
    return null;
  }
};

/**
 * Gets a Confluence client for an organization
 *
 * @param organizationId The organization ID
 * @returns The Confluence client or null if not available
 */
export const getConfluenceClient = async (organizationId: string): Promise<any | null> => {
  try {
    // Import here to avoid circular dependencies
    const { ConfluenceClient } = require('../confluence/client');
    
    // Get the access token
    const accessToken = await getConfluenceAccessToken(organizationId);
    if (!accessToken) {
      logger.error('No valid Confluence access token found', { organizationId });
      return null;
    }
    
    // Get the site URL
    const tokenData = await getConfluenceToken(organizationId);
    if (!tokenData) {
      logger.error('No Confluence token data found', { organizationId });
      return null;
    }
    
    // Create and return the client
    return new ConfluenceClient(tokenData.site_url, accessToken);
  } catch (error) {
    logger.error('Error creating Confluence client', { error, organizationId });
    return null;
  }
};
