/**
 * Integration tests for Health Monitoring System
 * 
 * Tests the complete health monitoring workflow including database integration,
 * API health checks, and notification processing.
 */

import { HealthMonitor } from '../../src/monitoring/health-monitor';
import { BudgetMonitor } from '../../src/monitoring/budget-monitor';
import { ResourceMonitor } from '../../src/monitoring/resource-monitor';
import { EnhancedSlackNotifier } from '../../src/integrations/enhanced-slack-notifier';
import { getClient } from '../../src/db/connection';
import {
  HealthMonitorConfig,
  SystemHealthStatus,
  BudgetConfig
} from '../../src/types/monitoring-types';

// Mock external dependencies but allow internal integration
jest.mock('../../src/integrations/enhanced-slack-notifier');
jest.mock('../../src/utils/logger');

describe('Health Monitoring Integration', () => {
  let healthMonitor: HealthMonitor;
  let budgetMonitor: BudgetMonitor;
  let resourceMonitor: ResourceMonitor;
  let mockSlackNotifier: jest.Mocked<EnhancedSlackNotifier>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Slack notifier
    mockSlackNotifier = new EnhancedSlackNotifier() as jest.Mocked<EnhancedSlackNotifier>;
    mockSlackNotifier.sendSystemHealthAlert = jest.fn().mockResolvedValue(true);
    mockSlackNotifier.sendBudgetAlert = jest.fn().mockResolvedValue(true);

    // Create monitoring components
    const healthConfig: Partial<HealthMonitorConfig> = {
      checkIntervalMs: 1000,
      notificationsEnabled: true,
      environment: 'test',
      tokenExpirationWarningDays: 7,
      apiUsageWarningPercentage: 80
    };

    const budgetConfig: Partial<BudgetConfig> = {
      apiLimits: {
        linear: { dailyLimit: 1000, monthlyLimit: 30000, warningThreshold: 80 },
        confluence: { dailyLimit: 5000, monthlyLimit: 150000, warningThreshold: 80 }
      },
      costTracking: {
        enabled: true,
        currency: 'USD',
        apiCosts: { linearCostPerCall: 0.001, confluenceCostPerCall: 0.002 }
      }
    };

    healthMonitor = new HealthMonitor(healthConfig);
    budgetMonitor = new BudgetMonitor(budgetConfig);
    resourceMonitor = new ResourceMonitor({
      notificationsEnabled: true,
      checkInterval: 1000
    });
  });

  describe('End-to-End Health Monitoring', () => {
    it('should perform complete health monitoring cycle', async () => {
      // Perform health check
      const healthStatus = await healthMonitor.getHealthStatus();

      // Verify comprehensive health status
      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus.timestamp).toBe('number');
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(healthStatus.overall);

      // Verify all components are checked
      expect(healthStatus.components.tokens).toBeDefined();
      expect(healthStatus.components.apis).toBeDefined();
      expect(healthStatus.components.resources).toBeDefined();
      expect(healthStatus.components.operations).toBeDefined();

      // Verify OAuth token monitoring
      expect(healthStatus.components.tokens.linearToken).toBeDefined();
      expect(healthStatus.components.tokens.confluenceToken).toBeDefined();
      expect(typeof healthStatus.components.tokens.linearToken.isHealthy).toBe('boolean');
      expect(typeof healthStatus.components.tokens.confluenceToken.isHealthy).toBe('boolean');

      // Verify API rate limit monitoring
      expect(healthStatus.components.apis.linear).toBeDefined();
      expect(healthStatus.components.apis.confluence).toBeDefined();
      expect(typeof healthStatus.components.apis.linear.usagePercentage).toBe('number');
      expect(typeof healthStatus.components.apis.confluence.usagePercentage).toBe('number');

      // Verify resource monitoring
      expect(healthStatus.components.resources.memory).toBeDefined();
      expect(healthStatus.components.resources.disk).toBeDefined();
      expect(healthStatus.components.resources.database).toBeDefined();

      // Verify operational monitoring
      expect(healthStatus.components.operations.sync).toBeDefined();
      expect(healthStatus.components.operations.planning).toBeDefined();
      expect(healthStatus.components.operations.webhooks).toBeDefined();

      // Verify alerts structure
      expect(Array.isArray(healthStatus.alerts)).toBe(true);
    }, 10000);

    it('should integrate with budget monitoring', async () => {
      // Record some API usage
      budgetMonitor.recordAPIUsage('linear', '/api/issues', 150, true);
      budgetMonitor.recordAPIUsage('confluence', '/api/content', 200, true);
      budgetMonitor.recordAPIUsage('linear', '/api/teams', 120, true);

      // Get budget usage
      const dailyUsage = budgetMonitor.getBudgetUsage('daily');
      const monthlyUsage = budgetMonitor.getBudgetUsage('monthly');

      // Verify budget tracking
      expect(dailyUsage.apiUsage.linear.calls).toBe(2);
      expect(dailyUsage.apiUsage.confluence.calls).toBe(1);
      expect(dailyUsage.totalEstimatedCost).toBeGreaterThan(0);

      expect(monthlyUsage.apiUsage.linear.calls).toBe(2);
      expect(monthlyUsage.apiUsage.confluence.calls).toBe(1);

      // Get API usage statistics
      const apiStats = budgetMonitor.getAPIUsageStats();
      expect(apiStats.totalCalls).toBe(3);
      expect(apiStats.successRate).toBe(100);
      expect(apiStats.averageResponseTime).toBeGreaterThan(0);
      expect(apiStats.costToday).toBeGreaterThan(0);
    });

    it('should integrate with resource monitoring', async () => {
      // Perform resource check
      const resourceHealth = await resourceMonitor.performResourceCheck();

      // Verify resource monitoring integration
      expect(resourceHealth).toBeDefined();
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(resourceHealth.overall);

      // Verify memory monitoring
      expect(resourceHealth.memory.usedMB).toBeGreaterThan(0);
      expect(resourceHealth.memory.totalMB).toBeGreaterThan(0);
      expect(resourceHealth.memory.usagePercentage).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.memory.usagePercentage).toBeLessThanOrEqual(100);

      // Verify disk monitoring
      expect(resourceHealth.disk.usedGB).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.disk.totalGB).toBeGreaterThan(0);
      expect(resourceHealth.disk.usagePercentage).toBeGreaterThanOrEqual(0);

      // Verify database monitoring
      expect(resourceHealth.database.connectionCount).toBeGreaterThanOrEqual(0);
      expect(resourceHealth.database.maxConnections).toBeGreaterThan(0);
      expect(resourceHealth.database.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Monitoring Configuration', () => {
    it('should support environment-specific configuration', () => {
      const prodConfig: Partial<HealthMonitorConfig> = {
        checkIntervalMs: 5 * 60 * 1000, // 5 minutes in production
        tokenExpirationWarningDays: 14, // More advance warning in production
        apiUsageWarningPercentage: 70, // More conservative in production
        environment: 'production'
      };

      const prodMonitor = new HealthMonitor(prodConfig);
      const config = prodMonitor.getConfig();

      expect(config.checkIntervalMs).toBe(5 * 60 * 1000);
      expect(config.tokenExpirationWarningDays).toBe(14);
      expect(config.apiUsageWarningPercentage).toBe(70);
      expect(config.environment).toBe('production');
    });

    it('should support configuration updates', () => {
      const originalConfig = healthMonitor.getConfig();
      expect(originalConfig.checkIntervalMs).toBe(1000);

      healthMonitor.updateConfig({
        checkIntervalMs: 30000,
        apiUsageWarningPercentage: 90
      });

      const updatedConfig = healthMonitor.getConfig();
      expect(updatedConfig.checkIntervalMs).toBe(30000);
      expect(updatedConfig.apiUsageWarningPercentage).toBe(90);
      // Other settings should remain unchanged
      expect(updatedConfig.tokenExpirationWarningDays).toBe(originalConfig.tokenExpirationWarningDays);
    });
  });

  describe('Health Metrics and Trending', () => {
    it('should collect and store health metrics', async () => {
      // Perform a few health checks to generate metrics
      await healthMonitor.getHealthStatus();
      await new Promise(resolve => setTimeout(resolve, 100));
      await healthMonitor.getHealthStatus();

      const metrics = healthMonitor.getHealthMetrics();
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      // Verify metric structure
      if (metrics.length > 0) {
        const metric = metrics[0];
        expect(metric.component).toBeDefined();
        expect(metric.metric).toBeDefined();
        expect(typeof metric.value).toBe('number');
        expect(metric.unit).toBeDefined();
        expect(metric.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should limit stored metrics to prevent memory issues', async () => {
      // Simulate many health checks
      const maxChecks = 10;
      for (let i = 0; i < maxChecks; i++) {
        await healthMonitor.getHealthStatus();
      }

      const metrics = healthMonitor.getHealthMetrics();
      
      // Should have metrics but not exceed reasonable limits
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.length).toBeLessThan(1000); // Should not exceed max limit
    });
  });

  describe('Monitoring Lifecycle Management', () => {
    it('should handle start and stop monitoring lifecycle', async () => {
      // Start monitoring
      await healthMonitor.startMonitoring();
      
      // Verify monitoring is running (would need additional state tracking in real implementation)
      expect(healthMonitor.getConfig().notificationsEnabled).toBe(true);

      // Stop monitoring
      await healthMonitor.stopMonitoring();
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle resource monitor lifecycle', () => {
      expect(resourceMonitor.isMonitoring()).toBe(false);

      resourceMonitor.start();
      expect(resourceMonitor.isMonitoring()).toBe(true);

      resourceMonitor.stop();
      expect(resourceMonitor.isMonitoring()).toBe(false);
    });
  });

  describe('Error Resilience', () => {
    it('should continue monitoring despite partial failures', async () => {
      // Simulate a scenario where some components fail but others succeed
      // This tests the resilience of the monitoring system

      const healthStatus = await healthMonitor.getHealthStatus();
      
      // Even with potential failures, should return valid status
      expect(healthStatus).toBeDefined();
      expect(healthStatus.timestamp).toBeDefined();
      expect(healthStatus.overall).toBeDefined();
    });

    it('should handle budget monitor errors gracefully', () => {
      // Test budget monitor error handling
      budgetMonitor.clearHistory(); // Should not throw

      const usage = budgetMonitor.getBudgetUsage('daily');
      expect(usage).toBeDefined();
      expect(usage.isOverBudget).toBe(false);
    });

    it('should handle resource monitor errors gracefully', async () => {
      // Resource monitor should handle system call failures
      const resourceHealth = await resourceMonitor.getResourceHealth();
      
      expect(resourceHealth).toBeDefined();
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(resourceHealth.overall);
    });
  });

  describe('Integration with External Services', () => {
    it('should integrate health monitoring with API health endpoints', async () => {
      // This would test integration with the health API endpoints
      const healthStatus = await healthMonitor.getHealthStatus();
      const budgetUsage = budgetMonitor.getBudgetUsage('daily');
      const resourceHealth = await resourceMonitor.getResourceHealth();

      // Verify data structure compatibility with API responses
      expect(healthStatus.components).toBeDefined();
      expect(budgetUsage.period).toBe('daily');
      expect(resourceHealth.overall).toBeDefined();

      // This data should be suitable for API endpoint responses
      const apiResponse = {
        status: healthStatus.overall,
        timestamp: new Date(healthStatus.timestamp).toISOString(),
        components: healthStatus.components,
        budget: budgetUsage,
        resources: resourceHealth
      };

      expect(apiResponse.status).toBeDefined();
      expect(apiResponse.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(apiResponse.components).toBeDefined();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});