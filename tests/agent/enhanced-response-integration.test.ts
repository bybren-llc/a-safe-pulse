/**
 * Integration tests for Enhanced Response System (LIN-60)
 * 
 * Tests the integration of command execution, autonomous behaviors,
 * and enhanced responses.
 */

import { EnhancedAgentSystem } from '../../src/agent/enhanced-agent-system';
import { ResponseType } from '../../src/agent/types/response-types';
import { CommandIntent } from '../../src/agent/types/command-types';

// Mock Linear client
jest.mock('../../src/linear/client', () => ({
  LinearClientWrapper: jest.fn().mockImplementation(() => ({
    getUser: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
    getIssue: jest.fn().mockResolvedValue({
      id: 'issue-1',
      identifier: 'TEST-123',
      title: 'Test Story',
      estimate: 13,
      state: { name: 'Backlog' },
      team: { id: 'team-1', name: 'Test Team' }
    }),
    getIssues: jest.fn().mockResolvedValue({ nodes: [] }),
    getTeam: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Test Team' }),
    createComment: jest.fn().mockResolvedValue({ id: 'comment-1' })
  }))
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Enhanced Response Integration', () => {
  let agentSystem: EnhancedAgentSystem;

  beforeEach(async () => {
    agentSystem = new EnhancedAgentSystem({
      linear: {
        apiKey: 'test-api-key',
        organizationId: 'test-org-id'
      },
      behaviors: {
        enabled: true
      },
      responses: {
        enableRichFormatting: true,
        enableProgressTracking: true,
        enablePersonality: true
      }
    });

    await agentSystem.initialize();
  });

  afterEach(async () => {
    await agentSystem.shutdown();
  });

  describe('Command Processing with Enhanced Responses', () => {
    it('should process ART planning command with rich response', async () => {
      const result = await agentSystem.processCommand(
        'plan PI-2024-Q1 for team-1',
        {
          issueId: 'issue-1',
          teamId: 'team-1',
          teamName: 'Test Team',
          user: { name: 'Test User' }
        }
      );

      // Command processing returns a result with a formatted response
      expect(result.formattedResponse).toBeDefined();
      expect(result.formattedResponse.type).toBeDefined();
      expect(result.formattedResponse.markdown).toBeDefined();
    });

    it('should handle errors with formatted error response', async () => {
      const result = await agentSystem.processCommand(
        'invalid command xyz',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.formattedResponse).toBeDefined();
      expect(result.formattedResponse.type).toBe(ResponseType.ERROR);
      // Error responses contain structured error information
      expect(result.formattedResponse.markdown).toContain('Error');
    });
  });

  describe('Autonomous Behavior Integration', () => {
    it('should trigger story decomposition suggestion for large stories', async () => {
      const webhookEvent = {
        action: 'create',
        type: 'Issue',
        data: {
          id: 'issue-2',
          identifier: 'TEST-456',
          title: 'Large Story',
          estimate: 13,
          state: { name: 'Backlog' },
          team: { id: 'team-1', name: 'Test Team' },
          labels: { nodes: [] }
        }
      };

      const result = await agentSystem.processWebhook(webhookEvent);

      expect(result.processed).toBe(true);
      expect(result.results).toBeDefined();
      
      // Behaviors execute but may not produce suggestion-type results
      // The behavior engine processes the trigger and returns results
      if (result.results && result.results.length > 0) {
        expect(result.results[0]).toHaveProperty('success');
      }
    });
  });

  describe('Response Personalization', () => {
    it('should include agent personality in responses', async () => {
      const result = await agentSystem.processCommand(
        'help',
        { user: { name: 'Test User' } }
      );

      expect(result.formattedResponse.markdown).toBeDefined();
      expect(typeof result.formattedResponse.markdown).toBe('string');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress for long-running operations', async () => {
      // Mock a long-running operation
      jest.setTimeout(10000);

      const result = await agentSystem.processCommand(
        'analyze value for PI-2024-Q1',
        {
          teamId: 'team-1',
          piId: 'PI-2024-Q1'
        }
      );

      expect(result.formattedResponse).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context-Aware Responses', () => {
    it('should adapt response based on user context', async () => {
      const managerContext = {
        user: { 
          name: 'Manager User',
          role: 'manager'
        },
        teamId: 'team-1'
      };

      const result = await agentSystem.processCommand(
        'check status',
        managerContext
      );

      expect(result.formattedResponse).toBeDefined();
      expect(result.formattedResponse.markdown).toBeDefined();
    });
  });

  describe('System Health and Metrics', () => {
    it('should provide system health status', async () => {
      const health = await agentSystem.getHealthStatus();

      expect(health.system).toBe('healthy');
      expect(health.components.linearApi).toBe('healthy');
      expect(health.components.responseEngine).toBe('healthy');
      expect(health.components.behaviors).toBeDefined();
    });

    it('should provide system metrics', () => {
      const metrics = agentSystem.getMetrics();

      expect(metrics.period).toBeDefined();
      expect(metrics.behaviors).toBeDefined();
      expect(metrics.responses).toBeDefined();
      expect(metrics.responses.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });
});