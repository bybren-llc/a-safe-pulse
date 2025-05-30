import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SyncManager, SyncOptions } from '../../src/sync/sync-manager';
import { ConfluenceClient } from '../../src/confluence/client';
import { LinearClientWrapper } from '../../src/linear/client';
import { ChangeDetector } from '../../src/sync/change-detector';
import { ConflictResolver } from '../../src/sync/conflict-resolver';
import { SyncStore } from '../../src/sync/sync-store';
import { LinearIssueCreatorFromPlanning } from '../../src/planning/linear-issue-creator';

// Mock dependencies
jest.mock('../../src/confluence/client');
jest.mock('../../src/linear/client');
jest.mock('../../src/sync/change-detector');
jest.mock('../../src/sync/conflict-resolver');
jest.mock('../../src/sync/sync-store');
jest.mock('../../src/planning/linear-issue-creator');

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockConfluenceClient: jest.Mocked<ConfluenceClient>;
  let mockLinearClient: jest.Mocked<LinearClientWrapper>;
  let mockChangeDetector: jest.Mocked<ChangeDetector>;
  let mockConflictResolver: jest.Mocked<ConflictResolver>;
  let mockSyncStore: jest.Mocked<SyncStore>;
  let mockIssueCreator: jest.Mocked<LinearIssueCreatorFromPlanning>;

  const options: SyncOptions = {
    linearAccessToken: 'linear-token',
    linearTeamId: 'team-id',
    linearOrganizationId: 'org-id',
    confluenceAccessToken: 'confluence-token',
    confluenceBaseUrl: 'https://example.atlassian.net',
    confluencePageIdOrUrl: 'page-id',
    syncIntervalMs: 1000,
    autoResolveConflicts: false
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (ConfluenceClient as jest.Mock).mockImplementation(() => ({
      parsePageByUrl: jest.fn().mockImplementation(() => Promise.resolve({})),
      parsePage: jest.fn().mockImplementation(() => Promise.resolve({}))
    }));

    (LinearClientWrapper as jest.Mock).mockImplementation(() => ({
      executeQuery: jest.fn().mockImplementation(() => Promise.resolve({ nodes: [] }))
    }));

    (ChangeDetector as jest.Mock).mockImplementation(() => ({
      detectChanges: jest.fn().mockImplementation(() => Promise.resolve({
        linearChanges: [],
        confluenceChanges: []
      })),
      detectConflicts: jest.fn().mockImplementation(() => [])
    }));

    (ConflictResolver as jest.Mock).mockImplementation(() => ({
      resolveConflicts: jest.fn().mockImplementation(() => Promise.resolve([]))
    }));

    (SyncStore as jest.Mock).mockImplementation(() => ({
      getLastSyncTimestamp: jest.fn().mockImplementation(() => Promise.resolve(null)),
      updateLastSyncTimestamp: jest.fn().mockImplementation(() => Promise.resolve(undefined))
    }));

    (LinearIssueCreatorFromPlanning as jest.Mock).mockImplementation(() => ({
      createIssuesFromConfluence: jest.fn().mockImplementation(() => Promise.resolve({
        createdCount: 0,
        updatedCount: 0,
        errorCount: 0,
        errors: []
      }))
    }));

    // Create instance with mocked dependencies
    syncManager = new SyncManager(options);
    
    // Get mock instances
    mockConfluenceClient = (ConfluenceClient as unknown) as jest.Mocked<ConfluenceClient>;
    mockLinearClient = (LinearClientWrapper as unknown) as jest.Mocked<LinearClientWrapper>;
    mockChangeDetector = (ChangeDetector as unknown) as jest.Mocked<ChangeDetector>;
    mockConflictResolver = (ConflictResolver as unknown) as jest.Mocked<ConflictResolver>;
    mockSyncStore = (SyncStore as unknown) as jest.Mocked<SyncStore>;
    mockIssueCreator = (LinearIssueCreatorFromPlanning as unknown) as jest.Mocked<LinearIssueCreatorFromPlanning>;
  });

  afterEach(() => {
    // Clear any timers
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should start synchronization', async () => {
      // Arrange
      const syncSpy = jest.spyOn(syncManager, 'sync').mockResolvedValue({
        success: true,
        createdIssues: 0,
        updatedIssues: 0,
        confluenceChanges: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        timestamp: Date.now()
      });

      // Act
      await syncManager.start();

      // Assert
      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop synchronization', async () => {
      // Arrange
      const syncSpy = jest.spyOn(syncManager, 'sync').mockResolvedValue({
        success: true,
        createdIssues: 0,
        updatedIssues: 0,
        confluenceChanges: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        timestamp: Date.now()
      });

      // Act
      await syncManager.start();
      syncManager.stop();

      // Assert
      expect(syncManager['syncIntervalId']).toBeUndefined();
    });
  });

  describe('sync', () => {
    it('should perform synchronization', async () => {
      // Arrange
      (mockChangeDetector.detectChanges as jest.Mock).mockImplementation(() => Promise.resolve({
        linearChanges: [{ id: 'linear-1', itemId: 'item-1' }],
        confluenceChanges: [{ id: 'confluence-1', itemId: 'item-2' }]
      }));

      (mockChangeDetector.detectConflicts as jest.Mock).mockReturnValue([
        { id: 'conflict-1', linearChange: { id: 'linear-1', itemId: 'item-1' }, confluenceChange: { id: 'confluence-1', itemId: 'item-1' }, isResolved: false }
      ]);

      (mockConflictResolver.resolveConflicts as jest.Mock).mockImplementation(() => Promise.resolve([
        { id: 'conflict-1', linearChange: { id: 'linear-1', itemId: 'item-1' }, confluenceChange: { id: 'confluence-1', itemId: 'item-1' }, resolvedChange: { id: 'resolved-1', itemId: 'item-1' }, isResolved: true, resolutionStrategy: 'linear' }
      ]));

      (mockIssueCreator.createIssuesFromConfluence as jest.Mock).mockImplementation(() => Promise.resolve({
        createdCount: 1,
        updatedCount: 0,
        errorCount: 0,
        errors: []
      }));

      // Act
      const result = await syncManager.sync();

      // Assert
      expect(mockChangeDetector.detectChanges).toHaveBeenCalledWith(
        options.confluencePageIdOrUrl,
        options.linearTeamId
      );
      expect(mockChangeDetector.detectConflicts).toHaveBeenCalled();
      expect(mockConflictResolver.resolveConflicts).toHaveBeenCalled();
      expect(mockIssueCreator.createIssuesFromConfluence).toHaveBeenCalled();
      expect(mockSyncStore.updateLastSyncTimestamp).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        createdIssues: 1,
        updatedIssues: 0,
        confluenceChanges: 1,
        conflictsDetected: 1,
        conflictsResolved: 1,
        timestamp: expect.any(Number)
      });
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Test error');
      (mockChangeDetector.detectChanges as jest.Mock).mockImplementation(() => Promise.reject(error));

      // Act
      const result = await syncManager.sync();

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Test error',
        createdIssues: 0,
        updatedIssues: 0,
        confluenceChanges: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getStatus', () => {
    it('should get synchronization status', async () => {
      // Arrange
      const timestamp = Date.now();
      (mockSyncStore.getLastSyncTimestamp as jest.Mock).mockImplementation(() => Promise.resolve(timestamp));

      // Act
      const status = await syncManager.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: false,
        lastSyncTimestamp: timestamp,
        nextSyncTimestamp: timestamp + (options.syncIntervalMs || 5000)
      });
    });
  });
});
