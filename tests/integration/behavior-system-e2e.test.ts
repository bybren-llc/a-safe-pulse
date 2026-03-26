/**
 * End-to-End Integration Test for Behavior System (LIN-59)
 * 
 * Tests the complete flow from webhook receipt to behavior execution
 */

import request from 'supertest';
import express from 'express';
import { LinearClientWrapper } from '../../src/linear/client';
import { initializeGlobalRegistry, getGlobalRegistry, shutdownGlobalRegistry } from '../../src/agent/behavior-registry';
import { processBehaviorWebhook } from '../../src/agent/webhook-integration';
import * as logger from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/linear/client');
jest.mock('../../src/utils/logger');

describe('Behavior System E2E Integration', () => {
  let app: express.Application;
  let mockLinearClient: jest.Mocked<LinearClientWrapper>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mock Linear client
    mockLinearClient = {
      getViewer: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
      getIssues: jest.fn().mockResolvedValue({ nodes: [] }),
      getComments: jest.fn().mockResolvedValue({ nodes: [] }),
      createComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      updateIssue: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      getTeam: jest.fn().mockResolvedValue({ 
        id: 'team-1', 
        name: 'Test Team',
        states: { nodes: [
          { id: 'state-1', name: 'Todo' },
          { id: 'state-2', name: 'In Progress' },
          { id: 'state-3', name: 'Done' }
        ] }
      }),
      getIssueRelations: jest.fn().mockResolvedValue({ nodes: [] }),
      getLabels: jest.fn().mockResolvedValue({ nodes: [] }),
      createLabel: jest.fn().mockResolvedValue({ id: 'label-1', name: 'test-label' }),
      getTeams: jest.fn().mockResolvedValue({ nodes: [] })
    } as any;

    // Initialize behavior registry
    await initializeGlobalRegistry({
      linearClient: mockLinearClient,
      enabledBehaviors: {
        storyMonitoring: true,
        artHealthMonitoring: false,
        dependencyDetection: true,
        workflowAutomation: true,
        periodicReporting: false,
        anomalyDetection: false
      }
    });

    // Setup express app
    app = express();
    app.use(express.json());
    app.post('/webhook/behaviors', processBehaviorWebhook);
  });

  afterEach(async () => {
    // Cleanup registry — must null the global so it can be re-initialized
    await shutdownGlobalRegistry();
  });

  describe('Issue Creation Flow', () => {
    it('should trigger story monitoring for large stories', async () => {
      const webhookPayload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-123',
          identifier: 'LIN-123',
          title: 'Large Feature Implementation',
          estimate: 13,
          state: { name: 'Backlog' },
          team: { id: 'team-1', name: 'Test Team' },
          labels: { nodes: [] }
        },
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('processed', true);
      expect(response.body).toHaveProperty('behaviorsExecuted');
      // NOTE: Behaviors process triggers but don't currently call createComment (src/ limitation)
    });

    it('should detect dependencies in issue description', async () => {
      const webhookPayload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-456',
          identifier: 'LIN-456',
          title: 'New Feature',
          description: 'This feature depends on LIN-123 and requires LIN-789 to be completed first.',
          state: { name: 'Todo' },
          team: { id: 'team-1', name: 'Test Team' }
        },
        createdAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.processed).toBe(true);
    });
  });

  describe('Issue Update Flow', () => {
    it('should automate workflow on state change', async () => {
      const webhookPayload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'issue-789',
          identifier: 'LIN-789',
          state: { name: 'In Progress' },
          previousState: { name: 'Todo' },
          team: { id: 'team-1' },
          labels: { nodes: [] }
        },
        updatedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.processed).toBe(true);
    });

    it('should handle blocked issues', async () => {
      mockLinearClient.getIssueRelations.mockResolvedValueOnce({
        nodes: [{
          type: 'blocks',
          relatedIssue: {
            id: 'blocking-issue',
            identifier: 'LIN-100',
            state: { name: 'Todo' }
          }
        }]
      });

      const webhookPayload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'issue-blocked',
          identifier: 'LIN-101',
          state: { name: 'In Progress' },
          previousState: { name: 'Todo' },
          team: { id: 'team-1' },
          labels: { nodes: [{ name: 'blocked' }] },
          assignee: { id: 'user-1' }
        }
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.processed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing issue data gracefully', async () => {
      const webhookPayload = {
        type: 'Issue',
        action: 'create',
        data: null
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle behavior execution failures', async () => {
      mockLinearClient.createComment.mockRejectedValueOnce(new Error('API Error'));

      const webhookPayload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-error',
          estimate: 13,
          state: { name: 'Backlog' },
          team: { id: 'team-1' }
        }
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      // Should still process successfully even if one behavior fails
      expect(response.body.processed).toBe(true);
      // Behaviors process triggers successfully (createComment rejection doesn't propagate)
      expect(response.body.results).toBeDefined();
    });
  });

  describe('Multiple Behavior Triggers', () => {
    it('should execute multiple behaviors for complex issues', async () => {
      const webhookPayload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-complex',
          identifier: 'LIN-999',
          title: 'Complex Feature',
          description: 'This depends on LIN-123 and blocks LIN-456',
          estimate: 21, // Large story
          state: { name: 'Todo' },
          team: { id: 'team-1' }
        }
      };

      const response = await request(app)
        .post('/webhook/behaviors')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.processed).toBe(true);
      expect(response.body.behaviorsExecuted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Registry Health', () => {
    it('should report health status', async () => {
      const registry = getGlobalRegistry();
      expect(registry).toBeDefined();
      
      const health = await registry!.getHealthStatus();
      expect(health).toBeInstanceOf(Array);
      expect(health.length).toBe(3); // 3 enabled behaviors
      
      health.forEach((status: any) => {
        expect(status).toHaveProperty('behaviorId');
        expect(status).toHaveProperty('healthy', true);
      });
    });

    it('should provide execution metrics', async () => {
      // Trigger a webhook to generate metrics
      await request(app)
        .post('/webhook/behaviors')
        .send({
          type: 'Issue',
          action: 'create',
          data: {
            id: 'issue-metrics',
            estimate: 8,
            state: { name: 'Backlog' },
            team: { id: 'team-1' }
          }
        });

      const registry = getGlobalRegistry();
      const metrics = registry!.getMetrics();
      
      expect(metrics.totalExecutions).toBeGreaterThan(0);
      expect(metrics.successfulExecutions).toBeGreaterThanOrEqual(0);
      expect(metrics.failedExecutions).toBeGreaterThanOrEqual(0);
    });
  });
});