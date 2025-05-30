import { HierarchySynchronizer } from './hierarchy-synchronizer';
import { SAFeHierarchyManager } from './hierarchy-manager';
import { HierarchyValidator } from './hierarchy-validator';
import { LinearIssueFinder } from '../linear/issue-finder';
import { LinearIssueCreator } from '../linear/issue-creator';
import { LinearIssueUpdater } from '../linear/issue-updater';
import { ConflictResolver } from './conflict-resolver';
import { PlanningDocument, Epic, Feature, Story, Enabler } from '../planning/models';
import { LinearClient, Issue } from '@linear/sdk';

// Mock the dependencies
jest.mock('./hierarchy-manager');
jest.mock('./hierarchy-validator');
jest.mock('../linear/issue-finder');
jest.mock('../linear/issue-creator');
jest.mock('../linear/issue-updater');
jest.mock('./conflict-resolver');
jest.mock('@linear/sdk');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('HierarchySynchronizer', () => {
  let synchronizer: HierarchySynchronizer;
  let mockHierarchyManager: jest.Mocked<SAFeHierarchyManager>;
  let mockHierarchyValidator: jest.Mocked<HierarchyValidator>;
  let mockIssueFinder: jest.Mocked<LinearIssueFinder>;
  let mockIssueCreator: jest.Mocked<LinearIssueCreator>;
  let mockIssueUpdater: jest.Mocked<LinearIssueUpdater>;
  let mockConflictResolver: jest.Mocked<ConflictResolver>;
  let mockLinearClient: jest.Mocked<LinearClient>;

  const accessToken = 'test-token';
  const teamId = 'test-team-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockHierarchyManager = new SAFeHierarchyManager(accessToken, teamId) as jest.Mocked<SAFeHierarchyManager>;
    mockHierarchyValidator = new HierarchyValidator() as jest.Mocked<HierarchyValidator>;
    mockIssueFinder = new LinearIssueFinder(accessToken, teamId) as jest.Mocked<LinearIssueFinder>;
    mockIssueCreator = new LinearIssueCreator(accessToken, teamId) as jest.Mocked<LinearIssueCreator>;
    mockIssueUpdater = new LinearIssueUpdater(accessToken) as jest.Mocked<LinearIssueUpdater>;
    mockConflictResolver = new ConflictResolver() as jest.Mocked<ConflictResolver>;
    mockLinearClient = new LinearClient({ accessToken }) as jest.Mocked<LinearClient>;

    // Create the synchronizer
    synchronizer = new HierarchySynchronizer(accessToken, teamId);
    
    // Replace the private properties with mocks
    (synchronizer as any).hierarchyManager = mockHierarchyManager;
    (synchronizer as any).hierarchyValidator = mockHierarchyValidator;
    (synchronizer as any).issueFinder = mockIssueFinder;
    (synchronizer as any).issueCreator = mockIssueCreator;
    (synchronizer as any).issueUpdater = mockIssueUpdater;
    (synchronizer as any).conflictResolver = mockConflictResolver;
    (synchronizer as any).linearClient = mockLinearClient;
  });

  describe('synchronizeHierarchy', () => {
    it('should synchronize the SAFe hierarchy', async () => {
      // Create a planning document
      const planningDocument: PlanningDocument = {
        id: 'test-planning-document',
        title: 'Test Planning Document',
        epics: [
          { id: 'epic1', type: 'epic', title: 'Epic 1', description: 'Epic 1 description', features: [], attributes: {} },
          { id: 'epic2', type: 'epic', title: 'Epic 2', description: 'Epic 2 description', features: [], attributes: {} }
        ],
        features: [
          { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', epicId: 'epic1', stories: [], enablers: [], attributes: {} },
          { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', epicId: 'epic2', stories: [], enablers: [], attributes: {} }
        ],
        stories: [
          { id: 'story1', type: 'story', title: 'Story 1', description: 'Story 1 description', featureId: 'feature1', acceptanceCriteria: [], attributes: {} },
          { id: 'story2', type: 'story', title: 'Story 2', description: 'Story 2 description', featureId: 'feature2', acceptanceCriteria: [], attributes: {} }
        ],
        enablers: [
          { id: 'enabler1', type: 'enabler', title: 'Enabler 1', description: 'Enabler 1 description', featureId: 'feature1', enablerType: 'architecture', attributes: {} },
          { id: 'enabler2', type: 'enabler', title: 'Enabler 2', description: 'Enabler 2 description', featureId: 'feature2', enablerType: 'infrastructure', attributes: {} }
        ]
      };

      // Create existing issues
      const existingIssues = {
        epics: { epic1: 'linear-epic1' },
        features: { feature1: 'linear-feature1' },
        stories: { story1: 'linear-story1' },
        enablers: { enabler1: 'linear-enabler1' }
      };

      // Mock the validation result
      mockHierarchyValidator.validateHierarchy.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      // Mock the findAddedItems method
      const findAddedItemsSpy = jest.spyOn(synchronizer as any, 'findAddedItems').mockResolvedValue({
        epics: [planningDocument.epics?.[1]],
        features: [planningDocument.features?.[1]],
        stories: [planningDocument.stories?.[1]],
        enablers: [planningDocument.enablers?.[1]]
      });

      // Mock the findRemovedItems method
      const findRemovedItemsSpy = jest.spyOn(synchronizer as any, 'findRemovedItems').mockResolvedValue({
        epics: [],
        features: [],
        stories: [],
        enablers: []
      });

      // Mock the findModifiedItems method
      const findModifiedItemsSpy = jest.spyOn(synchronizer as any, 'findModifiedItems').mockResolvedValue({
        epics: [{ id: 'linear-epic1', epic: planningDocument.epics?.[0] }],
        features: [{ id: 'linear-feature1', feature: planningDocument.features?.[0] }],
        stories: [{ id: 'linear-story1', story: planningDocument.stories?.[0] }],
        enablers: [{ id: 'linear-enabler1', enabler: planningDocument.enablers?.[0] }]
      });

      // Mock the createNewItems method
      const createNewItemsSpy = jest.spyOn(synchronizer as any, 'createNewItems').mockResolvedValue({
        epics: { epic2: 'linear-epic2' },
        features: { feature2: 'linear-feature2' },
        stories: { story2: 'linear-story2' },
        enablers: { enabler2: 'linear-enabler2' }
      });

      // Mock the updateModifiedItems method
      const updateModifiedItemsSpy = jest.spyOn(synchronizer as any, 'updateModifiedItems').mockResolvedValue(undefined);

      // Call the method
      const result = await synchronizer.synchronizeHierarchy(planningDocument, existingIssues);

      // Verify that the methods were called
      expect(mockHierarchyValidator.validateHierarchy).toHaveBeenCalledWith(planningDocument);
      expect(findAddedItemsSpy).toHaveBeenCalledWith(planningDocument, existingIssues);
      expect(findRemovedItemsSpy).toHaveBeenCalledWith(planningDocument, existingIssues);
      expect(findModifiedItemsSpy).toHaveBeenCalledWith(planningDocument, existingIssues);
      expect(createNewItemsSpy).toHaveBeenCalledWith({
        epics: [planningDocument.epics?.[1]],
        features: [planningDocument.features?.[1]],
        stories: [planningDocument.stories?.[1]],
        enablers: [planningDocument.enablers?.[1]]
      });
      expect(updateModifiedItemsSpy).toHaveBeenCalledWith({
        epics: [{ id: 'linear-epic1', epic: planningDocument.epics?.[0] }],
        features: [{ id: 'linear-feature1', feature: planningDocument.features?.[0] }],
        stories: [{ id: 'linear-story1', story: planningDocument.stories?.[0] }],
        enablers: [{ id: 'linear-enabler1', enabler: planningDocument.enablers?.[0] }]
      });
      expect(mockHierarchyManager.updateHierarchy).toHaveBeenCalledWith(planningDocument, {
        epics: { epic1: 'linear-epic1', epic2: 'linear-epic2' },
        features: { feature1: 'linear-feature1', feature2: 'linear-feature2' },
        stories: { story1: 'linear-story1', story2: 'linear-story2' },
        enablers: { enabler1: 'linear-enabler1', enabler2: 'linear-enabler2' }
      });

      // Verify the result
      expect(result).toEqual({
        epics: { epic1: 'linear-epic1', epic2: 'linear-epic2' },
        features: { feature1: 'linear-feature1', feature2: 'linear-feature2' },
        stories: { story1: 'linear-story1', story2: 'linear-story2' },
        enablers: { enabler1: 'linear-enabler1', enabler2: 'linear-enabler2' }
      });
    });
  });

  describe('findAddedItems', () => {
    it('should find items that have been added to the planning document', async () => {
      // Create a planning document
      const planningDocument: PlanningDocument = {
        id: 'test-planning-document',
        title: 'Test Planning Document',
        epics: [
          { id: 'epic1', type: 'epic', title: 'Epic 1', description: 'Epic 1 description', features: [], attributes: {} },
          { id: 'epic2', type: 'epic', title: 'Epic 2', description: 'Epic 2 description', features: [], attributes: {} }
        ],
        features: [
          { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', epicId: 'epic1', stories: [], enablers: [], attributes: {} },
          { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', epicId: 'epic2', stories: [], enablers: [], attributes: {} }
        ],
        stories: [
          { id: 'story1', type: 'story', title: 'Story 1', description: 'Story 1 description', featureId: 'feature1', acceptanceCriteria: [], attributes: {} },
          { id: 'story2', type: 'story', title: 'Story 2', description: 'Story 2 description', featureId: 'feature2', acceptanceCriteria: [], attributes: {} }
        ],
        enablers: [
          { id: 'enabler1', type: 'enabler', title: 'Enabler 1', description: 'Enabler 1 description', featureId: 'feature1', enablerType: 'architecture', attributes: {} },
          { id: 'enabler2', type: 'enabler', title: 'Enabler 2', description: 'Enabler 2 description', featureId: 'feature2', enablerType: 'infrastructure', attributes: {} }
        ]
      };

      // Create existing issues
      const existingIssues = {
        epics: { epic1: 'linear-epic1' },
        features: { feature1: 'linear-feature1' },
        stories: { story1: 'linear-story1' },
        enablers: { enabler1: 'linear-enabler1' }
      };

      // Call the method
      const result = await synchronizer.findAddedItems(planningDocument, existingIssues);

      // Verify the result
      expect(result).toEqual({
        epics: [planningDocument.epics?.[1]],
        features: [planningDocument.features?.[1]],
        stories: [planningDocument.stories?.[1]],
        enablers: [planningDocument.enablers?.[1]]
      });
    });
  });

  describe('findRemovedItems', () => {
    it('should find items that have been removed from the planning document', async () => {
      // Create a planning document
      const planningDocument: PlanningDocument = {
        id: 'test-planning-document',
        title: 'Test Planning Document',
        epics: [
          { id: 'epic1', type: 'epic', title: 'Epic 1', description: 'Epic 1 description', features: [], attributes: {} }
        ],
        features: [
          { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', epicId: 'epic1', stories: [], enablers: [], attributes: {} }
        ],
        stories: [
          { id: 'story1', type: 'story', title: 'Story 1', description: 'Story 1 description', featureId: 'feature1', acceptanceCriteria: [], attributes: {} }
        ],
        enablers: [
          { id: 'enabler1', type: 'enabler', title: 'Enabler 1', description: 'Enabler 1 description', featureId: 'feature1', enablerType: 'architecture', attributes: {} }
        ]
      };

      // Create existing issues
      const existingIssues = {
        epics: { epic1: 'linear-epic1', epic2: 'linear-epic2' },
        features: { feature1: 'linear-feature1', feature2: 'linear-feature2' },
        stories: { story1: 'linear-story1', story2: 'linear-story2' },
        enablers: { enabler1: 'linear-enabler1', enabler2: 'linear-enabler2' }
      };

      // Call the method
      const result = await synchronizer.findRemovedItems(planningDocument, existingIssues);

      // Verify the result
      expect(result).toEqual({
        epics: ['epic2'],
        features: ['feature2'],
        stories: ['story2'],
        enablers: ['enabler2']
      });
    });
  });

  describe('findModifiedItems', () => {
    it('should find items that have been modified in the planning document', async () => {
      // Create a planning document
      const planningDocument: PlanningDocument = {
        id: 'test-planning-document',
        title: 'Test Planning Document',
        epics: [
          { id: 'epic1', type: 'epic', title: 'Epic 1', description: 'Epic 1 description', features: [], attributes: {} },
          { id: 'epic2', type: 'epic', title: 'Epic 2', description: 'Epic 2 description', features: [], attributes: {} }
        ],
        features: [
          { id: 'feature1', type: 'feature', title: 'Feature 1', description: 'Feature 1 description', epicId: 'epic1', stories: [], enablers: [], attributes: {} },
          { id: 'feature2', type: 'feature', title: 'Feature 2', description: 'Feature 2 description', epicId: 'epic2', stories: [], enablers: [], attributes: {} }
        ],
        stories: [
          { id: 'story1', type: 'story', title: 'Story 1', description: 'Story 1 description', featureId: 'feature1', acceptanceCriteria: [], attributes: {} },
          { id: 'story2', type: 'story', title: 'Story 2', description: 'Story 2 description', featureId: 'feature2', acceptanceCriteria: [], attributes: {} }
        ],
        enablers: [
          { id: 'enabler1', type: 'enabler', title: 'Enabler 1', description: 'Enabler 1 description', featureId: 'feature1', enablerType: 'architecture', attributes: {} },
          { id: 'enabler2', type: 'enabler', title: 'Enabler 2', description: 'Enabler 2 description', featureId: 'feature2', enablerType: 'infrastructure', attributes: {} }
        ]
      };

      // Create existing issues
      const existingIssues = {
        epics: { epic1: 'linear-epic1', epic2: 'linear-epic2' },
        features: { feature1: 'linear-feature1', feature2: 'linear-feature2' },
        stories: { story1: 'linear-story1', story2: 'linear-story2' },
        enablers: { enabler1: 'linear-enabler1', enabler2: 'linear-enabler2' }
      };

      // Call the method
      const result = await synchronizer.findModifiedItems(planningDocument, existingIssues);

      // Verify the result
      expect(result).toEqual({
        epics: [
          { id: 'linear-epic1', epic: planningDocument.epics[0] },
          { id: 'linear-epic2', epic: planningDocument.epics[1] }
        ],
        features: [
          { id: 'linear-feature1', feature: planningDocument.features?.[0] },
          { id: 'linear-feature2', feature: planningDocument.features?.[1] }
        ],
        stories: [
          { id: 'linear-story1', story: planningDocument.stories?.[0] },
          { id: 'linear-story2', story: planningDocument.stories?.[1] }
        ],
        enablers: [
          { id: 'linear-enabler1', enabler: planningDocument.enablers?.[0] },
          { id: 'linear-enabler2', enabler: planningDocument.enablers?.[1] }
        ]
      });
    });
  });
});
