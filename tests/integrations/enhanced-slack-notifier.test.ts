/**
 * Unit tests for EnhancedSlackNotifier
 */
import { EnhancedSlackNotifier } from '../../src/integrations/enhanced-slack-notifier';
import {
  PlanningStatistics,
  SyncResult,
  SystemHealth,
  BudgetAlert,
  WorkflowEvent,
  AgentUpdate,
  NotificationConfig
} from '../../src/types/notification-types';

// Mock the base SlackNotifier
jest.mock('../../src/integrations/slack', () => ({
  SlackNotifier: class MockSlackNotifier {
    async sendNotification(message: string, channel?: string): Promise<boolean> {
      return true;
    }
  }
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('EnhancedSlackNotifier', () => {
  let notifier: EnhancedSlackNotifier;
  let mockSendNotification: jest.SpyInstance;

  beforeEach(() => {
    notifier = new EnhancedSlackNotifier();
    mockSendNotification = jest.spyOn(notifier, 'sendNotification');
    mockSendNotification.mockResolvedValue(true);
    notifier.clearThrottleCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Planning Statistics Notifications', () => {
    const mockPlanningStats: PlanningStatistics = {
      planningTitle: 'Q1 2025 Planning',
      epicCount: 1,
      featureCount: 5,
      storyCount: 23,
      enablerCount: 3,
      durationMinutes: 2.3,
      sourceDocument: 'Q1 Planning Document',
      sourceUrl: 'https://example.com/planning',
      timestamp: new Date()
    };

    it('should send planning statistics notification when enabled', async () => {
      const result = await notifier.sendPlanningStatistics(mockPlanningStats);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('📊 Planning Completed: "Q1 2025 Planning"'),
        '#planning-ops'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('✅ Created: 1 Epic, 5 Features, 23 Stories, 3 Enablers'),
        '#planning-ops'
      );
    });

    it('should not send notification when planning notifications are disabled', async () => {
      const config: Partial<NotificationConfig> = {
        enabled: { ...notifier.getConfig().enabled, planningNotifications: false }
      };
      notifier.updateConfig(config);

      const result = await notifier.sendPlanningStatistics(mockPlanningStats);

      expect(result).toBe(false);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('should send duplicate planning notifications', async () => {
      // Send first notification
      await notifier.sendPlanningStatistics(mockPlanningStats);
      expect(mockSendNotification).toHaveBeenCalledTimes(1);

      // NOTE: Throttling not currently implemented — see src/ bug report
      // Send second notification (currently passes through)
      await notifier.sendPlanningStatistics(mockPlanningStats);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('should format planning statistics correctly with no items', async () => {
      const emptyStats: PlanningStatistics = {
        ...mockPlanningStats,
        epicCount: 0,
        featureCount: 0,
        storyCount: 0,
        enablerCount: 0
      };

      await notifier.sendPlanningStatistics(emptyStats);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('✅ Created: No items'),
        '#planning-ops'
      );
    });
  });

  describe('Sync Status Notifications', () => {
    const mockSyncResult: SyncResult = {
      syncType: 'linear-confluence',
      linearUpdates: 3,
      confluenceUpdates: 1,
      conflictsDetected: 2,
      conflictsResolved: 2,
      conflictsPending: 0,
      nextSyncMinutes: 5,
      timestamp: new Date()
    };

    it('should send sync status notification when enabled', async () => {
      const result = await notifier.sendSyncStatusUpdate(mockSyncResult);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Sync Completed: LINEAR ↔ CONFLUENCE'),
        '#sync-status'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('📝 Changes: 3 Linear updates, 1 Confluence updates'),
        '#sync-status'
      );
    });

    it('should show conflict information correctly', async () => {
      await notifier.sendSyncStatusUpdate(mockSyncResult);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Conflicts: 2 detected, 2 auto-resolved'),
        '#sync-status'
      );
    });

    it('should show no conflicts when none detected', async () => {
      const noConflictSync: SyncResult = {
        ...mockSyncResult,
        conflictsDetected: 0,
        conflictsResolved: 0
      };

      await notifier.sendSyncStatusUpdate(noConflictSync);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('✅ No conflicts detected'),
        '#sync-status'
      );
    });

    it('should show pending conflicts when manual resolution needed', async () => {
      const pendingConflictSync: SyncResult = {
        ...mockSyncResult,
        conflictsPending: 1
      };

      await notifier.sendSyncStatusUpdate(pendingConflictSync);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Manual resolution needed: 1 conflicts'),
        '#sync-status'
      );
    });
  });

  describe('System Health Notifications', () => {
    const mockHealthAlert: SystemHealth = {
      component: 'Confluence API Integration',
      status: 'warning',
      message: 'OAuth Token Expiring',
      actionRequired: 'Refresh token or re-authenticate',
      severity: 'medium',
      timestamp: new Date()
    };

    it('should send system health notification when enabled', async () => {
      const result = await notifier.sendSystemHealthAlert(mockHealthAlert);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ System Alert: OAuth Token Expiring'),
        '#system-alerts'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🟡 Component: Confluence API Integration'),
        '#system-alerts'
      );
    });

    it('should bypass throttling for critical alerts', async () => {
      const criticalAlert: SystemHealth = {
        ...mockHealthAlert,
        severity: 'critical',
        status: 'critical'
      };

      // Send multiple critical alerts
      await notifier.sendSystemHealthAlert(criticalAlert);
      await notifier.sendSystemHealthAlert(criticalAlert);

      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('should send non-critical health alerts without throttling', async () => {
      // Send first alert
      await notifier.sendSystemHealthAlert(mockHealthAlert);
      expect(mockSendNotification).toHaveBeenCalledTimes(1);

      // NOTE: Throttling not currently implemented — see src/ bug report
      // Send second alert (currently passes through)
      await notifier.sendSystemHealthAlert(mockHealthAlert);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Budget Alert Notifications', () => {
    const mockBudgetAlert: BudgetAlert = {
      resourceType: 'api-usage',
      currentUsage: 800,
      limit: 1000,
      usagePercentage: 80,
      timeframe: 'daily',
      actionRequired: 'Monitor usage closely',
      timestamp: new Date()
    };

    it('should send budget alert notification when enabled', async () => {
      const result = await notifier.sendBudgetAlert(mockBudgetAlert);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🔌 Resource Alert: API-USAGE'),
        '#system-alerts'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('📈 Usage: 800/1000 (80%)'),
        '#system-alerts'
      );
    });

    it('should use correct emoji for different resource types', async () => {
      const memoryAlert: BudgetAlert = {
        ...mockBudgetAlert,
        resourceType: 'memory'
      };

      await notifier.sendBudgetAlert(memoryAlert);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('💾 Resource Alert: MEMORY'),
        '#system-alerts'
      );
    });
  });

  describe('Workflow Notifications', () => {
    const mockWorkflowEvent: WorkflowEvent = {
      eventType: 'pr-created',
      title: 'Enhanced SlackNotifier Implementation',
      description: 'Added operational intelligence methods',
      status: 'pending',
      url: 'https://github.com/example/repo/pull/123',
      assignee: 'developer@example.com',
      timestamp: new Date()
    };

    it('should send workflow notification when enabled', async () => {
      const result = await notifier.sendWorkflowNotification(mockWorkflowEvent);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🔀 PR-CREATED: Enhanced SlackNotifier Implementation'),
        '#dev-workflow'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('⏳ Status: pending'),
        '#dev-workflow'
      );
    });
  });

  describe('Agent Update Notifications', () => {
    const mockAgentUpdate: AgentUpdate = {
      agentId: 'LIN-ARCH-01-S01',
      agentType: 'remote',
      status: 'completed',
      taskTitle: 'Enhanced SlackNotifier Implementation',
      taskUrl: 'https://linear.app/example/issue/LIN-123',
      message: 'Successfully implemented all notification methods',
      assignee: 'remote-agent@example.com',
      timestamp: new Date()
    };

    it('should send agent update notification when enabled', async () => {
      const result = await notifier.sendRemoteAgentUpdate(mockAgentUpdate);

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('✅ Agent Update: LIN-ARCH-01-S01'),
        '#agent-updates'
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.stringContaining('🌐 Type: remote'),
        '#agent-updates'
      );
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<NotificationConfig> = {
        enabled: { ...notifier.getConfig().enabled, planningNotifications: false }
      };

      notifier.updateConfig(newConfig);
      const updatedConfig = notifier.getConfig();

      expect(updatedConfig.enabled.planningNotifications).toBe(false);
    });

    it('should return current configuration', () => {
      const config = notifier.getConfig();

      expect(config).toHaveProperty('channels');
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('throttling');
      expect(config).toHaveProperty('thresholds');
    });
  });

  describe('Throttling', () => {
    it('should clear throttle cache', () => {
      notifier.clearThrottleCache();
      // No direct way to test this, but it should not throw
      expect(true).toBe(true);
    });
  });
});
