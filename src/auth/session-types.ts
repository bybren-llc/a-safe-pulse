import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    codeVerifier?: string;
    organizationId?: string;
  }
}
