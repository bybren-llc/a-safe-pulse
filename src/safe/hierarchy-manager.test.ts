import { SAFeHierarchyManager } from './hierarchy-manager';
import { LinearIssueFinder } from '../linear/issue-finder';
import { LinearIssueUpdater } from '../linear/issue-updater';
import { SAFeLinearImplementation } from './safe_linear_implementation';
import { PlanningDocument, Epic, Feature, Story, Enabler } from '../planning/models';
import { LinearClient, Issue } from '@linear/sdk';

// Mock the dependencies
jest.mock('@linear/sdk');
jest.mock('../linear/issue-finder');
jest.mock('../linear/issue-updater');
jest.mock('./safe_linear_implementation');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('SAFeHierarchyManager', () => {
  let hierarchyManager: SAFeHierarchyManager;
  let mockLinearClient: jest.Mocked<LinearClient>;
  let mockIssueFinder: jest.Mocked<LinearIssueFinder>;
  let mockIssueUpdater: jest.Mocked<LinearIssueUpdater>;
  let mockSafeImplementation: jest.Mocked<SAFeLinearImplementation>;

  const accessToken = 'test-token';
  const teamId = 'test-team-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLinearClient = new LinearClient({ accessToken }) as jest.Mocked<LinearClient>;
    mockIssueFinder = new LinearIssueFinder(accessToken, teamId) as jest.Mocked<LinearIssueFinder>;
    mockIssueUpdater = new LinearIssueUpdater(accessToken) as jest.Mocked<LinearIssueUpdater>;
    mockSafeImplementation = new SAFeLinearImplementation(accessToken) as jest.Mocked<SAFeLinearImplementation>;

    // Create the hierarchy manager
    hierarchyManager = new SAFeHierarchyManager(accessToken, teamId);
    
    // Replace the private properties with mocks
    (hierarchyManager as any).linearClient = mockLinearClient;
    (hierarchyManager as any).issueFinder = mockIssueFinder;
    (hierarchyManager as any).issueUpdater = mockIssueUpdater;
    (hierarchyManager as any).safeImplementation = mockSafeImplementation;
  });

  describe('updateHierarchy', () => {
    it('should update the SAFe hierarchy', async () => {
      // Create a spy for the methods that will be called
      const updateEpicFeatureSpy = jest.spyOn(hierarchyManager, 'updateEpicFeatureRelationships').mockResolvedValue();
      const updateFeatureStorySpy = jest.spyOn(hierarchyManager, 'updateFeatureStoryRelationships').mockResolvedValue();
      const updateFeatureEnablerSpy = jest.spyOn(hierarchyManager, 'updateFeatureEnablerRelationships').mockResolvedValue();

      // Create a planning document
      const planningDocument: PlanningDocument = {
        id: 'test-planning-document',
        title: 'Test Planning Document',
        epics: [],
        features: [],
        stories: [],
        enablers: []
      };

      // Create existing issues
      const existingIssues = {
        epics: {},
        features: {},
        stories: {},
        enablers: {}
      };

      // Call the method
      await hierarchyManager.updateHierarchy(planningDocument, existingIssues);

      // Verify that the methods were called
      expect(updateEpicFeatureSpy).toHaveBeenCalledWith(
        planningDocument.epics,
        planningDocument.features,
        existingIssues.epics,
        existingIssues.features
      );
      expect(updateFeatureStorySpy).toHaveBeenCalledWith(
        planningDocument.features,
        planningDocument.stories,
        existingIssues.features,
        existingIssues.stories
      );
      expect(updateFeatureEnablerSpy).toHaveBeenCalledWith(
        planningDocument.features,
        planningDocument.enablers,
        existingIssues.features,
        existingIssues.enablers
      );
    });
  });

  describe('updateEpicFeatureRelationships', () => {
    it('should update Epic-Feature relationships', async () => {
      // Create Epics and Features
      const epic1: Epic = { id: 'epic1', type: 'epic', title: 'Epic 1', description: 'Epic 1 description', features: [], attributes: {} };
      const epic2: Epic = { id: 'epic2', type: 'epic', title: 'Epic 2', description: 'Epic 2 description', features: [], attributes: {} };
      const feature1: Feature = { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', epicId: 'epic1', stories: [], enablers: [], attributes: {} };
      const feature2: Feature = { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', stories: [], enablers: [], attributes: {} };

      const epics = [epic1, epic2];
      const features = [feature1, feature2];

      // Create Linear issue IDs
      const epicIds = { epic1: 'linear-epic1', epic2: 'linear-epic2' };
      const featureIds = { feature1: 'linear-feature1', feature2: 'linear-feature2' };

      // Mock the Linear client issue method
      const mockFeature1 = { id: 'linear-feature1', parent: { id: 'linear-epic2' } };
      mockLinearClient.issue = jest.fn().mockResolvedValue(mockFeature1);

      // Call the method
      await hierarchyManager.updateEpicFeatureRelationships(epics, features, epicIds, featureIds);

      // Verify that the Linear client was called
      expect(mockLinearClient.issue).toHaveBeenCalledWith('linear-feature1');

      // Verify that the issue updater was called
      expect(mockIssueUpdater.updateParent).toHaveBeenCalledWith('linear-feature1', 'linear-epic1');
    });
  });

  describe('updateFeatureStoryRelationships', () => {
    it('should update Feature-Story relationships', async () => {
      // Create Features and Stories
      const feature1: Feature = { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', stories: [], enablers: [], attributes: {} };
      const feature2: Feature = { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', stories: [], enablers: [], attributes: {} };
      const story1: Story = { id: 'story1', type: 'story', title: 'Story 1', description: 'Story 1 description', featureId: 'feature1', acceptanceCriteria: [], attributes: {} };
      const story2: Story = { id: 'story2', type: 'story', title: 'Story 2', description: 'Story 2 description', acceptanceCriteria: [], attributes: {} };

      const features = [feature1, feature2];
      const stories = [story1, story2];

      // Create Linear issue IDs
      const featureIds = { feature1: 'linear-feature1', feature2: 'linear-feature2' };
      const storyIds = { story1: 'linear-story1', story2: 'linear-story2' };

      // Mock the Linear client issue method
      const mockStory1 = { id: 'linear-story1', parent: { id: 'linear-feature2' } };
      mockLinearClient.issue = jest.fn().mockResolvedValue(mockStory1);

      // Call the method
      await hierarchyManager.updateFeatureStoryRelationships(features, stories, featureIds, storyIds);

      // Verify that the Linear client was called
      expect(mockLinearClient.issue).toHaveBeenCalledWith('linear-story1');

      // Verify that the issue updater was called
      expect(mockIssueUpdater.updateParent).toHaveBeenCalledWith('linear-story1', 'linear-feature1');
    });
  });

  describe('updateFeatureEnablerRelationships', () => {
    it('should update Feature-Enabler relationships', async () => {
      // Create Features and Enablers
      const feature1: Feature = { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', enablers: [], stories: [], attributes: {} };
      const feature2: Feature = { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', enablers: [], stories: [], attributes: {} };
      const enabler1: Enabler = { id: 'enabler1', type: 'enabler', title: 'Enabler 1', description: 'Enabler 1 description', featureId: 'feature1', enablerType: 'architecture', attributes: {} };
      const enabler2: Enabler = { id: 'enabler2', type: 'enabler', title: 'Enabler 2', description: 'Enabler 2 description', enablerType: 'infrastructure', attributes: {} };

      const features = [feature1, feature2];
      const enablers = [enabler1, enabler2];

      // Create Linear issue IDs
      const featureIds = { feature1: 'linear-feature1', feature2: 'linear-feature2' };
      const enablerIds = { enabler1: 'linear-enabler1', enabler2: 'linear-enabler2' };

      // Mock the Linear client issue method
      const mockEnabler1 = { id: 'linear-enabler1', parent: { id: 'linear-feature2' } };
      mockLinearClient.issue = jest.fn().mockResolvedValue(mockEnabler1);

      // Call the method
      await hierarchyManager.updateFeatureEnablerRelationships(features, enablers, featureIds, enablerIds);

      // Verify that the Linear client was called
      expect(mockLinearClient.issue).toHaveBeenCalledWith('linear-enabler1');

      // Verify that the issue updater was called
      expect(mockIssueUpdater.updateParent).toHaveBeenCalledWith('linear-enabler1', 'linear-feature1');
    });
  });
});
