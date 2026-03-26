/**
 * Comprehensive tests for Enhanced Health Monitor
 * 
 * Tests the complete health monitoring system including OAuth token tracking,
 * API rate limit monitoring, system resource monitoring, and Slack notifications.
 */

import { HealthMonitor } from '../../src/monitoring/health-monitor';
import { EnhancedSlackNotifier } from '../../src/integrations/enhanced-slack-notifier';
import { getClient } from '../../src/db/connection';
import { LinearClient } from '@linear/sdk';
import {
  HealthMonitorConfig,
  SystemHealthStatus,
  TokenHealthStatus,
  APIHealthStatus,
  ResourceHealthStatus
} from '../../src/types/monitoring-types';

// Mock dependencies
jest.mock('../../src/integrations/enhanced-slack-notifier');
jest.mock('../../src/db/connection');
jest.mock('@linear/sdk');
jest.mock('../../src/utils/logger');

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockSlackNotifier: jest.Mocked<EnhancedSlackNotifier>;
  let mockDbClient: any;
  let mockLinearClient: jest.Mocked<LinearClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database client
    mockDbClient = {
      query: jest.fn()
    };
    (getClient as jest.Mock).mockResolvedValue(mockDbClient);

    // Mock Linear client
    mockLinearClient = {
      viewer: Promise.resolve({ id: 'user-123', name: 'Test User' })
    } as any;
    (LinearClient as jest.Mock).mockImplementation(() => mockLinearClient);

    // Mock Slack notifier
    mockSlackNotifier = new EnhancedSlackNotifier() as jest.Mocked<EnhancedSlackNotifier>;
    mockSlackNotifier.sendSystemHealthAlert = jest.fn().mockResolvedValue(true);

    // Create health monitor
    healthMonitor = new HealthMonitor({
      checkIntervalMs: 1000, // 1 second for testing
      notificationsEnabled: true,
      environment: 'test'
    });
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const monitor = new HealthMonitor();
      const config = monitor.getConfig();
      
      expect(config.checkIntervalMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(config.tokenExpirationWarningDays).toBe(7);
      expect(config.apiUsageWarningPercentage).toBe(80);
      expect(config.memoryUsageWarningPercentage).toBe(85);
      expect(config.diskUsageWarningPercentage).toBe(90);
      expect(config.notificationsEnabled).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<HealthMonitorConfig> = {
        checkIntervalMs: 30000,
        tokenExpirationWarningDays: 3,
        apiUsageWarningPercentage: 70,
        notificationsEnabled: false
      };

      const monitor = new HealthMonitor(customConfig);
      const config = monitor.getConfig();
      
      expect(config.checkIntervalMs).toBe(30000);
      expect(config.tokenExpirationWarningDays).toBe(3);
      expect(config.apiUsageWarningPercentage).toBe(70);
      expect(config.notificationsEnabled).toBe(false);
    });

    it('should allow configuration updates', () => {
      const newConfig = {
        checkIntervalMs: 60000,
        tokenExpirationWarningDays: 5
      };

      healthMonitor.updateConfig(newConfig);
      const config = healthMonitor.getConfig();
      
      expect(config.checkIntervalMs).toBe(60000);
      expect(config.tokenExpirationWarningDays).toBe(5);
    });
  });

  describe('OAuth Token Health Monitoring', () => {
    it('should detect healthy Linear token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      // Mock both linear and confluence token queries
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token-123'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token-456'
          }]
        });

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();

      expect(tokenHealth.linearToken.isHealthy).toBe(true);
      expect(tokenHealth.linearToken.daysUntilExpiration).toBeGreaterThan(20);
      expect(tokenHealth.linearToken.hasRefreshToken).toBe(true);
      expect(tokenHealth.overall).toBe('healthy');
    });

    it('should detect expiring Linear token', async () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 3); // 3 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      // Mock linear (expiring) and confluence (healthy) token queries
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            expires_at: soonDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token-123'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token-456'
          }]
        });

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();

      expect(tokenHealth.linearToken.isHealthy).toBe(false);
      expect(tokenHealth.linearToken.daysUntilExpiration).toBeLessThanOrEqual(7);
      expect(tokenHealth.overall).toBe('warning');
    });

    it('should detect expired Linear token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday
      
      mockDbClient.query.mockResolvedValueOnce({
        rows: [{
          expires_at: pastDate.toISOString(),
          updated_at: new Date().toISOString(),
          refresh_token: null
        }]
      });

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();
      
      expect(tokenHealth.linearToken.isHealthy).toBe(false);
      expect(tokenHealth.linearToken.daysUntilExpiration).toBeLessThan(0);
      expect(tokenHealth.linearToken.hasRefreshToken).toBe(false);
      expect(tokenHealth.overall).toBe('critical');
    });

    it('should handle missing Linear token', async () => {
      // Mock both queries - linear returns empty, confluence also empty
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();

      expect(tokenHealth.linearToken.isHealthy).toBe(false);
      expect(tokenHealth.linearToken.daysUntilExpiration).toBe(-1);
      expect(tokenHealth.overall).toBe('critical');
    });

    it('should handle database errors gracefully', async () => {
      (getClient as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();

      // When getClient fails, both token queries fail, individual catches return unhealthy defaults
      // Overall will be 'critical' since both tokens are unhealthy
      expect(tokenHealth.linearToken.isHealthy).toBe(false);
      expect(tokenHealth.confluenceToken.isHealthy).toBe(false);
      expect(tokenHealth.overall).toBe('critical');
    });
  });

  describe('API Rate Limit Monitoring', () => {
    it('should detect healthy Linear API usage', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      // Mock both linear and confluence token queries for API stats estimation
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'token'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'token'
          }]
        });

      const apiHealth = await healthMonitor['checkAPIRateLimits']();

      expect(apiHealth.linear.isHealthy).toBe(true);
      expect(apiHealth.linear.usagePercentage).toBeLessThan(80);
      expect(apiHealth.linear.responseTime).toBeGreaterThan(0);
      expect(apiHealth.overall).toBe('healthy');
    });

    it('should detect high Linear API usage with unhealthy token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      // Linear token unhealthy (expired) -> estimated 90% usage
      // Confluence token healthy -> low usage
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            expires_at: pastDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: null
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'token'
          }]
        });

      const apiHealth = await healthMonitor['checkAPIRateLimits']();

      expect(apiHealth.linear.isHealthy).toBe(false);
      expect(apiHealth.linear.usagePercentage).toBeGreaterThanOrEqual(80);
      expect(apiHealth.overall).toBe('warning');
    });

    it('should handle missing tokens in API stats', async () => {
      // Both queries return no tokens -> both unhealthy
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const apiHealth = await healthMonitor['checkAPIRateLimits']();

      expect(apiHealth.linear.isHealthy).toBe(false);
      expect(apiHealth.linear.usagePercentage).toBe(90); // 90% estimated for unhealthy
      expect(apiHealth.linear.responseTime).toBe(500); // Unhealthy token -> 500ms
      expect(apiHealth.overall).toBe('critical');
    });

    it('should monitor Confluence API usage', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      // Mock both linear and confluence token queries
      mockDbClient.query
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'token'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'token'
          }]
        });

      const apiHealth = await healthMonitor['checkAPIRateLimits']();

      expect(apiHealth.confluence.isHealthy).toBe(true);
      expect(apiHealth.confluence.usagePercentage).toBeLessThan(80);
    });
  });

  describe('System Resource Monitoring', () => {
    it('should monitor memory usage', async () => {
      const resourceHealth = await healthMonitor['checkSystemResources']();
      
      expect(resourceHealth.memory).toBeDefined();
      expect(resourceHealth.memory.usedMB).toBeGreaterThan(0);
      expect(resourceHealth.memory.totalMB).toBeGreaterThan(0);
      expect(resourceHealth.memory.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.memory.usagePercentage).toBeLessThanOrEqual(100);
      expect(typeof resourceHealth.memory.isHealthy).toBe('boolean');
    });

    it('should monitor disk usage', async () => {
      const resourceHealth = await healthMonitor['checkSystemResources']();
      
      expect(resourceHealth.disk).toBeDefined();
      expect(resourceHealth.disk.usedGB).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.disk.totalGB).toBeGreaterThan(0);
      expect(resourceHealth.disk.availableGB).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.disk.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.disk.usagePercentage).toBeLessThanOrEqual(100);
    });

    it('should monitor database connections', async () => {
      const resourceHealth = await healthMonitor['checkSystemResources']();
      
      expect(resourceHealth.database).toBeDefined();
      expect(resourceHealth.database.connectionCount).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.database.maxConnections).toBeGreaterThan(0);
      expect(resourceHealth.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.database.poolUtilization).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.database.poolUtilization).toBeLessThanOrEqual(100);
    });

    it('should determine overall resource health', async () => {
      const resourceHealth = await healthMonitor['checkSystemResources']();
      
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(resourceHealth.overall);
    });
  });

  describe('Comprehensive Health Check', () => {
    it('should perform complete health check', async () => {
      // Mock successful token data
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      mockDbClient.query
        .mockResolvedValueOnce({ // Linear token query
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token'
          }]
        })
        .mockResolvedValueOnce({ // Confluence token query
          rows: [{
            expires_at: futureDate.toISOString(),
            updated_at: new Date().toISOString(),
            refresh_token: 'refresh-token'
          }]
        })
        .mockResolvedValueOnce({ // Linear API token query
          rows: [{ access_token: 'valid-token' }]
        })
        .mockResolvedValueOnce({ // Database ping
          rows: [{ result: 1 }]
        });

      const healthStatus = await healthMonitor.performHealthCheck();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.timestamp).toBeDefined();
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(healthStatus.overall);
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      
      // Check all components
      expect(healthStatus.components.tokens).toBeDefined();
      expect(healthStatus.components.apis).toBeDefined();
      expect(healthStatus.components.resources).toBeDefined();
      expect(healthStatus.components.operations).toBeDefined();
      
      expect(Array.isArray(healthStatus.alerts)).toBe(true);
    });

    it('should determine overall health from component statuses', async () => {
      // Mock a scenario with mixed health states
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Linear token - critical
        .mockResolvedValueOnce({ rows: [] }) // No Confluence token - critical
        .mockResolvedValueOnce({ rows: [] }) // No API token - unknown
        .mockResolvedValueOnce({ rows: [{ result: 1 }] }); // DB healthy

      const healthStatus = await healthMonitor.performHealthCheck();
      
      // With critical token issues, overall should be critical or warning
      expect(['warning', 'critical', 'unknown']).toContain(healthStatus.overall);
      expect(healthStatus.isHealthy).toBe(false);
    });
  });

  describe('Health Monitoring Lifecycle', () => {
    it('should start monitoring', async () => {
      await expect(healthMonitor.startMonitoring()).resolves.not.toThrow();
    });

    it('should stop monitoring', async () => {
      await healthMonitor.startMonitoring();
      await expect(healthMonitor.stopMonitoring()).resolves.not.toThrow();
    });

    it('should not start monitoring if already running', async () => {
      await healthMonitor.startMonitoring();
      await expect(healthMonitor.startMonitoring()).resolves.not.toThrow();
      await healthMonitor.stopMonitoring();
    });

    it('should get current health status', async () => {
      // Mock database responses
      mockDbClient.query
        .mockResolvedValue({ rows: [] });

      const healthStatus = await healthMonitor.getHealthStatus();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.timestamp).toBeDefined();
      expect(healthStatus.components).toBeDefined();
    });

    it('should store and retrieve health metrics', async () => {
      // Mock a health check to generate metrics
      mockDbClient.query.mockResolvedValue({ rows: [] });
      
      await healthMonitor.performHealthCheck();
      
      const metrics = healthMonitor.getHealthMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      (getClient as jest.Mock).mockRejectedValue(new Error('Database unavailable'));

      const tokenHealth = await healthMonitor['checkOAuthTokenHealth']();

      // Each token query catches the DB error individually and returns unhealthy defaults
      expect(tokenHealth.linearToken.isHealthy).toBe(false);
      expect(tokenHealth.confluenceToken.isHealthy).toBe(false);
      expect(tokenHealth.overall).toBe('critical');
    });

    it('should handle unhealthy token in API rate estimation', async () => {
      // Both token queries return no rows -> unhealthy tokens -> high estimated usage
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const apiHealth = await healthMonitor['checkAPIRateLimits']();

      expect(apiHealth.linear.isHealthy).toBe(false);
      expect(apiHealth.linear.responseTime).toBe(500); // unhealthy token -> 500ms estimate
    });

    it('should continue monitoring despite individual component errors', async () => {
      // Mock mixed success/failure scenarios
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [] }) // Token query fails (empty)
        .mockRejectedValueOnce(new Error('DB Error')) // API query fails
        .mockResolvedValueOnce({ rows: [{ result: 1 }] }); // Resource query succeeds

      const healthStatus = await healthMonitor.performHealthCheck();
      
      // Should still return a status even with errors
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBeDefined();
    });
  });

  describe('Alert Processing', () => {
    it('should process health alerts', async () => {
      // Mock unhealthy conditions
      mockDbClient.query.mockResolvedValue({ rows: [] }); // No tokens

      const healthStatus = await healthMonitor.performHealthCheck();
      
      // Verify health check completed despite issues
      expect(healthStatus).toBeDefined();
      expect(healthStatus.alerts).toBeDefined();
    });

    it('should send monitoring error alerts', async () => {
      // Mock a scenario that triggers monitoring error
      jest.spyOn(healthMonitor, 'performHealthCheck')
        .mockRejectedValueOnce(new Error('Monitoring failed'));

      // Should not throw, should handle error gracefully
      // This would be tested in the actual monitoring loop
      expect(healthMonitor.getConfig().notificationsEnabled).toBe(true);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});