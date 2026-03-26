import { envSchema, loadEnv } from '../../src/config/env';

describe('envSchema', () => {
  const validEnv = {
    LINEAR_CLIENT_ID: 'test-client-id',
    LINEAR_CLIENT_SECRET: 'test-client-secret',
    LINEAR_REDIRECT_URI: 'http://localhost:3000/auth/callback',
    ENCRYPTION_KEY: 'a'.repeat(64),
    SESSION_SECRET: 'test-session-secret',
    WEBHOOK_SECRET: 'test-webhook-secret',
  };

  it('should accept valid required env vars with defaults applied', () => {
    const result = envSchema.parse(validEnv);

    expect(result.LINEAR_CLIENT_ID).toBe('test-client-id');
    expect(result.LINEAR_CLIENT_SECRET).toBe('test-client-secret');
    expect(result.LINEAR_REDIRECT_URI).toBe('http://localhost:3000/auth/callback');
    expect(result.ENCRYPTION_KEY).toBe('a'.repeat(64));
    expect(result.SESSION_SECRET).toBe('test-session-secret');
    expect(result.WEBHOOK_SECRET).toBe('test-webhook-secret');

    // Defaults
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('should reject missing required vars', () => {
    const result = envSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i: { path: (string | number)[] }) => i.path[0]);
      expect(paths).toContain('LINEAR_CLIENT_ID');
      expect(paths).toContain('LINEAR_CLIENT_SECRET');
      expect(paths).toContain('LINEAR_REDIRECT_URI');
      expect(paths).toContain('ENCRYPTION_KEY');
      expect(paths).toContain('SESSION_SECRET');
      expect(paths).toContain('WEBHOOK_SECRET');
    }
  });

  it('should reject invalid ENCRYPTION_KEY', () => {
    // Too short
    expect(
      envSchema.safeParse({ ...validEnv, ENCRYPTION_KEY: 'short' }).success
    ).toBe(false);

    // Right length but not hex
    expect(
      envSchema.safeParse({ ...validEnv, ENCRYPTION_KEY: 'g'.repeat(64) }).success
    ).toBe(false);
  });

  it('should reject invalid LINEAR_REDIRECT_URI', () => {
    expect(
      envSchema.safeParse({ ...validEnv, LINEAR_REDIRECT_URI: 'not-a-url' }).success
    ).toBe(false);
  });

  it('should accept valid optional vars', () => {
    const result = envSchema.parse({
      ...validEnv,
      PORT: '8080',
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      DATABASE_URL: 'postgresql://localhost/test',
      CONFLUENCE_CLIENT_ID: 'conf-id',
      APP_URL: 'https://example.com',
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
      LINEAR_ACCESS_TOKEN: 'lin_token',
      ADMIN_API_KEY: 'admin-key',
    });

    expect(result.PORT).toBe(8080);
    expect(result.NODE_ENV).toBe('production');
    expect(result.LOG_LEVEL).toBe('debug');
    expect(result.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(result.CONFLUENCE_CLIENT_ID).toBe('conf-id');
    expect(result.APP_URL).toBe('https://example.com');
    expect(result.SLACK_WEBHOOK_URL).toBe('https://hooks.slack.com/test');
    expect(result.LINEAR_ACCESS_TOKEN).toBe('lin_token');
    expect(result.ADMIN_API_KEY).toBe('admin-key');
  });

  it('should reject invalid NODE_ENV', () => {
    expect(
      envSchema.safeParse({ ...validEnv, NODE_ENV: 'invalid' }).success
    ).toBe(false);
  });

  it('should reject invalid PORT', () => {
    expect(
      envSchema.safeParse({ ...validEnv, PORT: 'not-a-number' }).success
    ).toBe(false);
  });

  it('should reject invalid APP_URL', () => {
    expect(
      envSchema.safeParse({ ...validEnv, APP_URL: 'not-a-url' }).success
    ).toBe(false);
  });

  it('should include feature flag fields', () => {
    const result = envSchema.parse({
      ...validEnv,
      ENABLE_STORY_MONITORING: 'true',
      ENABLE_ART_MONITORING: 'false',
      ENABLE_DEPENDENCY_DETECTION: 'true',
      ENABLE_WORKFLOW_AUTOMATION: 'false',
      ENABLE_PERIODIC_REPORTING: 'true',
      ENABLE_ANOMALY_DETECTION: 'false',
      HEALTH_NOTIFICATIONS_ENABLED: 'true',
    });

    expect(result.ENABLE_STORY_MONITORING).toBe('true');
    expect(result.ENABLE_ART_MONITORING).toBe('false');
    expect(result.HEALTH_NOTIFICATIONS_ENABLED).toBe('true');
  });

  it('should include Linear team and label fields', () => {
    const result = envSchema.parse({
      ...validEnv,
      LINEAR_ORGANIZATION_ID: 'org-123',
      LINEAR_TEAM_ID: 'team-123',
      LINEAR_TEAM_KEY: 'LIN',
      LINEAR_TEAM_NAME: 'Linear agents',
      LINEAR_AGENT_ID: 'agent-123',
      LINEAR_LABEL_BUG: 'label-bug',
      LINEAR_LABEL_FEATURE: 'label-feat',
    });

    expect(result.LINEAR_ORGANIZATION_ID).toBe('org-123');
    expect(result.LINEAR_TEAM_ID).toBe('team-123');
    expect(result.LINEAR_LABEL_BUG).toBe('label-bug');
  });

  it('should include Slack channel fields', () => {
    const result = envSchema.parse({
      ...validEnv,
      SLACK_PLANNING_CHANNEL: '#planning-ops',
      SLACK_ALERTS_CHANNEL: '#system-alerts',
      SLACK_SYNC_CHANNEL: '#sync-status',
      SLACK_WORKFLOW_CHANNEL: '#dev-workflow',
      SLACK_ERRORS_CHANNEL: '#critical-alerts',
      SLACK_AGENT_CHANNEL: '#agent-updates',
    });

    expect(result.SLACK_PLANNING_CHANNEL).toBe('#planning-ops');
    expect(result.SLACK_ERRORS_CHANNEL).toBe('#critical-alerts');
  });

  it('should include Confluence legacy fields', () => {
    const result = envSchema.parse({
      ...validEnv,
      CONFLUENCE_USERNAME: 'user@example.com',
      CONFLUENCE_API_TOKEN: 'conf-token',
      CONFLUENCE_BASE_URL: 'https://example.atlassian.net/wiki',
    });

    expect(result.CONFLUENCE_USERNAME).toBe('user@example.com');
    expect(result.CONFLUENCE_API_TOKEN).toBe('conf-token');
    expect(result.CONFLUENCE_BASE_URL).toBe('https://example.atlassian.net/wiki');
  });
});

describe('loadEnv', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    // Reset the cached env by re-importing (jest module cache reset)
    jest.resetModules();
  });

  it('should throw ZodError when required vars are missing', () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
    delete process.env.LINEAR_REDIRECT_URI;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.SESSION_SECRET;
    delete process.env.WEBHOOK_SECRET;

    // Re-import to get fresh module without cache
    const { loadEnv: freshLoadEnv } = require('../../src/config/env');
    expect(() => freshLoadEnv()).toThrow();
  });
});
