/**
 * Unit Tests for Story Scorer (LIN-50)
 * 
 * Comprehensive test suite for WSJF scoring and prioritization functionality.
 */

import { StoryScorer } from '../../src/safe/story-scorer';
import { WSJFCalculator } from '../../src/safe/wsjf-calculator';
import { PriorityUpdater } from '../../src/safe/priority-updater';
import {
  ScoredStory,
  LinearPriority,
  ScoringConfig
} from '../../src/types/scoring-types';
import { Story } from '../../src/planning/models';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Shared test data accessible to all describe blocks
const sampleStory: Story = {
    id: 'TEST-001',
    type: 'story',
    title: 'Implement user authentication and security features',
    description: 'Add secure login system with multi-factor authentication to improve user security and reduce risk of data breaches. This is a high-priority customer commitment for Q4 release.',
    storyPoints: 5,
    priority: 2,
    attributes: {},
    acceptanceCriteria: [
      'User can login with email and password',
      'Multi-factor authentication is required for admin users',
      'Session management works correctly',
      'Security audit trails are maintained'
    ]
  };

describe('StoryScorer', () => {
  let storyScorer: StoryScorer;

  beforeEach(() => {
    storyScorer = new StoryScorer();
  });

  describe('scoreStory', () => {
    it('should score a story with all WSJF components', async () => {
      const scoredStory = await storyScorer.scoreStory(sampleStory);

      expect(scoredStory).toMatchObject({
        id: 'TEST-001',
        title: expect.any(String),
        businessValue: expect.any(Number),
        timeCriticality: expect.any(Number),
        riskReduction: expect.any(Number),
        jobSize: expect.any(Number),
        wsjfScore: expect.any(Number),
        priorityScore: expect.any(Number),
        recommendedPriority: expect.any(Number),
        scoringTimestamp: expect.any(Date),
        scoringVersion: '1.0.0'
      });

      // Business value should be positive for security-related story
      expect(scoredStory.businessValue).toBeGreaterThan(0);
      expect(scoredStory.businessValue).toBeLessThanOrEqual(100);

      // Time criticality should be high due to "high-priority customer commitment"
      expect(scoredStory.timeCriticality).toBeGreaterThan(30);

      // Risk reduction should be high due to security keywords
      expect(scoredStory.riskReduction).toBeGreaterThan(35);

      // Job size should reflect story points
      expect(scoredStory.jobSize).toBeGreaterThanOrEqual(5);

      // WSJF score should be calculated
      expect(scoredStory.wsjfScore).toBeGreaterThan(0);
    });

    it('should handle story with minimal information', async () => {
      const minimalStory: Story = {
        id: 'TEST-002',
        type: 'story',
        title: 'Update documentation',
        description: '',
        storyPoints: 1,
        attributes: {},
        acceptanceCriteria: ['Documentation is updated']
      };

      const scoredStory = await storyScorer.scoreStory(minimalStory);

      expect(scoredStory.businessValue).toBeGreaterThan(0);
      expect(scoredStory.timeCriticality).toBeGreaterThan(0);
      expect(scoredStory.riskReduction).toBeGreaterThan(0);
      expect(scoredStory.jobSize).toBeGreaterThanOrEqual(1);
      expect(scoredStory.wsjfScore).toBeGreaterThan(0);
    });

    it('should assign appropriate priority based on WSJF score', async () => {
      // High-value, urgent story
      const urgentStory: Story = {
        id: 'TEST-003',
        type: 'story',
        title: 'Critical security vulnerability fix for customer deadline',
        description: 'Fix critical security vulnerability that affects all users. Customer commitment requires this for immediate release to meet regulatory compliance deadline.',
        storyPoints: 2,
        priority: 1,
        attributes: {},
        acceptanceCriteria: ['Security vulnerability is fixed', 'Regulatory compliance is met']
      };

      const scoredStory = await storyScorer.scoreStory(urgentStory);
      
      // Should be high priority due to security + customer commitment + regulatory
      expect(scoredStory.recommendedPriority).toBeLessThanOrEqual(LinearPriority.HIGH);
      expect(scoredStory.wsjfScore).toBeGreaterThan(4);
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCaseStory: Story = {
        id: 'TEST-004',
        type: 'story',
        title: '',
        description: '',
        storyPoints: 0,
        attributes: {},
        acceptanceCriteria: ['Edge case handled']
      };

      const scoredStory = await storyScorer.scoreStory(edgeCaseStory);

      expect(scoredStory.businessValue).toBeGreaterThanOrEqual(0);
      expect(scoredStory.timeCriticality).toBeGreaterThanOrEqual(0);
      expect(scoredStory.riskReduction).toBeGreaterThanOrEqual(0);
      expect(scoredStory.jobSize).toBeGreaterThan(0); // Should default to minimum
      expect(scoredStory.wsjfScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scoreStories', () => {
    it('should score multiple stories and return sorted results', async () => {
      const stories: Story[] = [
        {
          id: 'TEST-005',
          type: 'story',
          title: 'Low priority documentation update',
          description: 'Update some internal documentation',
          storyPoints: 8,
          priority: 4,
          attributes: {},
          acceptanceCriteria: ['Documentation is updated']
        },
        {
          id: 'TEST-006',
          type: 'story',
          title: 'Critical user-facing security enhancement',
          description: 'Implement critical security features for user protection with regulatory compliance requirements',
          storyPoints: 3,
          priority: 1,
          attributes: {},
          acceptanceCriteria: ['Security features are implemented', 'Regulatory compliance is met']
        },
        {
          id: 'TEST-007',
          type: 'story',
          title: 'Performance optimization for customer experience',
          description: 'Optimize application performance to improve user experience and business metrics',
          storyPoints: 5,
          priority: 2,
          attributes: {},
          acceptanceCriteria: ['Performance is optimized', 'User experience is improved']
        }
      ];

      const result = await storyScorer.scoreStories(stories);

      expect(result.scoredStories).toHaveLength(3);
      expect(result.summary.totalStories).toBe(3);
      expect(result.summary.averageWsjfScore).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);

      // Results should be sorted by WSJF score (highest first)
      const scores = result.scoredStories.map(s => s.wsjfScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i-1]).toBeGreaterThanOrEqual(scores[i]);
      }

      // Security story should score higher than documentation
      const securityStory = result.scoredStories.find(s => s.id === 'TEST-006');
      const docStory = result.scoredStories.find(s => s.id === 'TEST-005');
      
      expect(securityStory!.wsjfScore).toBeGreaterThan(docStory!.wsjfScore);
    });

    it('should generate priority updates for stories needing changes', async () => {
      const stories: Story[] = [
        {
          id: 'TEST-008',
          type: 'story',
          title: 'High-value quick win',
          description: 'Simple user experience improvement with high business value',
          storyPoints: 1,
          priority: 4, // Currently low, should be higher
          attributes: {},
          acceptanceCriteria: ['User experience is improved']
        }
      ];

      const result = await storyScorer.scoreStories(stories);

      expect(result.priorityUpdates).toHaveLength(1);
      expect(result.priorityUpdates[0].storyId).toBe('TEST-008');
      expect(result.priorityUpdates[0].recommendedPriority).toBeLessThan(4);
      expect(result.priorityUpdates[0].rationale).toContain('WSJF Score');
    });

    it('should generate optimization recommendations', async () => {
      const stories: Story[] = [
        // Quick win: high value, low effort
        {
          id: 'TEST-009',
          type: 'story',
          title: 'High-value user interface improvement',
          description: 'Simple UI enhancement with significant user experience impact',
          storyPoints: 2,
          priority: 3,
          attributes: {},
          acceptanceCriteria: ['UI is improved', 'User experience impact is significant']
        },
        // Large valuable story: should suggest splitting
        {
          id: 'TEST-010',
          type: 'story',
          title: 'Strategic security and compliance overhaul for user revenue growth',
          description: 'Critical system redesign for security vulnerability encryption authentication authorization. Regulatory compliance customer commitment promised milestone demo. Innovation competitive vision roadmap. Revenue cost efficiency automation process kpi metric. Refactor cleanup optimize performance maintainability.',
          storyPoints: 9,
          priority: 1,
          attributes: {},
          acceptanceCriteria: ['System is redesigned', 'Security compliance met', 'Customer demo ready']
        },
        // Low value, high effort: should suggest delaying
        {
          id: 'TEST-011',
          type: 'story',
          title: 'Complex internal tooling update',
          description: 'Update internal development tools',
          storyPoints: 8,
          priority: 4,
          attributes: {},
          acceptanceCriteria: ['Internal tools are updated']
        }
      ];

      const result = await storyScorer.scoreStories(stories);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const recommendationTypes = result.recommendations.map(r => r.recommendationType);
      expect(recommendationTypes).toContain('PRIORITIZE'); // For quick win
      expect(recommendationTypes).toContain('SPLIT'); // For large story
    });

    it('should handle empty story list', async () => {
      const result = await storyScorer.scoreStories([]);

      expect(result.scoredStories).toHaveLength(0);
      expect(result.priorityUpdates).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.summary.totalStories).toBe(0);
    });
  });

  describe('Business Value Calculation', () => {
    it('should score user-facing features higher', async () => {
      const userStory: Story = {
        id: 'TEST-012',
        type: 'story',
        title: 'Improve user interface and customer experience',
        description: 'Enhance the user interface to provide better customer experience and usability',
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['User interface is improved', 'Customer experience is enhanced']
      };

      const internalStory: Story = {
        id: 'TEST-013',
        type: 'story',
        title: 'Internal code refactoring',
        description: 'Refactor internal code structure',
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['Code is refactored', 'Structure is improved']
      };

      const userScoredStory = await storyScorer.scoreStory(userStory);
      const internalScoredStory = await storyScorer.scoreStory(internalStory);

      expect(userScoredStory.businessValue).toBeGreaterThan(internalScoredStory.businessValue);
    });

    it('should score business impact keywords appropriately', async () => {
      const businessStory: Story = {
        id: 'TEST-014',
        type: 'story',
        title: 'Revenue optimization and cost reduction automation',
        description: 'Implement automation to improve business efficiency and revenue metrics',
        storyPoints: 4,
        attributes: {},
        acceptanceCriteria: ['Revenue is optimized', 'Cost reduction is automated', 'Business efficiency is improved']
      };

      const scoredStory = await storyScorer.scoreStory(businessStory);

      expect(scoredStory.businessValue).toBeGreaterThan(30); // Should be meaningful due to business keywords
    });
  });

  describe('Time Criticality Calculation', () => {
    it('should score deadline-related stories higher', async () => {
      const urgentStory: Story = {
        id: 'TEST-015',
        type: 'story',
        title: 'Customer deadline feature for market launch',
        description: 'Critical feature needed for customer commitment and competitive market window',
        storyPoints: 3,
        priority: 1,
        attributes: {},
        acceptanceCriteria: ['Feature meets customer deadline', 'Market launch requirements are satisfied']
      };

      const regularStory: Story = {
        id: 'TEST-016',
        type: 'story',
        title: 'General improvement',
        description: 'General system improvement',
        storyPoints: 3,
        priority: 3,
        attributes: {},
        acceptanceCriteria: ['System is improved']
      };

      const urgentScoredStory = await storyScorer.scoreStory(urgentStory);
      const regularScoredStory = await storyScorer.scoreStory(regularStory);

      expect(urgentScoredStory.timeCriticality).toBeGreaterThan(regularScoredStory.timeCriticality);
    });

    it('should consider Linear priority in time criticality', async () => {
      const highPriorityStory: Story = {
        id: 'TEST-017',
        type: 'story',
        title: 'Feature implementation',
        description: 'Standard feature implementation',
        storyPoints: 3,
        priority: 1, // High priority
        attributes: {},
        acceptanceCriteria: ['Feature is implemented']
      };

      const lowPriorityStory: Story = {
        id: 'TEST-018',
        type: 'story',
        title: 'Feature implementation',
        description: 'Standard feature implementation',
        storyPoints: 3,
        priority: 4, // Low priority
        attributes: {},
        acceptanceCriteria: ['Feature is implemented']
      };

      const highScoredStory = await storyScorer.scoreStory(highPriorityStory);
      const lowScoredStory = await storyScorer.scoreStory(lowPriorityStory);

      expect(highScoredStory.timeCriticality).toBeGreaterThan(lowScoredStory.timeCriticality);
    });
  });

  describe('Risk Reduction Calculation', () => {
    it('should score security-related stories higher', async () => {
      const securityStory: Story = {
        id: 'TEST-019',
        type: 'story',
        title: 'Security vulnerability fix and authentication enhancement',
        description: 'Fix security vulnerabilities and improve authentication reliability',
        storyPoints: 4,
        attributes: {},
        acceptanceCriteria: ['Security vulnerabilities are fixed', 'Authentication is enhanced']
      };

      const featureStory: Story = {
        id: 'TEST-020',
        type: 'story',
        title: 'New feature addition',
        description: 'Add new user feature',
        storyPoints: 4,
        attributes: {},
        acceptanceCriteria: ['New feature is added']
      };

      const securityScoredStory = await storyScorer.scoreStory(securityStory);
      const featureScoredStory = await storyScorer.scoreStory(featureStory);

      expect(securityScoredStory.riskReduction).toBeGreaterThan(featureScoredStory.riskReduction);
    });
  });

  describe('Job Size Calculation', () => {
    it('should reflect story points in job size', async () => {
      const smallStory: Story = {
        id: 'TEST-021',
        type: 'story',
        title: 'Small task',
        description: 'Simple implementation',
        storyPoints: 1,
        attributes: {},
        acceptanceCriteria: ['Task is completed']
      };

      const largeStory: Story = {
        id: 'TEST-022',
        type: 'story',
        title: 'Large complex task',
        description: 'Complex implementation with multiple integrations',
        storyPoints: 8,
        attributes: {},
        acceptanceCriteria: ['Complex task is completed', 'Integrations are working']
      };

      const smallScoredStory = await storyScorer.scoreStory(smallStory);
      const largeScoredStory = await storyScorer.scoreStory(largeStory);

      expect(largeScoredStory.jobSize).toBeGreaterThan(smallScoredStory.jobSize);
    });

    it('should account for complexity in job size', async () => {
      const complexStory: Story = {
        id: 'TEST-023',
        type: 'story',
        title: 'Complex integration with unknown algorithm optimization',
        description: 'Complex system integration requiring research and investigation of unknown optimization algorithms',
        storyPoints: 5,
        attributes: {},
        acceptanceCriteria: ['Complex integration is completed', 'Algorithm optimization is researched']
      };

      const simpleStory: Story = {
        id: 'TEST-024',
        type: 'story',
        title: 'Simple update',
        description: 'Simple configuration update',
        storyPoints: 5,
        attributes: {},
        acceptanceCriteria: ['Configuration is updated']
      };

      const complexScoredStory = await storyScorer.scoreStory(complexStory);
      const simpleScoredStory = await storyScorer.scoreStory(simpleStory);

      expect(complexScoredStory.jobSize).toBeGreaterThan(simpleScoredStory.jobSize);
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom scoring configuration', async () => {
      const customConfig: Partial<ScoringConfig> = {
        weights: {
          businessValue: 0.5,
          timeCriticality: 0.3,
          riskReduction: 0.2
        },
        priorityMapping: {
          urgentThreshold: 10.0,
          highThreshold: 7.0,
          mediumThreshold: 4.0
        }
      };

      const customScorer = new StoryScorer(customConfig);
      const scoredStory = await customScorer.scoreStory(sampleStory);

      expect(scoredStory.scoringVersion).toBe('1.0.0');
      // The WSJF calculation should reflect the custom weights
      expect(scoredStory.wsjfScore).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle scoring errors gracefully', async () => {
      const invalidStory = null as unknown as Story;

      await expect(storyScorer.scoreStory(invalidStory)).rejects.toThrow(TypeError);
    });

    it('should continue scoring other stories when one fails', async () => {
      const stories = [
        sampleStory,
        null as unknown as Story, // This will cause an error
        {
          id: 'TEST-025',
          type: 'story' as const,
          title: 'Valid story',
          description: 'This should be scored successfully',
          storyPoints: 2,
          attributes: {},
          acceptanceCriteria: ['Story is valid']
        }
      ];

      // Should not throw, but should log errors for invalid stories
      const result = await storyScorer.scoreStories(stories.filter(Boolean));
      expect(result.scoredStories.length).toBeGreaterThan(0);
    });
  });
});

