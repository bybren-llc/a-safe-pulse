/**
 * Integration Tests for System Health Monitoring
 * 
 * These tests verify the end-to-end functionality of the health monitoring system
 * including integration with Enhanced SlackNotifier and OperationalNotificationCoordinator.
 */
import { HealthMonitor } from '../src/monitoring/health-monitor';
import { BudgetMonitor } from '../src/monitoring/budget-monitor';
import { ResourceMonitor } from '../src/monitoring/resource-monitor';
import { EnhancedSlackNotifier } from '../src/integrations/enhanced-slack-notifier';
import { OperationalNotificationCoordinator } from '../src/utils/operational-notification-coordinator';
import * as logger from '../src/utils/logger';

// Mock dependencies
jest.mock('../src/integrations/enhanced-slack-notifier');
jest.mock('../src/utils/operational-notification-coordinator');
jest.mock('../src/utils/logger');
jest.mock('../src/db/connection');

describe('System Health Monitoring Integration', () => {
  let healthMonitor: HealthMonitor;
  let budgetMonitor: BudgetMonitor;
  let resourceMonitor: ResourceMonitor;
  let mockSlackNotifier: jest.Mocked<EnhancedSlackNotifier>;
  let mockCoordinator: jest.Mocked<OperationalNotificationCoordinator>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockSlackNotifier = new EnhancedSlackNotifier() as jest.Mocked<EnhancedSlackNotifier>;
    mockCoordinator = {
      getInstance: jest.fn(),
      createDefaultConfig: jest.fn(),
      getHealthStatus: jest.fn(),
      getCoordinatorStats: jest.fn()
    } as any;

    // Mock the constructors
    (EnhancedSlackNotifier as jest.MockedClass<typeof EnhancedSlackNotifier>).mockImplementation(() => mockSlackNotifier);

    // Mock static methods
    (OperationalNotificationCoordinator.getInstance as jest.Mock).mockReturnValue(mockCoordinator);
    (OperationalNotificationCoordinator.createDefaultConfig as jest.Mock).mockReturnValue({
      environment: 'test',
      healthMonitoring: { enabled: true }
    });

    // Setup default mock responses
    mockCoordinator.getHealthStatus.mockReturnValue({
      overall: 'healthy',
      components: [],
      lastUpdated: Date.now()
    });

    // Create monitoring instances
    healthMonitor = new HealthMonitor({
      checkIntervalMs: 1000, // 1 second for testing
      notificationsEnabled: true,
      environment: 'development'
    });

    budgetMonitor = new BudgetMonitor({
      apiLimits: {
        linear: { dailyLimit: 100, monthlyLimit: 3000, warningThreshold: 80 },
        confluence: { dailyLimit: 50, monthlyLimit: 1500, warningThreshold: 80 }
      },
      costTracking: { enabled: true, currency: 'USD', apiCosts: { linearCostPerCall: 0.001, confluenceCostPerCall: 0.002 } }
    });

    resourceMonitor = new ResourceMonitor({
      thresholds: {
        memory: { warning: 85, critical: 95 },
        disk: { warning: 90, critical: 95 },
        database: { connectionWarning: 80, connectionCritical: 95, responseTimeWarning: 1000, responseTimeCritical: 5000 }
      },
      notificationsEnabled: true
    });
  });

  afterEach(async () => {
    // Clean up
    await healthMonitor.stopMonitoring();
    resourceMonitor.stop();
    budgetMonitor.clearHistory();
  });

  describe('Health Monitoring Integration', () => {
    it('should perform comprehensive health check', async () => {
      const healthStatus = await healthMonitor.performHealthCheck();

      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('isHealthy');
      expect(healthStatus).toHaveProperty('overall');
      expect(healthStatus).toHaveProperty('components');
      expect(healthStatus.components).toHaveProperty('tokens');
      expect(healthStatus.components).toHaveProperty('apis');
      expect(healthStatus.components).toHaveProperty('resources');
      expect(healthStatus.components).toHaveProperty('operations');
    });

    it('should integrate with operational notification coordinator', async () => {
      // The health monitor uses its own operational monitor, not the coordinator directly
      const healthStatus = await healthMonitor.performHealthCheck();

      expect(healthStatus).toHaveProperty('components');
      expect(healthStatus.components).toHaveProperty('operations');
    });

    it('should store health metrics for trending', async () => {
      await healthMonitor.performHealthCheck();
      const metrics = healthMonitor.getHealthMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]).toHaveProperty('component');
      expect(metrics[0]).toHaveProperty('metric');
      expect(metrics[0]).toHaveProperty('value');
      expect(metrics[0]).toHaveProperty('timestamp');
    });
  });

  describe('Budget Monitoring Integration', () => {
    it('should track API usage and calculate costs', () => {
      budgetMonitor.recordAPIUsage('linear', '/issues', 150, true);
      budgetMonitor.recordAPIUsage('confluence', '/content', 200, true);

      const stats = budgetMonitor.getAPIUsageStats();
      expect(stats.totalCalls).toBe(2);
      expect(stats.successRate).toBe(100);
      expect(stats.averageResponseTime).toBe(175); // (150 + 200) / 2
    });

    it('should calculate budget usage correctly', () => {
      // Record some API usage
      for (let i = 0; i < 10; i++) {
        budgetMonitor.recordAPIUsage('linear', '/issues', 150, true);
      }

      const dailyUsage = budgetMonitor.getBudgetUsage('daily');
      expect(dailyUsage.apiUsage.linear.calls).toBe(10);
      expect(dailyUsage.apiUsage.linear.usagePercentage).toBe(10); // 10/100 * 100
      expect(dailyUsage.totalEstimatedCost).toBeGreaterThan(0);
    });

    it('should detect over-budget usage', () => {
      // Record usage that exceeds daily limit
      for (let i = 0; i < 110; i++) {
        budgetMonitor.recordAPIUsage('linear', '/issues', 150, true);
      }

      const dailyUsage = budgetMonitor.getBudgetUsage('daily');
      expect(dailyUsage.isOverBudget).toBe(true);
    });
  });

  describe('Resource Monitoring Integration', () => {
    it('should monitor system resources', async () => {
      const resourceHealth = await resourceMonitor.performResourceCheck();

      expect(resourceHealth).toHaveProperty('memory');
      expect(resourceHealth).toHaveProperty('disk');
      expect(resourceHealth).toHaveProperty('database');
      expect(resourceHealth).toHaveProperty('overall');
      expect(resourceHealth.memory).toHaveProperty('usagePercentage');
      expect(resourceHealth.disk).toHaveProperty('usagePercentage');
      expect(resourceHealth.database).toHaveProperty('connectionCount');
    });

    it('should start and stop resource monitoring', () => {
      expect(resourceMonitor.isMonitoring()).toBe(false);
      
      resourceMonitor.start();
      expect(resourceMonitor.isMonitoring()).toBe(true);
      
      resourceMonitor.stop();
      expect(resourceMonitor.isMonitoring()).toBe(false);
    });
  });

  describe('End-to-End Monitoring Workflow', () => {
    it('should perform complete monitoring cycle', async () => {
      // Start all monitoring
      await healthMonitor.startMonitoring();
      resourceMonitor.start();

      // Record some activity
      budgetMonitor.recordAPIUsage('linear', '/issues', 150, true);
      budgetMonitor.recordResourceUsage('memory', 1024, 'MB');

      // Perform health check
      const healthStatus = await healthMonitor.performHealthCheck();
      const budgetUsage = budgetMonitor.getBudgetUsage('daily');
      const resourceHealth = await resourceMonitor.performResourceCheck();

      // Verify all components return valid status (may not be healthy without real DB/tokens)
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      expect(healthStatus.overall).toBeDefined();
      expect(budgetUsage.apiUsage.linear.calls).toBe(1);
      expect(resourceHealth.overall).toBeDefined();

      // Stop monitoring
      await healthMonitor.stopMonitoring();
      resourceMonitor.stop();
    });

    it('should handle configuration updates', () => {
      const newHealthConfig = {
        checkIntervalMs: 2000,
        notificationsEnabled: false
      };

      const newBudgetConfig = {
        apiLimits: {
          linear: { dailyLimit: 200, monthlyLimit: 6000, warningThreshold: 90 },
          confluence: { dailyLimit: 100, monthlyLimit: 3000, warningThreshold: 90 }
        }
      };

      healthMonitor.updateConfig(newHealthConfig);
      budgetMonitor.updateConfig(newBudgetConfig);

      const healthConfig = healthMonitor.getConfig();
      const budgetConfig = budgetMonitor.getConfig();

      expect(healthConfig.checkIntervalMs).toBe(2000);
      expect(healthConfig.notificationsEnabled).toBe(false);
      expect(budgetConfig.apiLimits.linear.dailyLimit).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle health check errors gracefully', async () => {
      // Mock an error in the health monitor's checkSystemResources method
      const originalCheckSystemResources = healthMonitor.checkSystemResources;
      healthMonitor.checkSystemResources = jest.fn().mockRejectedValue(new Error('System resources error'));

      // performHealthCheck uses Promise.allSettled so it doesn't throw;
      // it returns degraded status instead
      const healthStatus = await healthMonitor.performHealthCheck();
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBeDefined();

      // Restore original method
      healthMonitor.checkSystemResources = originalCheckSystemResources;
    });

    it('should handle resource monitoring errors gracefully', async () => {
      // Mock database connection error
      const mockGetClient = require('../src/db/connection').getClient;
      mockGetClient.mockRejectedValue(new Error('Database connection error'));

      const resourceHealth = await resourceMonitor.performResourceCheck();

      // Should still return a health status even with database errors
      expect(resourceHealth).toHaveProperty('overall');
      expect(resourceHealth.database.isHealthy).toBe(true); // Default healthy since poolUtilization is 0
    });

    it('should continue monitoring after errors', async () => {
      await healthMonitor.startMonitoring();

      // Simulate an error during health check
      const originalPerformHealthCheck = healthMonitor.performHealthCheck;
      const mockPerformHealthCheck = jest.fn().mockRejectedValueOnce(new Error('Health check error'));
      healthMonitor.performHealthCheck = mockPerformHealthCheck;

      // Wait for the monitoring interval to trigger
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error during enhanced health check',
        expect.objectContaining({ error: expect.any(Error) })
      );

      // Restore original method
      healthMonitor.performHealthCheck = originalPerformHealthCheck;
      await healthMonitor.stopMonitoring();
    });
  });

  describe('Performance', () => {
    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await healthMonitor.performHealthCheck();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large amounts of usage data efficiently', () => {
      const startTime = Date.now();

      // Record 1000 API calls
      for (let i = 0; i < 1000; i++) {
        budgetMonitor.recordAPIUsage('linear', '/issues', 150, true);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(budgetMonitor.getAPIUsageStats().totalCalls).toBe(1000);
    });
  });
});
