import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import * as logger from '../utils/logger';
import * as tokenManager from './tokens';
import './session-types';

/**
 * Initiates the OAuth flow by redirecting to Linear's authorization page
 */
export const initiateOAuth = (req: Request, res: Response) => {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const redirectUri = process.env.LINEAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    logger.error('Missing LINEAR_CLIENT_ID or LINEAR_REDIRECT_URI environment variables');
    return res.status(500).json({
      error: 'Missing LINEAR_CLIENT_ID or LINEAR_REDIRECT_URI environment variables'
    });
  }

  if (!req.session) {
    logger.error('Session not available for OAuth state management');
    return res.status(500).json({ error: 'Session not available' });
  }

  // Generate cryptographic state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  req.session.codeVerifier = codeVerifier;

  // Construct the authorization URL
  const authUrl = new URL('https://linear.app/oauth/authorize');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'read write app:assignable app:mentionable');
  authUrl.searchParams.append('actor', 'app');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  logger.info('Initiating OAuth flow', { redirectUri });

  // Redirect the user to Linear's authorization page
  res.redirect(authUrl.toString());
};

/**
 * Handles the OAuth callback from Linear
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      logger.error('Missing authorization code');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Validate cryptographic state parameter (CSRF protection)
    if (!req.session || !req.session.oauthState) {
      logger.error('OAuth state not found in session');
      return res.status(403).json({ error: 'Invalid OAuth state - session expired or missing' });
    }

    if (!state || typeof state !== 'string') {
      logger.error('Missing state parameter in callback');
      return res.status(403).json({ error: 'Missing state parameter' });
    }

    try {
      const stateMatch = crypto.timingSafeEqual(
        Buffer.from(state as string),
        Buffer.from(req.session.oauthState)
      );
      if (!stateMatch) {
        logger.error('OAuth state mismatch - possible CSRF attack');
        return res.status(403).json({ error: 'Invalid OAuth state' });
      }
    } catch {
      logger.error('OAuth state comparison failed');
      return res.status(403).json({ error: 'Invalid OAuth state' });
    }

    // Retrieve PKCE code verifier from session
    const codeVerifier = req.session.codeVerifier;
    if (!codeVerifier) {
      logger.error('PKCE code verifier not found in session');
      return res.status(403).json({ error: 'PKCE verification failed - session expired or missing' });
    }

    // Clear session OAuth state to prevent replay attacks
    delete req.session.oauthState;
    delete req.session.codeVerifier;

    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;
    const redirectUri = process.env.LINEAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      logger.error('Missing OAuth environment variables');
      return res.status(500).json({
        error: 'Missing OAuth environment variables'
      });
    }

    // Exchange the authorization code for an access token
    logger.info('Attempting token exchange', {
      client_id: clientId,
      redirect_uri: redirectUri,
      code: typeof code === 'string' ? code.substring(0, 10) + '...' : 'invalid',
      grant_type: 'authorization_code'
    });

    // Linear requires URL-encoded form data, not JSON!
    const tokenResponse = await axios.post('https://api.linear.app/oauth/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code as string,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      logger.error('Failed to obtain access token');
      return res.status(500).json({ error: 'Failed to obtain access token' });
    }

    logger.info('Access token obtained');

    // Get the app user ID and organization information
    const appUserResponse = await axios.post(
      'https://api.linear.app/graphql',
      {
        query: `
          query Me {
            viewer {
              id
              organization {
                id
                name
              }
            }
          }
        `
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { id: appUserId, organization } = appUserResponse.data.data.viewer;
    const { id: organizationId, name: organizationName } = organization;

    logger.info('User and organization info retrieved', {
      appUserId,
      organizationId,
      organizationName
    });

    // Store the tokens securely in the database
    try {
      await tokenManager.storeTokens(
        organizationId,
        organizationName,
        access_token,
        refresh_token,
        appUserId,
        expires_in
      );

      logger.info('Tokens stored successfully', { organizationId, appUserId });
    } catch (storageError) {
      logger.error('Failed to store tokens', { error: storageError });
      return res.status(500).json({ error: 'Failed to store tokens' });
    }

    // Redirect to a success page
    res.send(`
      <html>
        <head>
          <title>Authorization Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              margin-top: 50px;
            }
            .success {
              color: #4CAF50;
              font-size: 24px;
              margin-bottom: 20px;
            }
            .info {
              color: #555;
              margin-bottom: 30px;
            }
            .org {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="success">Authorization Successful!</div>
          <div class="info">The Linear Planning Agent has been authorized for <span class="org">${organizationName}</span>.</div>
          <div>You can close this window now.</div>
        </body>
      </html>
    `);
  } catch (error: any) {
    logger.error('OAuth callback error', {
      error: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      config: {
        url: error?.config?.url,
        method: error?.config?.method,
        data: error?.config?.data
      }
    });
    res.status(500).json({ error: 'Failed to complete OAuth flow' });
  }
};
