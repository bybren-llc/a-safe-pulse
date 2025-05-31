import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChangeDetector, ChangeType, ChangeSource, ChangeItemType, Change } from '../../src/sync/change-detector';
import { ConfluenceClient } from '../../src/confluence/client';
import { LinearClientWrapper } from '../../src/linear/client';
import { SyncStore } from '../../src/sync/sync-store';
import { PlanningExtractor } from '../../src/planning/extractor';

// Mock dependencies
jest.mock('../../src/confluence/client');
jest.mock('../../src/linear/client');
jest.mock('../../src/sync/sync-store');
jest.mock('../../src/planning/extractor');

describe('ChangeDetector', () => {
  let changeDetector: ChangeDetector;
  let mockConfluenceClient: jest.Mocked<ConfluenceClient>;
  let mockLinearClient: jest.Mocked<LinearClientWrapper>;
  let mockSyncStore: jest.Mocked<SyncStore>;
  let mockPlanningExtractor: jest.Mocked<PlanningExtractor>;

  const confluencePageIdOrUrl = 'page-id';
  const linearTeamId = 'team-id';
  const lastSyncTimestamp = Date.now() - 3600000; // 1 hour ago

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (ConfluenceClient as jest.Mock).mockImplementation(() => ({
      parsePageByUrl: jest.fn().mockResolvedValue({} as any),
      parsePage: jest.fn().mockResolvedValue({} as any)
    }));

    (LinearClientWrapper as jest.Mock).mockImplementation(() => ({
      executeQuery: jest.fn().mockResolvedValue({
        nodes: [
          {
            id: 'issue-1',
            title: 'Issue 1',
            description: 'Description 1',
            createdAt: new Date(lastSyncTimestamp + 1000).toISOString(),
            updatedAt: new Date(lastSyncTimestamp + 1000).toISOString(),
            labels: { nodes: [{ name: 'Epic' }] }
          },
          {
            id: 'issue-2',
            title: 'Issue 2',
            description: 'Description 2',
            createdAt: new Date(lastSyncTimestamp - 1000).toISOString(),
            updatedAt: new Date(lastSyncTimestamp + 1000).toISOString(),
            labels: { nodes: [{ name: 'Feature' }] }
          }
        ]
      } as any)
    }));

    (SyncStore as jest.Mock).mockImplementation(() => ({
      getLastSyncTimestamp: jest.fn().mockResolvedValue(lastSyncTimestamp as any)
    }));

    (PlanningExtractor as jest.Mock).mockImplementation(() => ({
      getPlanningDocument: jest.fn().mockReturnValue({
        epics: [
          {
            id: 'epic-1',
            type: 'epic',
            title: 'Epic 1',
            description: 'Epic 1 description',
            features: [],
            attributes: {}
          }
        ],
        features: [
          {
            id: 'feature-1',
            type: 'feature',
            title: 'Feature 1',
            description: 'Feature 1 description',
            epicId: 'epic-1',
            stories: [],
            enablers: [],
            attributes: {}
          }
        ],
        stories: [
          {
            id: 'story-1',
            type: 'story',
            title: 'Story 1',
            description: 'Story 1 description',
            featureId: 'feature-1',
            acceptanceCriteria: [],
            attributes: {}
          }
        ],
        enablers: [
          {
            id: 'enabler-1',
            type: 'enabler',
            title: 'Enabler 1',
            description: 'Enabler 1 description',
            featureId: 'feature-1',
            enablerType: 'architecture',
            attributes: {}
          }
        ]
      })
    }));

    // Create instance with mocked dependencies
    const confluenceClient = new ConfluenceClient('base-url', 'token');
    const linearClient = new LinearClientWrapper('token', 'org-id');
    const syncStore = new SyncStore();
    changeDetector = new ChangeDetector(
      confluenceClient,
      linearClient,
      syncStore
    );
    
    // Get mock instances from created objects (proven pattern)
    mockConfluenceClient = (changeDetector as any).confluenceClient;
    mockLinearClient = (changeDetector as any).linearClient;
    mockSyncStore = (changeDetector as any).syncStore;
    mockPlanningExtractor = new PlanningExtractor([], []) as jest.Mocked<PlanningExtractor>;
  });

  describe('detectChanges', () => {
    it('should detect Linear changes', async () => {
      // Act
      const changes = await changeDetector.detectChanges(
        confluencePageIdOrUrl,
        linearTeamId
      );

      // Assert
      expect(mockSyncStore.getLastSyncTimestamp).toHaveBeenCalledWith(
        confluencePageIdOrUrl,
        linearTeamId
      );
      expect(mockLinearClient.executeQuery).toHaveBeenCalled();
      expect(changes.linearChanges).toHaveLength(2);
      expect(changes.linearChanges[0]).toEqual({
        id: expect.stringContaining('linear-change-'),
        type: ChangeType.CREATED,
        source: ChangeSource.LINEAR,
        itemType: ChangeItemType.EPIC,
        itemId: 'issue-1',
        itemData: expect.objectContaining({
          id: 'issue-1',
          title: 'Issue 1'
        }),
        timestamp: expect.any(Number)
      });
      expect(changes.linearChanges[1]).toEqual({
        id: expect.stringContaining('linear-change-'),
        type: ChangeType.UPDATED,
        source: ChangeSource.LINEAR,
        itemType: ChangeItemType.FEATURE,
        itemId: 'issue-2',
        itemData: expect.objectContaining({
          id: 'issue-2',
          title: 'Issue 2'
        }),
        timestamp: expect.any(Number)
      });
    });

    it('should detect Confluence changes on first sync', async () => {
      // Arrange
      mockSyncStore.getLastSyncTimestamp.mockResolvedValue(null as any);

      // Act
      const changes = await changeDetector.detectChanges(
        confluencePageIdOrUrl,
        linearTeamId
      );

      // Assert
      expect(mockConfluenceClient.parsePage).toHaveBeenCalledWith(confluencePageIdOrUrl);
      expect(changes.confluenceChanges).toHaveLength(4); // Epic, Feature, Story, Enabler
      expect(changes.confluenceChanges[0]).toEqual({
        id: expect.stringContaining('confluence-change-'),
        type: ChangeType.CREATED,
        source: ChangeSource.CONFLUENCE,
        itemType: ChangeItemType.EPIC,
        itemId: 'epic-1',
        itemData: expect.objectContaining({
          id: 'epic-1',
          title: 'Epic 1'
        }),
        timestamp: expect.any(Number)
      });
    });

    it('should handle URL for Confluence page', async () => {
      // Arrange
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456789';

      // Act
      await changeDetector.detectChanges(url, linearTeamId);

      // Assert
      expect(mockConfluenceClient.parsePageByUrl).toHaveBeenCalledWith(url);
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Test error');
      mockLinearClient.executeQuery.mockRejectedValue(error as any);

      // Act & Assert
      await expect(changeDetector.detectChanges(
        confluencePageIdOrUrl,
        linearTeamId
      )).rejects.toThrow(error);
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicts between Linear and Confluence changes', () => {
      // Arrange
      const linearChanges: Change[] = [
        {
          id: 'linear-1',
          type: ChangeType.UPDATED,
          source: ChangeSource.LINEAR,
          itemType: ChangeItemType.EPIC,
          itemId: 'item-1',
          itemData: { id: 'item-1', title: 'Linear Item 1' },
          timestamp: Date.now()
        },
        {
          id: 'linear-2',
          type: ChangeType.UPDATED,
          source: ChangeSource.LINEAR,
          itemType: ChangeItemType.FEATURE,
          itemId: 'item-2',
          itemData: { id: 'item-2', title: 'Linear Item 2' },
          timestamp: Date.now()
        }
      ];

      const confluenceChanges: Change[] = [
        {
          id: 'confluence-1',
          type: ChangeType.UPDATED,
          source: ChangeSource.CONFLUENCE,
          itemType: ChangeItemType.EPIC,
          itemId: 'item-1',
          itemData: { id: 'item-1', title: 'Confluence Item 1' },
          timestamp: Date.now()
        },
        {
          id: 'confluence-3',
          type: ChangeType.UPDATED,
          source: ChangeSource.CONFLUENCE,
          itemType: ChangeItemType.STORY,
          itemId: 'item-3',
          itemData: { id: 'item-3', title: 'Confluence Item 3' },
          timestamp: Date.now()
        }
      ];

      // Act
      const conflicts = changeDetector.detectConflicts({
        linearChanges,
        confluenceChanges
      });

      // Assert
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        id: expect.stringContaining('conflict-'),
        linearChange: linearChanges[0],
        confluenceChange: confluenceChanges[0],
        isResolved: false
      });
    });

    it('should handle empty changes', () => {
      // Act
      const conflicts = changeDetector.detectConflicts({
        linearChanges: [],
        confluenceChanges: []
      });

      // Assert
      expect(conflicts).toHaveLength(0);
    });
  });
});