describe('WSJFCalculator', () => {
  let calculator: WSJFCalculator;
  let config: ScoringConfig;

  beforeEach(() => {
    config = {
      weights: {
        businessValue: 0.35,
        timeCriticality: 0.25,
        riskReduction: 0.25
      },
      priorityMapping: {
        urgentThreshold: 8.0,
        highThreshold: 5.0,
        mediumThreshold: 2.0
      },
      scoringVersion: '1.0.0'
    };
    calculator = new WSJFCalculator(config);
  });

  describe('calculateWSJF', () => {
    it('should calculate WSJF score correctly', () => {
      const businessValue = 80;
      const timeCriticality = 60;
      const riskReduction = 40;
      const jobSize = 5;

      const wsjf = calculator.calculateWSJF(businessValue, timeCriticality, riskReduction, jobSize);

      const expectedNumerator = (80 * 0.35) + (60 * 0.25) + (40 * 0.25);
      const expectedWSJF = expectedNumerator / 5;

      expect(wsjf).toBeCloseTo(expectedWSJF, 2);
    });

    it('should return 0 for invalid job size', () => {
      const wsjf = calculator.calculateWSJF(80, 60, 40, 0);
      expect(wsjf).toBe(0);
    });
  });

  describe('prioritizeStories', () => {
    it('should sort stories by WSJF score', () => {
      const stories: ScoredStory[] = [
        {
          ...sampleStory,
          id: 'LOW',
          priority: 4,
          wsjfScore: 2.0,
          businessValue: 40,
          timeCriticality: 30,
          riskReduction: 20,
          jobSize: 5,
          priorityScore: 20,
          recommendedPriority: LinearPriority.LOW,
          scoringTimestamp: new Date(),
          scoringVersion: '1.0.0'
        },
        {
          ...sampleStory,
          id: 'HIGH',
          priority: 1,
          wsjfScore: 8.0,
          businessValue: 80,
          timeCriticality: 70,
          riskReduction: 60,
          jobSize: 3,
          priorityScore: 80,
          recommendedPriority: LinearPriority.URGENT,
          scoringTimestamp: new Date(),
          scoringVersion: '1.0.0'
        },
        {
          ...sampleStory,
          id: 'MEDIUM',
          priority: 2,
          wsjfScore: 5.0,
          businessValue: 60,
          timeCriticality: 50,
          riskReduction: 40,
          jobSize: 4,
          priorityScore: 50,
          recommendedPriority: LinearPriority.HIGH,
          scoringTimestamp: new Date(),
          scoringVersion: '1.0.0'
        }
      ];

      const prioritized = calculator.prioritizeStories(stories);

      expect(prioritized[0].id).toBe('HIGH');
      expect(prioritized[1].id).toBe('MEDIUM');
      expect(prioritized[2].id).toBe('LOW');
    });
  });

  describe('generateOptimizationRecommendations', () => {
    it('should identify quick wins', () => {
      const stories: ScoredStory[] = [
        {
          ...sampleStory,
          id: 'QUICK-WIN',
          priority: 1,
          wsjfScore: 7.0,
          jobSize: 2,
          businessValue: 80,
          timeCriticality: 60,
          riskReduction: 50,
          priorityScore: 70,
          recommendedPriority: LinearPriority.HIGH,
          scoringTimestamp: new Date(),
          scoringVersion: '1.0.0'
        }
      ];

      const recommendations = calculator.generateOptimizationRecommendations(stories);

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          recommendationType: 'PRIORITIZE',
          affectedStories: ['QUICK-WIN']
        })
      );
    });

    it('should suggest splitting large valuable stories', () => {
      const stories: ScoredStory[] = [
        {
          ...sampleStory,
          id: 'LARGE-VALUABLE',
          priority: 2,
          wsjfScore: 6.0,
          jobSize: 10,
          businessValue: 90,
          timeCriticality: 70,
          riskReduction: 60,
          priorityScore: 60,
          recommendedPriority: LinearPriority.HIGH,
          scoringTimestamp: new Date(),
          scoringVersion: '1.0.0'
        }
      ];

      const recommendations = calculator.generateOptimizationRecommendations(stories);

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          recommendationType: 'SPLIT',
          affectedStories: ['LARGE-VALUABLE']
        })
      );
    });
  });
});