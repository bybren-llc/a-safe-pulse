import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictResolver, ConflictResolutionStrategy } from '../../src/sync/conflict-resolver';
import { ConfluenceClient } from '../../src/confluence/client';
import { LinearClientWrapper } from '../../src/linear/client';
import { SyncStore } from '../../src/sync/sync-store';
import { Conflict, Change, ChangeType, ChangeSource, ChangeItemType } from '../../src/sync/change-detector';
import {
  createMockResolvedValue,
  createMockRejectedValue,
  type SyncConflict
} from '../types/test-types';

// Mock dependencies
jest.mock('../../src/confluence/client');
jest.mock('../../src/linear/client');
jest.mock('../../src/sync/sync-store');

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver;
  let mockConfluenceClient: jest.Mocked<ConfluenceClient>;
  let mockLinearClient: jest.Mocked<LinearClientWrapper>;
  let mockSyncStore: jest.Mocked<SyncStore>;

  const linearChange: Change = {
    id: 'linear-1',
    type: ChangeType.UPDATED,
    source: ChangeSource.LINEAR,
    itemType: ChangeItemType.EPIC,
    itemId: 'item-1',
    itemData: { id: 'item-1', title: 'Linear Item 1' },
    timestamp: Date.now()
  };

  const confluenceChange: Change = {
    id: 'confluence-1',
    type: ChangeType.UPDATED,
    source: ChangeSource.CONFLUENCE,
    itemType: ChangeItemType.EPIC,
    itemId: 'item-1',
    itemData: { id: 'item-1', title: 'Confluence Item 1' },
    timestamp: Date.now()
  };

  const conflict: Conflict = {
    id: 'conflict-1',
    linearChange,
    confluenceChange,
    isResolved: false
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (ConfluenceClient as jest.Mock).mockImplementation(() => ({}));
    (LinearClientWrapper as jest.Mock).mockImplementation(() => ({}));
    (SyncStore as jest.Mock).mockImplementation(() => ({
      storeConflict: jest.fn().mockResolvedValue(undefined),
      storeResolvedConflict: jest.fn().mockResolvedValue(undefined),
      getUnresolvedConflicts: jest.fn().mockResolvedValue([]),
      getResolvedConflicts: jest.fn().mockResolvedValue([])
    }));

    // Create instance with mocked dependencies
    const confluenceClient = new ConfluenceClient('base-url', 'token');
    const linearClient = new LinearClientWrapper('token', 'org-id');
    const syncStore = new SyncStore();
    conflictResolver = new ConflictResolver(
      confluenceClient,
      linearClient,
      syncStore,
      false // autoResolveConflicts
    );

    // Get mock instances from created objects (proven pattern)
    mockConfluenceClient = (conflictResolver as any).confluenceClient;
    mockLinearClient = (conflictResolver as any).linearClient;
    mockSyncStore = (conflictResolver as any).syncStore;
  });

  describe('resolveConflicts', () => {
    it('should store conflicts when auto-resolve is disabled', async () => {
      // Act
      const resolvedConflicts = await conflictResolver.resolveConflicts([conflict]);

      // Assert
      expect(mockSyncStore.storeConflict).toHaveBeenCalledWith(conflict);
      expect(resolvedConflicts).toHaveLength(0);
    });

    it('should auto-resolve conflicts when enabled', async () => {
      // Arrange
      const autoResolveConflictResolver = new ConflictResolver(
        mockConfluenceClient,
        mockLinearClient,
        mockSyncStore,
        true // autoResolveConflicts
      );

      const resolveConflictSpy = jest.spyOn(autoResolveConflictResolver, 'resolveConflict')
        .mockResolvedValue({
          ...conflict,
          resolvedChange: {
            ...linearChange,
            id: 'resolved-1'
          },
          isResolved: true,
          resolutionStrategy: ConflictResolutionStrategy.LINEAR
        });

      // Act
      const resolvedConflicts = await autoResolveConflictResolver.resolveConflicts([conflict]);

      // Assert
      expect(resolveConflictSpy).toHaveBeenCalledWith(
        conflict,
        ConflictResolutionStrategy.LINEAR
      );
      expect(resolvedConflicts).toHaveLength(1);
      expect(resolvedConflicts[0]).toEqual({
        ...conflict,
        resolvedChange: {
          ...linearChange,
          id: 'resolved-1'
        },
        isResolved: true,
        resolutionStrategy: ConflictResolutionStrategy.LINEAR
      });
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Test error');
      jest.mocked(mockSyncStore.storeConflict).mockRejectedValue(error);

      // Act
      const resolvedConflicts = await conflictResolver.resolveConflicts([conflict]);

      // Assert
      expect(resolvedConflicts).toHaveLength(0);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with Linear strategy', async () => {
      // Act
      const resolvedConflict = await conflictResolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LINEAR
      );

      // Assert
      expect(mockSyncStore.storeResolvedConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conflict-1',
          linearChange,
          confluenceChange,
          resolvedChange: expect.objectContaining({
            id: expect.stringContaining('resolved-'),
            source: ChangeSource.LINEAR
          }),
          isResolved: true,
          resolutionStrategy: ConflictResolutionStrategy.LINEAR
        })
      );
      expect(resolvedConflict).toEqual({
        id: 'conflict-1',
        linearChange,
        confluenceChange,
        resolvedChange: expect.objectContaining({
          id: expect.stringContaining('resolved-'),
          source: ChangeSource.LINEAR
        }),
        isResolved: true,
        resolutionStrategy: ConflictResolutionStrategy.LINEAR
      });
    });

    it('should resolve conflict with Confluence strategy', async () => {
      // Act
      const resolvedConflict = await conflictResolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.CONFLUENCE
      );

      // Assert
      expect(mockSyncStore.storeResolvedConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conflict-1',
          linearChange,
          confluenceChange,
          resolvedChange: expect.objectContaining({
            id: expect.stringContaining('resolved-'),
            source: ChangeSource.CONFLUENCE
          }),
          isResolved: true,
          resolutionStrategy: ConflictResolutionStrategy.CONFLUENCE
        })
      );
      expect(resolvedConflict).toEqual({
        id: 'conflict-1',
        linearChange,
        confluenceChange,
        resolvedChange: expect.objectContaining({
          id: expect.stringContaining('resolved-'),
          source: ChangeSource.CONFLUENCE
        }),
        isResolved: true,
        resolutionStrategy: ConflictResolutionStrategy.CONFLUENCE
      });
    });

    it('should throw error for invalid conflict', async () => {
      // Arrange
      const invalidConflict: Conflict = {
        id: 'invalid-conflict',
        isResolved: false
      };

      // Act & Assert
      await expect(conflictResolver.resolveConflict(
        invalidConflict,
        ConflictResolutionStrategy.LINEAR
      )).rejects.toThrow('Invalid conflict: missing changes');
    });

    it('should throw error for manual resolution', async () => {
      // Act & Assert
      await expect(conflictResolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.MANUAL
      )).rejects.toThrow('Manual conflict resolution not implemented');
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Test error');
      jest.mocked(mockSyncStore.storeResolvedConflict).mockRejectedValue(error);

      // Act & Assert
      await expect(conflictResolver.resolveConflict(
        conflict,
        ConflictResolutionStrategy.LINEAR
      )).rejects.toThrow(error);
    });
  });

  describe('getUnresolvedConflicts', () => {
    it('should get unresolved conflicts', async () => {
      // Arrange
      jest.mocked(mockSyncStore.getUnresolvedConflicts).mockResolvedValue([conflict]);

      // Act
      const unresolvedConflicts = await conflictResolver.getUnresolvedConflicts();

      // Assert
      expect(mockSyncStore.getUnresolvedConflicts).toHaveBeenCalled();
      expect(unresolvedConflicts).toEqual([conflict]);
    });
  });

  describe('getResolvedConflicts', () => {
    it('should get resolved conflicts', async () => {
      // Arrange
      const resolvedConflict: Conflict = {
        ...conflict,
        resolvedChange: {
          ...linearChange,
          id: 'resolved-1'
        },
        isResolved: true,
        resolutionStrategy: ConflictResolutionStrategy.LINEAR
      };
      jest.mocked(mockSyncStore.getResolvedConflicts).mockResolvedValue([resolvedConflict]);

      // Act
      const resolvedConflicts = await conflictResolver.getResolvedConflicts();

      // Assert
      expect(mockSyncStore.getResolvedConflicts).toHaveBeenCalled();
      expect(resolvedConflicts).toEqual([resolvedConflict]);
    });
  });
});
