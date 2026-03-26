/**
 * Tests for Story Decomposition API Adapter
 * 
 * Validates that the adapter correctly bridges between the LIN-47 implementation
 * and the interface expected by Phase 2 agents.
 */

import { DecompositionAPIAdapter, createDecompositionAPI } from '../../src/safe/decomposition-api-adapter';
import { StoryDecompositionEngine } from '../../src/safe/story-decomposition-engine';
import { 
  LargeStory, 
  DecomposedStory, 
  ValidationResult, 
  BusinessValue 
} from '../../src/types/decomposition-api-types';
import { DecompositionResult } from '../../src/types/decomposition-types';
import { Story } from '../../src/planning/models';

// Mock the logger to avoid console noise during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('DecompositionAPIAdapter', () => {
  let adapter: DecompositionAPIAdapter;
  let mockEngine: jest.Mocked<StoryDecompositionEngine>;

  const sampleLargeStory: LargeStory = {
    id: 'story-123',
    type: 'story',
    title: 'Implement user authentication system',
    description: 'Create a comprehensive user authentication system with login, registration, and password reset functionality',
    estimate: 8,
    priority: 1,
    storyPoints: 8,
    attributes: {},
    acceptanceCriteria: [
      'Users can register with email',
      'Users can login with credentials',
      'Users can reset forgotten passwords'
    ]
  };

  const sampleDecompositionResult: DecompositionResult = {
    parentStory: sampleLargeStory,
    subStories: [
      {
        id: 'story-123-1',
        type: 'story',
        title: 'User Registration',
        description: 'Implement user registration functionality',
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['Users can register with email']
      },
      {
        id: 'story-123-2',
        type: 'story',
        title: 'User Login',
        description: 'Implement user login functionality',
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['Users can login with credentials']
      },
      {
        id: 'story-123-3',
        type: 'story',
        title: 'Password Reset',
        description: 'Implement password reset functionality',
        storyPoints: 2,
        attributes: {},
        acceptanceCriteria: ['Users can reset forgotten passwords']
      }
    ],
    decompositionRationale: 'Split by authentication functionality',
    pointsDistribution: [3, 3, 2],
    criteriaMapping: [],
    decompositionId: 'decomp-456',
    timestamp: new Date()
  };

  beforeEach(() => {
    // Create a mock engine
    mockEngine = {
      decomposeStory: jest.fn(),
      analyzeStory: jest.fn(),
    } as any;

    adapter = new DecompositionAPIAdapter(mockEngine);
  });

  describe('decomposeStory', () => {
    it('should successfully decompose a large story', async () => {
      // Arrange
      mockEngine.decomposeStory.mockResolvedValue(sampleDecompositionResult);

      // Act
      const result = await adapter.decomposeStory(sampleLargeStory);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 'story-123-1',
        title: 'User Registration',
        parentStoryId: 'story-123',
        decompositionIndex: 0,
        originalStoryPoints: 8,
        businessValuePortion: 3/8
      });
      
      expect(mockEngine.decomposeStory).toHaveBeenCalledWith({
        ...sampleLargeStory,
        storyPoints: 8
      });
    });

    it('should reject stories that do not need decomposition', async () => {
      // Arrange
      const smallStory: LargeStory = { ...sampleLargeStory, estimate: 3 };

      // Act & Assert
      await expect(adapter.decomposeStory(smallStory))
        .rejects
        .toThrow('Story story-123 has 3 points, no decomposition needed');
      
      expect(mockEngine.decomposeStory).not.toHaveBeenCalled();
    });

    it('should handle engine errors gracefully', async () => {
      // Arrange
      mockEngine.decomposeStory.mockRejectedValue(new Error('Engine failure'));

      // Act & Assert
      await expect(adapter.decomposeStory(sampleLargeStory))
        .rejects
        .toThrow('Engine failure');
    });

    it('should calculate business value portions correctly', async () => {
      // Arrange
      mockEngine.decomposeStory.mockResolvedValue(sampleDecompositionResult);

      // Act
      const result = await adapter.decomposeStory(sampleLargeStory);

      // Assert
      const totalValuePortion = result.reduce((sum, story) => sum + story.businessValuePortion, 0);
      expect(totalValuePortion).toBeCloseTo(1.0, 2);
      expect(result[0].businessValuePortion).toBe(3/8); // 3 points out of 8
      expect(result[1].businessValuePortion).toBe(3/8); // 3 points out of 8
      expect(result[2].businessValuePortion).toBe(2/8); // 2 points out of 8
    });
  });

  describe('validateDecomposition', () => {
    const sampleDecomposedStories: DecomposedStory[] = [
      {
        id: 'story-123-1',
        type: 'story',
        title: 'User Registration',
        description: 'User registration functionality',
        parentStoryId: 'story-123',
        decompositionIndex: 0,
        originalStoryPoints: 8,
        businessValuePortion: 0.375,
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['Users can register with email']
      },
      {
        id: 'story-123-2',
        type: 'story',
        title: 'User Login',
        description: 'User login functionality',
        parentStoryId: 'story-123',
        decompositionIndex: 1,
        originalStoryPoints: 8,
        businessValuePortion: 0.375,
        storyPoints: 3,
        attributes: {},
        acceptanceCriteria: ['Users can login with credentials']
      },
      {
        id: 'story-123-3',
        type: 'story',
        title: 'Password Reset',
        description: 'Password reset functionality',
        parentStoryId: 'story-123',
        decompositionIndex: 2,
        originalStoryPoints: 8,
        businessValuePortion: 0.25,
        storyPoints: 2,
        attributes: {},
        acceptanceCriteria: ['Users can reset forgotten passwords']
      }
    ];

    it('should validate correct decomposition', async () => {
      // Act
      const result = await adapter.validateDecomposition(sampleDecomposedStories);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metrics).toMatchObject({
        totalPoints: 8,
        averagePoints: 8/3,
        storyCount: 3,
        businessValuePreserved: true
      });
    });

    it('should detect empty decomposition', async () => {
      // Act
      const result = await adapter.validateDecomposition([]);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        code: 'EMPTY_DECOMPOSITION',
        message: 'Decomposition cannot be empty'
      });
    });

    it('should detect stories that are too large', async () => {
      // Arrange
      const invalidStories = sampleDecomposedStories.map(s => ({ ...s }));
      invalidStories[0].storyPoints = 8; // Too large

      // Act
      const result = await adapter.validateDecomposition(invalidStories);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        code: 'STORY_TOO_LARGE',
        message: 'Story story-123-1 has 8 points (max 5)',
        storyId: 'story-123-1'
      });
    });

    it('should detect multiple parent stories', async () => {
      // Arrange
      const invalidStories = sampleDecomposedStories.map(s => ({ ...s }));
      invalidStories[1].parentStoryId = 'different-parent';

      // Act
      const result = await adapter.validateDecomposition(invalidStories);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        code: 'MULTIPLE_PARENTS',
        message: 'All decomposed stories must have the same parent'
      });
    });

    it('should warn about points mismatch', async () => {
      // Arrange
      const invalidStories = sampleDecomposedStories.map(s => ({ ...s }));
      invalidStories[0].storyPoints = 5; // Total now 10 instead of 8

      // Act
      const result = await adapter.validateDecomposition(invalidStories);

      // Assert
      expect(result.isValid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings).toContainEqual({
        code: 'POINTS_MISMATCH',
        message: 'Total points (10) doesn\'t match original (8)'
      });
    });

    it('should warn about business value distribution imbalance', async () => {
      // Arrange
      const invalidStories = sampleDecomposedStories.map(s => ({ ...s }));
      invalidStories[0].businessValuePortion = 0.9; // Total now > 1.0

      // Act
      const result = await adapter.validateDecomposition(invalidStories);

      // Assert
      expect(result.warnings.some(w => w.code === 'VALUE_DISTRIBUTION_IMBALANCE')).toBe(true);
      expect(result.metrics.businessValuePreserved).toBe(false);
    });
  });

  describe('getBusinessValueMapping', () => {
    const sampleStory: Story = {
      id: 'story-456',
      type: 'story',
      title: 'Improve user interface performance',
      description: 'Optimize UI rendering to improve user experience and reduce customer complaints',
      storyPoints: 5,
      priority: 1,
      attributes: {},
      acceptanceCriteria: ['UI performance is improved', 'User experience is enhanced']
    };

    it('should calculate business value mapping', async () => {
      // Act
      const result = await adapter.getBusinessValueMapping(sampleStory);

      // Assert
      expect(result.storyId).toBe('story-456');
      expect(result.totalValue).toBeGreaterThan(0);
      expect(result.valueComponents).toHaveProperty('userImpact');
      expect(result.valueComponents).toHaveProperty('businessImpact');
      expect(result.valueComponents).toHaveProperty('technicalDebt');
      expect(result.valueComponents).toHaveProperty('riskReduction');
      expect(result.wsjfScore).toBe(result.totalValue / 5);
    });

    it('should boost value for user-facing stories', async () => {
      // Arrange
      const userStory = { ...sampleStory, title: 'User interface improvements' };
      const nonUserStory = { ...sampleStory, title: 'Database optimization' };

      // Act
      const userResult = await adapter.getBusinessValueMapping(userStory);
      const nonUserResult = await adapter.getBusinessValueMapping(nonUserStory);

      // Assert
      expect(userResult.valueComponents.userImpact)
        .toBeGreaterThan(nonUserResult.valueComponents.userImpact);
    });

    it('should handle stories without story points', async () => {
      // Arrange
      const storyWithoutPoints = { ...sampleStory, storyPoints: undefined };

      // Act
      const result = await adapter.getBusinessValueMapping(storyWithoutPoints);

      // Assert
      expect(result.wsjfScore).toBeUndefined();
      expect(result.totalValue).toBeGreaterThan(0);
    });
  });

  describe('createDecompositionAPI factory', () => {
    it('should create an adapter instance', () => {
      // Act
      const api = createDecompositionAPI();

      // Assert
      expect(api).toBeInstanceOf(DecompositionAPIAdapter);
    });

    it('should accept a custom engine', () => {
      // Act
      const api = createDecompositionAPI(mockEngine);

      // Assert
      expect(api).toBeInstanceOf(DecompositionAPIAdapter);
    });
  });

  describe('Integration scenarios', () => {
    it('should support Phase 2 agent workflow', async () => {
      // Arrange - Simulate what a Phase 2 agent would do
      mockEngine.decomposeStory.mockResolvedValue(sampleDecompositionResult);
      
      // Act - Phase 2 agent workflow
      const decomposed = await adapter.decomposeStory(sampleLargeStory);
      const validation = await adapter.validateDecomposition(decomposed);
      const businessValue = await adapter.getBusinessValueMapping(sampleLargeStory);

      // Assert - All operations should succeed
      expect(decomposed).toHaveLength(3);
      expect(validation.isValid).toBe(true);
      expect(businessValue.storyId).toBe(sampleLargeStory.id);
      
      // Assert - Data consistency
      expect(decomposed.every(s => s.parentStoryId === sampleLargeStory.id)).toBe(true);
      expect(validation.metrics.storyCount).toBe(decomposed.length);
    });
  });
});