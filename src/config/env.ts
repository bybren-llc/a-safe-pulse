import { z } from 'zod';

/**
 * Zod schema for environment variable validation.
 *
 * Required vars must be set before the app starts.
 * Optional vars have sensible defaults or are undefined.
 */
export const envSchema = z.object({
  // --- Required: Linear OAuth ---
  LINEAR_CLIENT_ID: z.string().min(1),
  LINEAR_CLIENT_SECRET: z.string().min(1),
  LINEAR_REDIRECT_URI: z.string().url(),

  // --- Required: Security ---
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-character hex string'),
  SESSION_SECRET: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),

  // --- Optional with defaults ---
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  DATABASE_URL: z.string().optional(),
  SQLITE_DB_PATH: z.string().optional(),

  // --- Optional: Confluence OAuth ---
  CONFLUENCE_CLIENT_ID: z.string().optional(),
  CONFLUENCE_CLIENT_SECRET: z.string().optional(),

  // --- Optional: Confluence Legacy (CLI) ---
  CONFLUENCE_USERNAME: z.string().optional(),
  CONFLUENCE_API_TOKEN: z.string().optional(),
  CONFLUENCE_BASE_URL: z.string().optional(),

  // --- Optional: Application ---
  APP_URL: z.string().url().optional(),

  // --- Optional: Slack ---
  SLACK_WEBHOOK_URL: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_PLANNING_CHANNEL: z.string().optional(),
  SLACK_ALERTS_CHANNEL: z.string().optional(),
  SLACK_SYNC_CHANNEL: z.string().optional(),
  SLACK_WORKFLOW_CHANNEL: z.string().optional(),
  SLACK_ERRORS_CHANNEL: z.string().optional(),
  SLACK_AGENT_CHANNEL: z.string().optional(),

  // --- Optional: Linear extended ---
  LINEAR_ACCESS_TOKEN: z.string().optional(),
  LINEAR_ORGANIZATION_ID: z.string().optional(),
  LINEAR_TEAM_ID: z.string().optional(),
  LINEAR_TEAM_KEY: z.string().optional(),
  LINEAR_TEAM_NAME: z.string().optional(),
  LINEAR_AGENT_ID: z.string().optional(),

  // --- Optional: Additional Linear teams ---
  LINEAR_TEAM_REN_ID: z.string().optional(),
  LINEAR_TEAM_REN_KEY: z.string().optional(),
  LINEAR_TEAM_REN_NAME: z.string().optional(),
  LINEAR_TEAM_WOR_ID: z.string().optional(),
  LINEAR_TEAM_WOR_KEY: z.string().optional(),
  LINEAR_TEAM_WOR_NAME: z.string().optional(),

  // --- Optional: Linear labels ---
  LINEAR_LABEL_BUG: z.string().optional(),
  LINEAR_LABEL_FEATURE: z.string().optional(),
  LINEAR_LABEL_IMPROVEMENT: z.string().optional(),
  LINEAR_LABEL_ERROR_HANDLING: z.string().optional(),
  LINEAR_LABEL_TECHNICAL_ENABLER: z.string().optional(),
  LINEAR_LABEL_AUGGIE: z.string().optional(),

  // --- Optional: Admin ---
  ADMIN_API_KEY: z.string().optional(),

  // --- Optional: Feature flags ---
  ENABLE_STORY_MONITORING: z.string().optional(),
  ENABLE_ART_MONITORING: z.string().optional(),
  ENABLE_DEPENDENCY_DETECTION: z.string().optional(),
  ENABLE_WORKFLOW_AUTOMATION: z.string().optional(),
  ENABLE_PERIODIC_REPORTING: z.string().optional(),
  ENABLE_ANOMALY_DETECTION: z.string().optional(),
  HEALTH_NOTIFICATIONS_ENABLED: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

/**
 * Parse and validate process.env against the schema.
 * Caches the result after first successful call.
 * Throws a descriptive ZodError if validation fails.
 *
 * Call at application startup to fail fast on missing/invalid env vars.
 * Subsequent calls return the cached result.
 */
export function loadEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
