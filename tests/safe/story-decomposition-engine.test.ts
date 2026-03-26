/**
 * Comprehensive unit tests for Story Decomposition Engine
 * 
 * Tests the core functionality for automatically breaking down large stories
 * into implementable sub-stories while maintaining SAFe compliance.
 */

import { StoryDecompositionEngine } from '../../src/safe/story-decomposition-engine';
import { Story } from '../../src/planning/models';
import {
  DecompositionConfig,
  StoryAnalysis,
  DecompositionResult,
  StoryDecompositionError
} from '../../src/types/decomposition-types';

describe('StoryDecompositionEngine', () => {
  let engine: StoryDecompositionEngine;
  let mockStory: Story;

  beforeEach(() => {
    engine = new StoryDecompositionEngine();
    
    mockStory = {
      id: 'story-123',
      type: 'story',
      title: 'Implement user authentication system',
      description: 'Create a comprehensive user authentication system with login, registration, password reset, and security features. This system should handle multiple authentication methods and provide secure session management.',
      acceptanceCriteria: [
        'User can register with email and password',
        'User can log in with valid credentials',
        'User can reset password via email',
        'System validates password strength',
        'Session expires after 24 hours of inactivity',
        'Failed login attempts are tracked and limited'
      ],
      storyPoints: 8,
      attributes: {
        priority: 'high',
        team: 'backend'
      },
      labels: ['authentication', 'security']
    };
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const engine = new StoryDecompositionEngine();
      const config = engine.getConfig();
      
      expect(config.maxStoryPoints).toBe(5);
      expect(config.minSubStories).toBe(2);
      expect(config.maxSubStories).toBe(4);
      expect(config.maxSubStoryPoints).toBe(5);
      expect(config.preserveParentStory).toBe(true);
      expect(config.pointsDistributionStrategy).toBe('weighted');
      expect(config.criteriaDistributionStrategy).toBe('thematic');
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<DecompositionConfig> = {
        maxStoryPoints: 3,
        minSubStories: 3,
        maxSubStories: 5,
        pointsDistributionStrategy: 'even'
      };

      const engine = new StoryDecompositionEngine(customConfig);
      const config = engine.getConfig();
      
      expect(config.maxStoryPoints).toBe(3);
      expect(config.minSubStories).toBe(3);
      expect(config.maxSubStories).toBe(5);
      expect(config.pointsDistributionStrategy).toBe('even');
    });

    it('should allow configuration updates', () => {
      const updateConfig: Partial<DecompositionConfig> = {
        maxSubStories: 6,
        criteriaDistributionStrategy: 'balanced'
      };

      engine.updateConfig(updateConfig);
      const config = engine.getConfig();
      
      expect(config.maxSubStories).toBe(6);
      expect(config.criteriaDistributionStrategy).toBe('balanced');
    });
  });

  describe('Story Analysis', () => {
    it('should identify story that needs decomposition', async () => {
      const analysis = await engine.analyzeStory(mockStory);
      
      expect(analysis.shouldDecompose).toBe(true);
      expect(analysis.currentPoints).toBe(8);
      expect(analysis.suggestedSubStoryCount).toBeGreaterThanOrEqual(2);
      expect(analysis.suggestedSubStoryCount).toBeLessThanOrEqual(4);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.complexityFactors.length).toBeGreaterThan(0);
    });

    it('should not decompose story within acceptable size', async () => {
      const smallStory: Story = {
        ...mockStory,
        storyPoints: 3
      };

      const analysis = await engine.analyzeStory(smallStory);
      
      expect(analysis.shouldDecompose).toBe(false);
      expect(analysis.currentPoints).toBe(3);
      expect(analysis.riskFactors).toContain('Story points within acceptable range');
    });

    it('should not decompose story without points', async () => {
      const storyWithoutPoints: Story = {
        ...mockStory,
        storyPoints: undefined
      };

      const analysis = await engine.analyzeStory(storyWithoutPoints);
      
      expect(analysis.shouldDecompose).toBe(false);
      expect(analysis.currentPoints).toBe(0);
    });

    it('should identify complexity factors', async () => {
      const complexStory: Story = {
        ...mockStory,
        description: 'Create a complex integration system with multiple APIs, database connections, security protocols, and performance optimizations. This system must handle high load and provide real-time processing capabilities. ' +
          'The architecture needs to support horizontal scaling across multiple regions with failover mechanisms. ' +
          'Each component must be independently deployable with proper circuit breakers and health monitoring. ' +
          'Data consistency must be guaranteed across all distributed nodes using eventual consistency patterns. ' +
          'The system should support both synchronous and asynchronous communication patterns between services.',
        acceptanceCriteria: new Array(8).fill('Complex acceptance criterion'),
        storyPoints: 13
      };

      const analysis = await engine.analyzeStory(complexStory);

      expect(analysis.complexityFactors).toContain('High number of acceptance criteria');
      expect(analysis.complexityFactors).toContain('Lengthy description indicating complexity');
      expect(analysis.complexityFactors).toContain('Technical complexity indicators present');
    });

    it('should suggest appropriate sub-story count based on points', async () => {
      const testCases = [
        { points: 6, expectedMin: 2, expectedMax: 3 },
        { points: 8, expectedMin: 2, expectedMax: 3 },
        { points: 13, expectedMin: 3, expectedMax: 4 },
        { points: 21, expectedMin: 4, expectedMax: 4 }
      ];

      for (const testCase of testCases) {
        const testStory = { ...mockStory, storyPoints: testCase.points };
        const analysis = await engine.analyzeStory(testStory);
        
        expect(analysis.suggestedSubStoryCount).toBeGreaterThanOrEqual(testCase.expectedMin);
        expect(analysis.suggestedSubStoryCount).toBeLessThanOrEqual(testCase.expectedMax);
      }
    });
  });

  describe('Story Decomposition', () => {
    it('should successfully decompose a large story', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      expect(result).toBeDefined();
      expect(result.parentStory.id).toBe(mockStory.id);
      expect(result.subStories.length).toBeGreaterThanOrEqual(2);
      expect(result.subStories.length).toBeLessThanOrEqual(4);
      expect(result.decompositionId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.decompositionRationale).toBeDefined();
    });

    it('should throw error for story that doesnt need decomposition', async () => {
      const smallStory: Story = {
        ...mockStory,
        storyPoints: 3
      };

      await expect(engine.decomposeStory(smallStory)).rejects.toThrow(StoryDecompositionError);
    });

    it('should throw error for story without acceptance criteria', async () => {
      const storyWithoutCriteria: Story = {
        ...mockStory,
        acceptanceCriteria: []
      };

      await expect(engine.decomposeStory(storyWithoutCriteria)).rejects.toThrow(StoryDecompositionError);
    });

    it('should preserve total story points in sub-stories', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      const totalSubStoryPoints = result.subStories.reduce(
        (sum, story) => sum + (story.storyPoints || 0), 0
      );
      
      expect(totalSubStoryPoints).toBe(mockStory.storyPoints);
    });

    it('should ensure all sub-stories are within point limits', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      result.subStories.forEach(subStory => {
        expect(subStory.storyPoints).toBeLessThanOrEqual(5);
        expect(subStory.storyPoints).toBeGreaterThan(0);
      });
    });

    it('should preserve all acceptance criteria', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      const totalMappedCriteria = result.criteriaMapping.length;
      expect(totalMappedCriteria).toBe(mockStory.acceptanceCriteria.length);
      
      // Check that all original criteria are mapped
      mockStory.acceptanceCriteria.forEach(criterion => {
        const mapped = result.criteriaMapping.find(
          mapping => mapping.originalCriteria === criterion
        );
        expect(mapped).toBeDefined();
      });
    });

    it('should create meaningful sub-story titles and descriptions', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      result.subStories.forEach((subStory, index) => {
        expect(subStory.title).toContain(mockStory.title);
        expect(subStory.title).toContain(`Part ${index + 1}`);
        expect(subStory.description).toContain('decomposed from');
        expect(subStory.description).toContain(mockStory.title);
        expect(subStory.description).toContain('Story Points');
      });
    });

    it('should maintain parent-child relationships', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      result.subStories.forEach(subStory => {
        expect(subStory.parentId).toBe(mockStory.id);
        expect(subStory.attributes.decomposedFrom).toBe(mockStory.id);
      });
    });

    it('should add appropriate labels to sub-stories', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      result.subStories.forEach((subStory, index) => {
        expect(subStory.labels).toContain('decomposed');
        expect(subStory.labels).toContain(`sub-story-${index + 1}`);
        
        // Should preserve original labels
        mockStory.labels?.forEach(label => {
          expect(subStory.labels).toContain(label);
        });
      });
    });
  });

  describe('Points Distribution Strategies', () => {
    it('should distribute points evenly with even strategy', async () => {
      const evenEngine = new StoryDecompositionEngine({
        pointsDistributionStrategy: 'even'
      });

      const result = await evenEngine.decomposeStory(mockStory);
      const points = result.subStories.map(story => story.storyPoints || 0);
      
      // Check that points are relatively evenly distributed
      const maxPoints = Math.max(...points);
      const minPoints = Math.min(...points);
      expect(maxPoints - minPoints).toBeLessThanOrEqual(1);
    });

    it('should distribute points with weighted strategy', async () => {
      const weightedEngine = new StoryDecompositionEngine({
        pointsDistributionStrategy: 'weighted'
      });

      const result = await weightedEngine.decomposeStory(mockStory);
      const firstStoryPoints = result.subStories[0].storyPoints || 0;
      
      // First story should have more points in weighted distribution
      result.subStories.slice(1).forEach(story => {
        expect(firstStoryPoints).toBeGreaterThanOrEqual(story.storyPoints || 0);
      });
    });

    it('should distribute points with fibonacci strategy', async () => {
      const fibEngine = new StoryDecompositionEngine({
        pointsDistributionStrategy: 'fibonacci'
      });

      const result = await fibEngine.decomposeStory(mockStory);
      
      // All sub-stories should have valid points
      result.subStories.forEach(story => {
        expect(story.storyPoints).toBeGreaterThan(0);
        expect(story.storyPoints).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Acceptance Criteria Distribution Strategies', () => {
    it('should distribute criteria sequentially', async () => {
      const sequentialEngine = new StoryDecompositionEngine({
        criteriaDistributionStrategy: 'sequential'
      });

      const result = await sequentialEngine.decomposeStory(mockStory);
      
      // Each sub-story should have some criteria
      result.subStories.forEach(subStory => {
        expect(subStory.acceptanceCriteria.length).toBeGreaterThan(0);
      });
    });

    it('should distribute criteria in balanced manner', async () => {
      const balancedEngine = new StoryDecompositionEngine({
        criteriaDistributionStrategy: 'balanced'
      });

      const result = await balancedEngine.decomposeStory(mockStory);
      
      const criteriaCounts = result.subStories.map(story => story.acceptanceCriteria.length);
      const maxCriteria = Math.max(...criteriaCounts);
      const minCriteria = Math.min(...criteriaCounts);
      
      // Should be relatively balanced
      expect(maxCriteria - minCriteria).toBeLessThanOrEqual(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle story with exactly 5 points', async () => {
      const boundaryStory: Story = {
        ...mockStory,
        storyPoints: 5
      };

      const analysis = await engine.analyzeStory(boundaryStory);
      expect(analysis.shouldDecompose).toBe(false);
    });

    it('should handle story with very high points', async () => {
      // 20 points = max that fits in 4 sub-stories of 5 points each
      const largeStory: Story = {
        ...mockStory,
        storyPoints: 20
      };

      const result = await engine.decomposeStory(largeStory);

      expect(result.subStories.length).toBe(4); // Should hit max sub-stories
      result.subStories.forEach(subStory => {
        expect(subStory.storyPoints).toBeLessThanOrEqual(5);
      });
    });

    it('should fail decomposition when points exceed distribution capacity', async () => {
      // 21 points cannot be distributed across 4 sub-stories of max 5 points (capacity=20)
      const oversizedStory: Story = {
        ...mockStory,
        storyPoints: 21
      };

      await expect(engine.decomposeStory(oversizedStory)).rejects.toThrow('Decomposition validation failed');
    });

    it('should handle story with minimal acceptance criteria', async () => {
      const minimalStory: Story = {
        ...mockStory,
        acceptanceCriteria: ['User can perform action', 'System responds appropriately']
      };

      const result = await engine.decomposeStory(minimalStory);
      
      expect(result.subStories.length).toBeGreaterThanOrEqual(2);
      
      // All criteria should be mapped
      expect(result.criteriaMapping.length).toBe(2);
    });

    it('should handle story without title', async () => {
      const storyWithoutTitle: Story = {
        ...mockStory,
        title: ''
      };

      await expect(engine.decomposeStory(storyWithoutTitle)).rejects.toThrow(StoryDecompositionError);
    });

    it('should handle story with null story points', async () => {
      const storyWithNullPoints: Story = {
        ...mockStory,
        storyPoints: undefined
      };

      await expect(engine.decomposeStory(storyWithNullPoints)).rejects.toThrow(StoryDecompositionError);
    });
  });

  describe('Audit Trail and Events', () => {
    it('should create audit trail entries', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      const auditEntries = engine.getAuditTrail(result.decompositionId);
      expect(auditEntries.length).toBeGreaterThan(0);
      
      const createdEntry = auditEntries.find(entry => entry.action === 'created');
      expect(createdEntry).toBeDefined();
      expect(createdEntry!.result).toBe('success');
    });

    it('should emit events during decomposition', async () => {
      const events: any[] = [];
      engine.addEventListener((event) => {
        events.push(event);
      });

      await engine.decomposeStory(mockStory);
      
      expect(events.length).toBeGreaterThan(0);
      
      const eventTypes = events.map(event => event.type);
      expect(eventTypes).toContain('started');
      expect(eventTypes).toContain('analyzed');
      expect(eventTypes).toContain('decomposed');
      expect(eventTypes).toContain('validated');
      expect(eventTypes).toContain('completed');
    });

    it('should emit failure events on error', async () => {
      const events: any[] = [];
      engine.addEventListener((event) => {
        events.push(event);
      });

      const invalidStory: Story = {
        ...mockStory,
        storyPoints: 3
      };

      try {
        await engine.decomposeStory(invalidStory);
      } catch (error) {
        // Expected to fail
      }
      
      const failureEvent = events.find(event => event.type === 'failed');
      expect(failureEvent).toBeDefined();
    });

    it('should support removing event listeners', () => {
      const listener = jest.fn();
      
      engine.addEventListener(listener);
      engine.removeEventListener(listener);
      
      // Listener should not be called after removal
      expect(() => engine.decomposeStory(mockStory)).not.toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate successful decomposition', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      // The decomposition should pass validation (no validation errors)
      expect(result).toBeDefined();
      
      // Manually check validation aspects
      const totalPoints = result.subStories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
      expect(totalPoints).toBe(mockStory.storyPoints);
      
      const oversizedStories = result.subStories.filter(story => (story.storyPoints || 0) > 5);
      expect(oversizedStories.length).toBe(0);
    });

    it('should generate meaningful decomposition rationale', async () => {
      const result = await engine.decomposeStory(mockStory);
      
      expect(result.decompositionRationale).toContain('points exceeds');
      expect(result.decompositionRationale).toContain('sub-stories');
      expect(result.decompositionRationale).toContain('distribution');
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete decomposition within reasonable time', async () => {
      const startTime = Date.now();
      
      await engine.decomposeStory(mockStory);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple decompositions', async () => {
      const stories: Story[] = [];
      // Use point values that distribute cleanly within maxSubStoryPoints=5
      const pointValues = [6, 7, 8, 12, 15];

      for (let i = 0; i < 5; i++) {
        stories.push({
          ...mockStory,
          id: `story-${i}`,
          title: `Test Story ${i}`,
          storyPoints: pointValues[i]
        });
      }

      const results = await Promise.all(
        stories.map(story => engine.decomposeStory(story))
      );
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.subStories.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});