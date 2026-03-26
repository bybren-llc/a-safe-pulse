/**
 * Tests for Planning Agent Slack Integration
 * 
 * This test suite validates the enhanced PlanningAgent with Slack notifications
 */
import { PlanningAgent } from '../../src/agent/planning';
import { OperationalNotificationCoordinator } from '../../src/utils/operational-notification-coordinator';

// Mock dependencies
jest.mock('../../src/utils/operational-notification-coordinator');
jest.mock('../../src/integrations/confluence');
jest.mock('@linear/sdk');

describe('PlanningAgent Slack Integration', () => {
  let planningAgent: PlanningAgent;
  let mockCoordinator: jest.Mocked<OperationalNotificationCoordinator>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock OperationalNotificationCoordinator
    mockCoordinator = {
      notifyPlanningCompletion: jest.fn().mockResolvedValue(true),
      notifyWorkflowUpdate: jest.fn().mockResolvedValue(true),
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock the getInstance method
    (OperationalNotificationCoordinator.getInstance as jest.Mock).mockReturnValue(mockCoordinator);
    (OperationalNotificationCoordinator.createDefaultConfig as jest.Mock).mockReturnValue({
      environment: 'development',
      healthMonitoring: { enabled: true }
    });

    // Create PlanningAgent instance
    planningAgent = new PlanningAgent('test-token');
  });

  describe('Planning Start Notifications', () => {
    it('should send planning start notification', async () => {
      // Access private method for testing
      const sendPlanningStartNotification = (planningAgent as any).sendPlanningStartNotification;
      
      await sendPlanningStartNotification.call(planningAgent, 'Test Planning', 'https://confluence.example.com/page');

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'build',
        'Planning Started: Test Planning',
        'Planning process initiated for "Test Planning"',
        'in-progress',
        'https://confluence.example.com/page'
      );
    });

    it('should handle notification failures gracefully', async () => {
      // Mock notification failure
      mockCoordinator.notifyWorkflowUpdate.mockRejectedValue(new Error('Notification failed'));

      const sendPlanningStartNotification = (planningAgent as any).sendPlanningStartNotification;
      
      // Should not throw even if notification fails
      await expect(
        sendPlanningStartNotification.call(planningAgent, 'Test Planning', 'https://confluence.example.com/page')
      ).resolves.not.toThrow();
    });
  });

  describe('Planning Completion Notifications', () => {
    it('should send planning completion notification with statistics', async () => {
      const statistics = {
        planningTitle: 'Test Planning',
        confluencePageUrl: 'https://confluence.example.com/page',
        duration: 5.5,
        epicCount: 2,
        featureCount: 8,
        storyCount: 25,
        enablerCount: 3,
        sourceDocument: 'Test Document'
      };

      const sendPlanningCompletionNotification = (planningAgent as any).sendPlanningCompletionNotification;
      
      await sendPlanningCompletionNotification.call(planningAgent, statistics);

      expect(mockCoordinator.notifyPlanningCompletion).toHaveBeenCalledWith(
        'Test Planning',
        2, // epicCount
        8, // featureCount
        25, // storyCount
        3, // enablerCount
        5.5, // duration
        'Test Document',
        'https://confluence.example.com/page'
      );
    });

    it('should handle completion notification failures gracefully', async () => {
      mockCoordinator.notifyPlanningCompletion.mockRejectedValue(new Error('Notification failed'));

      const statistics = {
        planningTitle: 'Test Planning',
        confluencePageUrl: 'https://confluence.example.com/page',
        duration: 5.5,
        epicCount: 2,
        featureCount: 8,
        storyCount: 25,
        enablerCount: 3,
        sourceDocument: 'Test Document'
      };

      const sendPlanningCompletionNotification = (planningAgent as any).sendPlanningCompletionNotification;
      
      await expect(
        sendPlanningCompletionNotification.call(planningAgent, statistics)
      ).resolves.not.toThrow();
    });
  });

  describe('Planning Failure Notifications', () => {
    it('should send planning failure notification with error details', async () => {
      const error = new Error('Test planning error');
      
      const sendPlanningFailureNotification = (planningAgent as any).sendPlanningFailureNotification;
      
      await sendPlanningFailureNotification.call(
        planningAgent, 
        error, 
        'Test Planning', 
        'https://confluence.example.com/page'
      );

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'build',
        'Planning Failed: Test Planning',
        'Planning process failed: Test planning error',
        'failure',
        'https://confluence.example.com/page'
      );
    });

    it('should handle failure notification errors gracefully', async () => {
      mockCoordinator.notifyWorkflowUpdate.mockRejectedValue(new Error('Notification failed'));
      
      const error = new Error('Test planning error');
      const sendPlanningFailureNotification = (planningAgent as any).sendPlanningFailureNotification;
      
      await expect(
        sendPlanningFailureNotification.call(
          planningAgent, 
          error, 
          'Test Planning', 
          'https://confluence.example.com/page'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('PI Creation Notifications', () => {
    it('should send PI creation start notification', async () => {
      const sendPIPlanningStartNotification = (planningAgent as any).sendPIPlanningStartNotification;
      
      await sendPIPlanningStartNotification.call(planningAgent, 'https://confluence.example.com/pi-page');

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'build',
        'PI Planning Started',
        'Program Increment planning process initiated',
        'in-progress',
        'https://confluence.example.com/pi-page'
      );
    });

    it('should send PI creation completion notification', async () => {
      const statistics = {
        piName: 'PI 2025.1',
        confluencePageUrl: 'https://confluence.example.com/pi-page',
        duration: 12.3,
        featureCount: 15,
        objectiveCount: 8,
        riskCount: 3,
        sourceDocument: 'PI Planning Document'
      };

      const sendPICreationCompletionNotification = (planningAgent as any).sendPICreationCompletionNotification;
      
      await sendPICreationCompletionNotification.call(planningAgent, statistics);

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'deployment',
        'PI Created: PI 2025.1',
        'Program Increment "PI 2025.1" created successfully with 15 features, 8 objectives, and 3 risks. Duration: 12.3 minutes.',
        'success',
        'https://confluence.example.com/pi-page'
      );
    });

    it('should send PI creation failure notification', async () => {
      const error = new Error('PI creation failed');
      
      const sendPICreationFailureNotification = (planningAgent as any).sendPICreationFailureNotification;
      
      await sendPICreationFailureNotification.call(
        planningAgent, 
        error, 
        'https://confluence.example.com/pi-page'
      );

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'deployment',
        'PI Creation Failed',
        'Program Increment creation failed: PI creation failed',
        'failure',
        'https://confluence.example.com/pi-page'
      );
    });
  });

  describe('Statistics Collection', () => {
    it('should collect planning statistics correctly', async () => {
      const startTime = Date.now() - 300000; // 5 minutes ago
      
      const collectPlanningStatistics = (planningAgent as any).collectPlanningStatistics;
      
      const statistics = collectPlanningStatistics.call(
        planningAgent,
        'Test Planning',
        'https://confluence.example.com/page',
        startTime,
        'Test Document',
        1, // epicCount
        5, // featureCount
        20, // storyCount
        2  // enablerCount
      );

      expect(statistics).toEqual({
        planningTitle: 'Test Planning',
        confluencePageUrl: 'https://confluence.example.com/page',
        duration: expect.any(Number),
        epicCount: 1,
        featureCount: 5,
        storyCount: 20,
        enablerCount: 2,
        sourceDocument: 'Test Document'
      });

      // Duration should be approximately 5 minutes
      expect(statistics.duration).toBeGreaterThan(4.5);
      expect(statistics.duration).toBeLessThan(5.5);
    });

    it('should collect PI creation statistics correctly', async () => {
      const startTime = Date.now() - 600000; // 10 minutes ago
      
      const collectPICreationStatistics = (planningAgent as any).collectPICreationStatistics;
      
      const statistics = collectPICreationStatistics.call(
        planningAgent,
        'PI 2025.1',
        'https://confluence.example.com/pi-page',
        startTime,
        'PI Planning Document',
        12, // featureCount
        6,  // objectiveCount
        4   // riskCount
      );

      expect(statistics).toEqual({
        piName: 'PI 2025.1',
        confluencePageUrl: 'https://confluence.example.com/pi-page',
        duration: expect.any(Number),
        featureCount: 12,
        objectiveCount: 6,
        riskCount: 4,
        sourceDocument: 'PI Planning Document'
      });

      // Duration should be approximately 10 minutes
      expect(statistics.duration).toBeGreaterThan(9.5);
      expect(statistics.duration).toBeLessThan(10.5);
    });
  });

  describe('Error Handling', () => {
    it('should not throw when notification coordinator fails', async () => {
      // Mock all notification methods to fail
      mockCoordinator.notifyPlanningCompletion.mockRejectedValue(new Error('Coordinator failed'));
      mockCoordinator.notifyWorkflowUpdate.mockRejectedValue(new Error('Coordinator failed'));

      const sendPlanningStartNotification = (planningAgent as any).sendPlanningStartNotification;
      const sendPlanningCompletionNotification = (planningAgent as any).sendPlanningCompletionNotification;
      const sendPlanningFailureNotification = (planningAgent as any).sendPlanningFailureNotification;

      // All notification methods should handle failures gracefully
      await expect(
        sendPlanningStartNotification.call(planningAgent, 'Test', 'https://example.com')
      ).resolves.not.toThrow();

      await expect(
        sendPlanningCompletionNotification.call(planningAgent, {
          planningTitle: 'Test',
          confluencePageUrl: 'https://example.com',
          duration: 1,
          epicCount: 1,
          featureCount: 1,
          storyCount: 1,
          enablerCount: 1,
          sourceDocument: 'Test'
        })
      ).resolves.not.toThrow();

      await expect(
        sendPlanningFailureNotification.call(planningAgent, new Error('Test'), 'Test', 'https://example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('Integration with OperationalNotificationCoordinator', () => {
    it('should initialize coordinator with correct configuration', () => {
      // PlanningAgent passes NODE_ENV or defaults to 'test' in test environment
      expect(OperationalNotificationCoordinator.createDefaultConfig).toHaveBeenCalledWith(
        expect.stringMatching(/^(development|test)$/)
      );
      expect(OperationalNotificationCoordinator.getInstance).toHaveBeenCalledWith({
        environment: 'development',
        healthMonitoring: { enabled: true }
      });
    });

    it('should use coordinator singleton pattern', () => {
      // Create another instance
      const anotherAgent = new PlanningAgent('another-token');

      // Should use the same coordinator instance
      expect(OperationalNotificationCoordinator.getInstance).toHaveBeenCalledTimes(2);
    });
  });

  describe('Notification Content Validation', () => {
    it('should format planning start notification correctly', async () => {
      const sendPlanningStartNotification = (planningAgent as any).sendPlanningStartNotification;

      await sendPlanningStartNotification.call(planningAgent, 'Q1 2025 Planning', 'https://confluence.example.com/q1-planning');

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'build',
        'Planning Started: Q1 2025 Planning',
        'Planning process initiated for "Q1 2025 Planning"',
        'in-progress',
        'https://confluence.example.com/q1-planning'
      );
    });

    it('should format PI creation notification with detailed metrics', async () => {
      const statistics = {
        piName: 'PI 2025.Q1',
        confluencePageUrl: 'https://confluence.example.com/pi-2025-q1',
        duration: 15.75,
        featureCount: 20,
        objectiveCount: 12,
        riskCount: 5,
        sourceDocument: 'Q1 PI Planning Document'
      };

      const sendPICreationCompletionNotification = (planningAgent as any).sendPICreationCompletionNotification;

      await sendPICreationCompletionNotification.call(planningAgent, statistics);

      expect(mockCoordinator.notifyWorkflowUpdate).toHaveBeenCalledWith(
        'deployment',
        'PI Created: PI 2025.Q1',
        'Program Increment "PI 2025.Q1" created successfully with 20 features, 12 objectives, and 5 risks. Duration: 15.8 minutes.',
        'success',
        'https://confluence.example.com/pi-2025-q1'
      );
    });
  });

  describe('Duration Calculation Accuracy', () => {
    it('should calculate duration accurately for short operations', () => {
      const startTime = Date.now() - 30000; // 30 seconds ago

      const collectPlanningStatistics = (planningAgent as any).collectPlanningStatistics;

      const statistics = collectPlanningStatistics.call(
        planningAgent,
        'Quick Test',
        'https://example.com',
        startTime,
        'Test Doc',
        1, 1, 1, 1
      );

      // Should be approximately 0.5 minutes
      expect(statistics.duration).toBeGreaterThan(0.4);
      expect(statistics.duration).toBeLessThan(0.6);
    });

    it('should calculate duration accurately for long operations', () => {
      const startTime = Date.now() - 1800000; // 30 minutes ago

      const collectPICreationStatistics = (planningAgent as any).collectPICreationStatistics;

      const statistics = collectPICreationStatistics.call(
        planningAgent,
        'Long PI',
        'https://example.com',
        startTime,
        'Long Doc',
        10, 5, 2
      );

      // Should be approximately 30 minutes
      expect(statistics.duration).toBeGreaterThan(29.5);
      expect(statistics.duration).toBeLessThan(30.5);
    });
  });
});
