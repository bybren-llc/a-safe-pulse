import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initiateOAuth, handleOAuthCallback } from './auth/oauth';
import { initiateConfluenceOAuth, handleConfluenceCallback } from './auth/confluence-oauth';
import { handleWebhook } from './webhooks/handler';
import { initializeDatabase } from './db/models';
import * as logger from './utils/logger';
import planningRoutes from './api/planning';
import healthRoutes from './api/health';
import apiRoutes from './routes';
import { LinearClientWrapper } from './linear/client';
import { initializeGlobalRegistry } from './agent/behavior-registry';
import { processBehaviorWebhook } from './agent/webhook-integration';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Session middleware for OAuth state management
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Rate limiting for OAuth endpoints to prevent abuse
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 OAuth requests per windowMs
  message: {
    error: 'Too many OAuth requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('OAuth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      error: 'Too many OAuth requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Routes
app.get('/', (req, res) => {
  res.send('WTFB Linear Planning Agent is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// OAuth routes with rate limiting
app.get('/auth', oauthLimiter, initiateOAuth);
app.get('/auth/callback', oauthLimiter, handleOAuthCallback);

// Confluence OAuth routes with rate limiting
app.get('/auth/confluence', oauthLimiter, initiateConfluenceOAuth);
app.get('/auth/confluence/callback', oauthLimiter, handleConfluenceCallback);

// OAuth success pages
app.get('/auth/success', (req, res) => {
  res.send(`
    <html>
      <head><title>OAuth Success</title></head>
      <body>
        <h1>Linear OAuth Successful!</h1>
        <p>You have successfully authenticated with Linear.</p>
        <p>You can now close this window.</p>
      </body>
    </html>
  `);
});

app.get('/auth/confluence/success', (req, res) => {
  res.send(`
    <html>
      <head><title>Confluence OAuth Success</title></head>
      <body>
        <h1>Confluence OAuth Successful!</h1>
        <p>You have successfully authenticated with Confluence.</p>
        <p>You can now close this window.</p>
      </body>
    </html>
  `);
});

// Webhook endpoints
app.post('/webhook', handleWebhook);
app.post('/webhook/behaviors', processBehaviorWebhook);

// Planning API routes
app.use('/api/planning', planningRoutes);

// Health API routes
app.use('/api/health', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// Initialize the database and start the server
(async () => {
  try {
    // Initialize the database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize behavior registry if Linear token is available
    if (process.env.LINEAR_ACCESS_TOKEN) {
      try {
        const linearClient = new LinearClientWrapper(
          process.env.LINEAR_ACCESS_TOKEN,
          process.env.LINEAR_ORGANIZATION_ID || ''
        );
        
        await initializeGlobalRegistry({
          linearClient,
          enabledBehaviors: {
            storyMonitoring: process.env.ENABLE_STORY_MONITORING !== 'false',
            artHealthMonitoring: process.env.ENABLE_ART_MONITORING !== 'false',
            dependencyDetection: process.env.ENABLE_DEPENDENCY_DETECTION !== 'false',
            workflowAutomation: process.env.ENABLE_WORKFLOW_AUTOMATION !== 'false',
            periodicReporting: process.env.ENABLE_PERIODIC_REPORTING === 'true',
            anomalyDetection: process.env.ENABLE_ANOMALY_DETECTION === 'true'
          }
        });
        
        logger.info('Behavior registry initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize behavior registry', { error });
        // Continue without behavior system - don't crash the app
      }
    } else {
      logger.warn('LINEAR_ACCESS_TOKEN not configured - behavior system disabled');
    }

    // Start the server
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`OAuth callback URL: ${process.env.LINEAR_REDIRECT_URI}`);
    });
  } catch (error) {
    logger.error('Failed to initialize the application', { error });
    process.exit(1);
  }
})();
