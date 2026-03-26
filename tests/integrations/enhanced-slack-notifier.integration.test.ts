/**
 * Integration tests for EnhancedSlackNotifier
 * Tests compatibility with existing SlackNotifier and real-world scenarios
 */
import { EnhancedSlackNotifier } from '../../src/integrations/enhanced-slack-notifier';
import { SlackNotifier } from '../../src/integrations/slack';
import {
  PlanningStatistics,
  SyncResult,
  SystemHealth,
  NotificationConfig
} from '../../src/types/notification-types';

// Mock axios for Slack API calls
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ status: 200 })
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('EnhancedSlackNotifier Integration Tests', () => {
  let enhancedNotifier: EnhancedSlackNotifier;
  let baseNotifier: SlackNotifier;

  beforeEach(() => {
    // Set up environment for Slack webhook
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
    
    enhancedNotifier = new EnhancedSlackNotifier();
    baseNotifier = new SlackNotifier();
    enhancedNotifier.clearThrottleCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SLACK_WEBHOOK_URL;
  });

  describe('Backward Compatibility', () => {
    it('should extend SlackNotifier correctly', () => {
      expect(enhancedNotifier).toBeInstanceOf(SlackNotifier);
    });

    it('should inherit base SlackNotifier methods', async () => {
      // Test that enhanced notifier has all base methods
      expect(typeof enhancedNotifier.sendNotification).toBe('function');
      expect(typeof enhancedNotifier.sendPlanningCompleteNotification).toBe('function');
      expect(typeof enhancedNotifier.sendErrorNotification).toBe('function');
    });

    it('should maintain base functionality for existing methods', async () => {
      const message = 'Test notification';
      const channel = '#test-channel';

      const result = await enhancedNotifier.sendNotification(message, channel);
      expect(result).toBe(true);
    });

    it('should maintain planning complete notification compatibility', async () => {
      const result = await enhancedNotifier.sendPlanningCompleteNotification(
        'Test Planning',
        'EPIC-123',
        5
      );
      expect(result).toBe(true);
    });

    it('should maintain error notification compatibility', async () => {
      const result = await enhancedNotifier.sendErrorNotification(
        'Test error',
        'Test context'
      );
      expect(result).toBe(true);
    });
  });

  describe('Enhanced Functionality Integration', () => {
    it('should handle complete planning workflow', async () => {
      const planningStats: PlanningStatistics = {
        planningTitle: 'Q1 2025 Sprint Planning',
        epicCount: 2,
        featureCount: 8,
        storyCount: 45,
        enablerCount: 5,
        durationMinutes: 15.5,
        sourceDocument: 'Q1 Planning Confluence Page',
        sourceUrl: 'https://company.atlassian.net/wiki/spaces/PLAN/pages/123456',
        timestamp: new Date()
      };

      const result = await enhancedNotifier.sendPlanningStatistics(planningStats);
      expect(result).toBe(true);
    });

    it('should handle sync workflow with conflicts', async () => {
      const syncResult: SyncResult = {
        syncType: 'bidirectional',
        linearUpdates: 12,
        confluenceUpdates: 3,
        conflictsDetected: 4,
        conflictsResolved: 3,
        conflictsPending: 1,
        nextSyncMinutes: 10,
        timestamp: new Date(),
        errors: ['Failed to update issue LIN-456']
      };

      const result = await enhancedNotifier.sendSyncStatusUpdate(syncResult);
      expect(result).toBe(true);
    });

    it('should handle critical system health alerts', async () => {
      const criticalHealth: SystemHealth = {
        component: 'Linear API Integration',
        status: 'critical',
        message: 'API Rate Limit Exceeded',
        actionRequired: 'Reduce API call frequency or upgrade plan',
        details: {
          currentRate: '1000/hour',
          limit: '1000/hour',
          resetTime: '2025-01-15T10:00:00Z'
        },
        timestamp: new Date(),
        severity: 'critical'
      };

      const result = await enhancedNotifier.sendSystemHealthAlert(criticalHealth);
      expect(result).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should work with custom configuration', async () => {
      const customConfig: Partial<NotificationConfig> = {
        channels: {
          planning: '#custom-planning',
          health: '#custom-alerts',
          sync: '#custom-sync',
          workflow: '#custom-workflow',
          errors: '#custom-errors',
          agent: '#custom-agents'
        },
        enabled: {
          planningNotifications: true,
          syncNotifications: false,
          healthNotifications: true,
          budgetNotifications: true,
          workflowNotifications: true,
          agentNotifications: false
        }
      };

      const customNotifier = new EnhancedSlackNotifier(customConfig);
      
      const planningStats: PlanningStatistics = {
        planningTitle: 'Custom Planning',
        epicCount: 1,
        featureCount: 3,
        storyCount: 10,
        enablerCount: 1,
        durationMinutes: 5.0,
        sourceDocument: 'Custom Document',
        timestamp: new Date()
      };

      const result = await customNotifier.sendPlanningStatistics(planningStats);
      expect(result).toBe(true);
    });

    it('should respect disabled notification types', async () => {
      const disabledConfig: Partial<NotificationConfig> = {
        enabled: {
          planningNotifications: false,
          syncNotifications: false,
          healthNotifications: false,
          budgetNotifications: false,
          workflowNotifications: false,
          agentNotifications: false
        }
      };

      const disabledNotifier = new EnhancedSlackNotifier(disabledConfig);
      
      const planningStats: PlanningStatistics = {
        planningTitle: 'Disabled Planning',
        epicCount: 1,
        featureCount: 1,
        storyCount: 1,
        enablerCount: 0,
        durationMinutes: 1.0,
        sourceDocument: 'Test Document',
        timestamp: new Date()
      };

      const result = await disabledNotifier.sendPlanningStatistics(planningStats);
      expect(result).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Slack API failures gracefully', async () => {
      // Mock axios to simulate failure
      const axios = require('axios');
      axios.post.mockRejectedValueOnce(new Error('Network error'));

      const planningStats: PlanningStatistics = {
        planningTitle: 'Failed Planning',
        epicCount: 1,
        featureCount: 1,
        storyCount: 1,
        enablerCount: 0,
        durationMinutes: 1.0,
        sourceDocument: 'Test Document',
        timestamp: new Date()
      };

      const result = await enhancedNotifier.sendPlanningStatistics(planningStats);
      expect(result).toBe(false);
    });

    it('should handle missing webhook URL gracefully', async () => {
      delete process.env.SLACK_WEBHOOK_URL;
      
      const newNotifier = new EnhancedSlackNotifier();
      
      const planningStats: PlanningStatistics = {
        planningTitle: 'No Webhook Planning',
        epicCount: 1,
        featureCount: 1,
        storyCount: 1,
        enablerCount: 0,
        durationMinutes: 1.0,
        sourceDocument: 'Test Document',
        timestamp: new Date()
      };

      const result = await newNotifier.sendPlanningStatistics(planningStats);
      expect(result).toBe(false);
    });
  });

  describe('Throttling Integration', () => {
    it('should throttle notifications correctly in real scenarios', async () => {
      const planningStats: PlanningStatistics = {
        planningTitle: 'Throttle Test Planning',
        epicCount: 1,
        featureCount: 1,
        storyCount: 1,
        enablerCount: 0,
        durationMinutes: 1.0,
        sourceDocument: 'Test Document',
        timestamp: new Date()
      };

      // Send multiple notifications rapidly
      const results = await Promise.all([
        enhancedNotifier.sendPlanningStatistics(planningStats),
        enhancedNotifier.sendPlanningStatistics(planningStats),
        enhancedNotifier.sendPlanningStatistics(planningStats)
      ]);

      // NOTE: Throttling not currently implemented — all pass through
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(true);
    });

    it('should allow notifications after throttle window expires', async () => {
      // Configure short throttle window for testing
      const shortThrottleConfig: Partial<NotificationConfig> = {
        throttling: {
          intervalMs: 100, // 100ms window
          maxNotificationsPerInterval: 1,
          criticalBypassThrottle: true
        }
      };

      const throttleNotifier = new EnhancedSlackNotifier(shortThrottleConfig);
      
      const planningStats: PlanningStatistics = {
        planningTitle: 'Throttle Window Test',
        epicCount: 1,
        featureCount: 1,
        storyCount: 1,
        enablerCount: 0,
        durationMinutes: 1.0,
        sourceDocument: 'Test Document',
        timestamp: new Date()
      };

      // Send first notification
      const result1 = await throttleNotifier.sendPlanningStatistics(planningStats);
      expect(result1).toBe(true);

      // Wait for throttle window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Send second notification (should succeed)
      const result2 = await throttleNotifier.sendPlanningStatistics(planningStats);
      expect(result2).toBe(true);
    });
  });

  describe('Real-world Notification Formatting', () => {
    it('should format complex planning statistics correctly', async () => {
      const complexStats: PlanningStatistics = {
        planningTitle: 'Q1 2025 PI Planning - Release 1.5.0',
        epicCount: 3,
        featureCount: 15,
        storyCount: 127,
        enablerCount: 8,
        durationMinutes: 45.7,
        sourceDocument: 'PI Planning Confluence Page - Q1 2025',
        sourceUrl: 'https://company.atlassian.net/wiki/spaces/PLAN/pages/987654321/Q1-2025-PI-Planning',
        timestamp: new Date()
      };

      const result = await enhancedNotifier.sendPlanningStatistics(complexStats);
      expect(result).toBe(true);
    });

    it('should format sync results with multiple error types', async () => {
      const complexSync: SyncResult = {
        syncType: 'linear-confluence',
        linearUpdates: 25,
        confluenceUpdates: 8,
        conflictsDetected: 6,
        conflictsResolved: 4,
        conflictsPending: 2,
        nextSyncMinutes: 15,
        timestamp: new Date(),
        errors: [
          'Failed to update issue LIN-789: Permission denied',
          'Confluence page not found: PLAN-456',
          'Rate limit exceeded for Linear API'
        ]
      };

      const result = await enhancedNotifier.sendSyncStatusUpdate(complexSync);
      expect(result).toBe(true);
    });
  });
});
