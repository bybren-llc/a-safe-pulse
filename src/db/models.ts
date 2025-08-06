import { query, getClient } from './connection';
import * as logger from '../utils/logger';
import { runMigrations } from './migrations';
import crypto from 'crypto';

/**
 * Token decryption utility using secure AES-256-CBC
 */
const ALGORITHM = 'aes-256-cbc';

/**
 * Gets the encryption key as a Buffer, ensuring it's 32 bytes for AES-256
 */
const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  try {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
    }
    return key;
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be a valid hex string (64 characters)');
  }
};

/**
 * Decrypts a token using secure AES-256-CBC
 */
const decryptToken = (encryptedData: string): string => {
  if (!encryptedData || !encryptedData.includes(':')) {
    // Handle legacy unencrypted tokens gracefully
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting token', { error });
    throw new Error('Token decryption failed');
  }
};

// Mock database interface for testing
export interface DatabaseInterface {
  get(query: string, params?: any[]): Promise<any>;
  all(query: string, params?: any[]): Promise<any[]>;
  run(query: string, params?: any[]): Promise<any>;
}

// TypeScript interfaces for database tables

/**
 * Linear OAuth token
 */
export interface LinearToken {
  id: number;
  organization_id: string;
  access_token: string;
  refresh_token: string | null;
  app_user_id: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Confluence OAuth token
 */
export interface ConfluenceToken {
  id: number;
  organization_id: string;
  access_token: string;
  refresh_token: string | null;
  site_url: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Planning session
 */
export interface PlanningSession {
  id: number;
  organization_id: string;
  confluence_page_url: string;
  planning_title: string;
  epic_id?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Planning feature
 */
export interface PlanningFeature {
  id: number;
  planning_session_id: number;
  feature_id: string;
  title: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Planning story
 */
export interface PlanningStory {
  id: number;
  planning_feature_id: number;
  story_id: string;
  title: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Planning enabler
 */
export interface PlanningEnabler {
  id: number;
  planning_session_id: number;
  enabler_id: string;
  title: string;
  description?: string;
  enabler_type: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Program Increment in the database
 */
export interface ProgramIncrementDB {
  id: number;
  organization_id: string;
  pi_id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  description?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Program Increment Feature in the database
 */
export interface PIFeatureDB {
  id: number;
  program_increment_id: number;
  feature_id: string;
  team_id: string;
  status: string;
  confidence: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Program Increment Objective in the database
 */
export interface PIObjectiveDB {
  id: number;
  program_increment_id: number;
  objective_id: string;
  team_id: string;
  description: string;
  business_value: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Program Increment Risk in the database
 */
export interface PIRiskDB {
  id: number;
  program_increment_id: number;
  risk_id: string;
  description: string;
  impact: number;
  likelihood: number;
  status: string;
  mitigation_plan?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Synchronization state in the database
 */
export interface SyncState {
  id: number;
  confluence_page_id: string;
  linear_team_id: string;
  timestamp: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Conflict in the database
 */
export interface Conflict {
  id: string;
  linear_change: string;
  confluence_change: string;
  is_resolved: boolean;
  resolution_strategy?: string;
  resolved_change?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Synchronization history in the database
 */
export interface SyncHistory {
  id: number;
  confluence_page_id: string;
  linear_team_id: string;
  success: boolean;
  error?: string;
  created_issues: number;
  updated_issues: number;
  confluence_changes: number;
  conflicts_detected: number;
  conflicts_resolved: number;
  timestamp: number;
  created_at: Date;
}

/**
 * Initializes the database schema by running migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await runMigrations();
    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Error initializing database schema', { error });
    throw error;
  }
};

// Sync State CRUD Operations

/**
 * Gets the last synchronization timestamp
 */
export const getLastSyncTimestamp = async (
  confluencePageId: string,
  linearTeamId: string
): Promise<number | null> => {
  try {
    const result = await query(
      'SELECT timestamp FROM sync_state WHERE confluence_page_id = $1 AND linear_team_id = $2',
      [confluencePageId, linearTeamId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].timestamp;
  } catch (error) {
    logger.error('Error getting last sync timestamp', { error, confluencePageId, linearTeamId });
    throw error;
  }
};

/**
 * Updates the last synchronization timestamp
 */
export const updateLastSyncTimestamp = async (
  confluencePageId: string,
  linearTeamId: string,
  timestamp: number
): Promise<void> => {
  try {
    await query(
      `
        INSERT INTO sync_state (confluence_page_id, linear_team_id, timestamp)
        VALUES ($1, $2, $3)
        ON CONFLICT (confluence_page_id, linear_team_id)
        DO UPDATE SET timestamp = $3, updated_at = NOW()
      `,
      [confluencePageId, linearTeamId, timestamp]
    );

    logger.info('Sync timestamp updated', { confluencePageId, linearTeamId, timestamp });
  } catch (error) {
    logger.error('Error updating sync timestamp', { error, confluencePageId, linearTeamId, timestamp });
    throw error;
  }
};

/**
 * Stores a conflict in the database
 */
export const storeConflict = async (
  conflictId: string,
  linearChange: any,
  confluenceChange: any,
  isResolved: boolean = false,
  resolutionStrategy?: string,
  resolvedChange?: any
): Promise<void> => {
  try {
    await query(
      `
        INSERT INTO conflicts (
          id, linear_change, confluence_change, is_resolved, resolution_strategy, resolved_change
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id)
        DO UPDATE SET
          linear_change = $2,
          confluence_change = $3,
          is_resolved = $4,
          resolution_strategy = $5,
          resolved_change = $6,
          updated_at = NOW()
      `,
      [
        conflictId,
        JSON.stringify(linearChange),
        JSON.stringify(confluenceChange),
        isResolved,
        resolutionStrategy || null,
        resolvedChange ? JSON.stringify(resolvedChange) : null
      ]
    );

    logger.info('Conflict stored', { conflictId, isResolved });
  } catch (error) {
    logger.error('Error storing conflict', { error, conflictId });
    throw error;
  }
};

/**
 * Gets unresolved conflicts
 */
export const getUnresolvedConflicts = async (): Promise<any[]> => {
  try {
    const result = await query(
      'SELECT * FROM conflicts WHERE is_resolved = FALSE ORDER BY created_at DESC'
    );

    return result.rows.map(row => ({
      id: row.id,
      linearChange: JSON.parse(row.linear_change),
      confluenceChange: JSON.parse(row.confluence_change),
      isResolved: row.is_resolved,
      resolutionStrategy: row.resolution_strategy,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    logger.error('Error getting unresolved conflicts', { error });
    throw error;
  }
};

/**
 * Gets resolved conflicts
 */
export const getResolvedConflicts = async (): Promise<any[]> => {
  try {
    const result = await query(
      'SELECT * FROM conflicts WHERE is_resolved = TRUE ORDER BY updated_at DESC'
    );

    return result.rows.map(row => ({
      id: row.id,
      linearChange: JSON.parse(row.linear_change),
      confluenceChange: JSON.parse(row.confluence_change),
      resolvedChange: row.resolved_change ? JSON.parse(row.resolved_change) : null,
      isResolved: row.is_resolved,
      resolutionStrategy: row.resolution_strategy,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    logger.error('Error getting resolved conflicts', { error });
    throw error;
  }
};

/**
 * Gets all conflicts
 */
export const getAllConflicts = async (): Promise<any[]> => {
  try {
    const result = await query(
      'SELECT * FROM conflicts ORDER BY created_at DESC'
    );

    return result.rows.map(row => ({
      id: row.id,
      linearChange: JSON.parse(row.linear_change),
      confluenceChange: JSON.parse(row.confluence_change),
      resolvedChange: row.resolved_change ? JSON.parse(row.resolved_change) : null,
      isResolved: row.is_resolved,
      resolutionStrategy: row.resolution_strategy,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    logger.error('Error getting all conflicts', { error });
    throw error;
  }
};

/**
 * Deletes a conflict
 */
export const deleteConflict = async (conflictId: string): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM conflicts WHERE id = $1',
      [conflictId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('Conflict deleted', { conflictId });
    } else {
      logger.warn('No conflict found to delete', { conflictId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting conflict', { error, conflictId });
    throw error;
  }
};

/**
 * Clears all conflicts
 */
export const clearConflicts = async (): Promise<void> => {
  try {
    await query('DELETE FROM conflicts');
    logger.info('All conflicts cleared');
  } catch (error) {
    logger.error('Error clearing conflicts', { error });
    throw error;
  }
};

/**
 * Records sync history
 */
export const recordSyncHistory = async (
  confluencePageId: string,
  linearTeamId: string,
  success: boolean,
  timestamp: number,
  error?: string,
  createdIssues: number = 0,
  updatedIssues: number = 0,
  confluenceChanges: number = 0,
  conflictsDetected: number = 0,
  conflictsResolved: number = 0
): Promise<void> => {
  try {
    await query(
      `
        INSERT INTO sync_history (
          confluence_page_id, linear_team_id, success, error, created_issues,
          updated_issues, confluence_changes, conflicts_detected, conflicts_resolved, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        confluencePageId,
        linearTeamId,
        success,
        error || null,
        createdIssues,
        updatedIssues,
        confluenceChanges,
        conflictsDetected,
        conflictsResolved,
        timestamp
      ]
    );

    logger.info('Sync history recorded', {
      confluencePageId,
      linearTeamId,
      success,
      createdIssues,
      updatedIssues
    });
  } catch (error) {
    logger.error('Error recording sync history', { error, confluencePageId, linearTeamId });
    throw error;
  }
};

/**
 * Gets sync history for a page and team
 */
export const getSyncHistory = async (
  confluencePageId: string,
  linearTeamId: string,
  limit: number = 50
): Promise<any[]> => {
  try {
    const result = await query(
      `
        SELECT * FROM sync_history
        WHERE confluence_page_id = $1 AND linear_team_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [confluencePageId, linearTeamId, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting sync history', { error, confluencePageId, linearTeamId });
    throw error;
  }
};

// Linear Token CRUD Operations

/**
 * Stores OAuth tokens for an organization
 */
export const storeLinearToken = async (
  organizationId: string,
  accessToken: string,
  refreshToken: string | null,
  appUserId: string,
  expiresAt: Date
): Promise<void> => {
  try {
    await query(
      `
        INSERT INTO linear_tokens (organization_id, access_token, refresh_token, app_user_id, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (organization_id) DO UPDATE SET
          access_token = $2,
          refresh_token = $3,
          app_user_id = $4,
          expires_at = $5,
          updated_at = NOW()
      `,
      [organizationId, accessToken, refreshToken, appUserId, expiresAt]
    );

    logger.info('Tokens stored for organization', { organizationId });
  } catch (error) {
    logger.error('Error storing tokens', { error, organizationId });
    throw error;
  }
};

/**
 * Retrieves the Linear token for an organization
 */
export const getLinearToken = async (organizationId: string): Promise<LinearToken | null> => {
  try {
    const result = await query(
      'SELECT * FROM linear_tokens WHERE organization_id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      logger.warn('No tokens found for organization', { organizationId });
      return null;
    }

    return result.rows[0] as LinearToken;
  } catch (error) {
    logger.error('Error retrieving token', { error, organizationId });
    throw error;
  }
};

/**
 * Retrieves the access token for an organization
 */
export const getAccessToken = async (organizationId: string): Promise<string | null> => {
  try {
    const token = await getLinearToken(organizationId);

    if (!token) {
      return null;
    }

    // Check if token is expired
    if (new Date() > new Date(token.expires_at)) {
      logger.warn('Token expired for organization', { organizationId });
      // TODO: Implement token refresh
      return null;
    }

    // Decrypt the access token before returning
    return decryptToken(token.access_token);
  } catch (error) {
    logger.error('Error retrieving access token', { error, organizationId });
    throw error;
  }
};

/**
 * Deletes a Linear token for an organization
 */
export const deleteLinearToken = async (organizationId: string): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM linear_tokens WHERE organization_id = $1',
      [organizationId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('Token deleted for organization', { organizationId });
    } else {
      logger.warn('No token found to delete for organization', { organizationId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting token', { error, organizationId });
    throw error;
  }
};

// Planning Session CRUD Operations

/**
 * Creates a new planning session
 */
export const createPlanningSession = async (
  organizationId: string,
  confluencePageUrl: string,
  planningTitle: string,
  epicId?: string,
  status: string = 'pending'
): Promise<PlanningSession> => {
  try {
    const result = await query(
      `
        INSERT INTO planning_sessions (
          organization_id, confluence_page_url, planning_title, epic_id, status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [organizationId, confluencePageUrl, planningTitle, epicId, status]
    );

    logger.info('Planning session created', {
      organizationId,
      planningTitle,
      sessionId: result.rows[0].id
    });

    return result.rows[0] as PlanningSession;
  } catch (error) {
    logger.error('Error creating planning session', {
      error,
      organizationId,
      planningTitle
    });
    throw error;
  }
};

/**
 * Gets a planning session by ID
 */
export const getPlanningSession = async (sessionId: number): Promise<PlanningSession | null> => {
  try {
    const result = await query(
      'SELECT * FROM planning_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      logger.warn('No planning session found with ID', { sessionId });
      return null;
    }

    return result.rows[0] as PlanningSession;
  } catch (error) {
    logger.error('Error retrieving planning session', { error, sessionId });
    throw error;
  }
};

/**
 * Gets all planning sessions for an organization
 */
export const getPlanningSessionsByOrganization = async (
  organizationId: string
): Promise<PlanningSession[]> => {
  try {
    const result = await query(
      'SELECT * FROM planning_sessions WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );

    return result.rows as PlanningSession[];
  } catch (error) {
    logger.error('Error retrieving planning sessions', { error, organizationId });
    throw error;
  }
};

/**
 * Updates a planning session
 */
export const updatePlanningSession = async (
  sessionId: number,
  updates: Partial<PlanningSession>
): Promise<PlanningSession | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Add each field to the update query if it exists in the updates object
    if (updates.confluence_page_url !== undefined) {
      updateFields.push(`confluence_page_url = $${paramIndex}`);
      values.push(updates.confluence_page_url);
      paramIndex++;
    }

    if (updates.planning_title !== undefined) {
      updateFields.push(`planning_title = $${paramIndex}`);
      values.push(updates.planning_title);
      paramIndex++;
    }

    if (updates.epic_id !== undefined) {
      updateFields.push(`epic_id = $${paramIndex}`);
      values.push(updates.epic_id);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current session
    if (updateFields.length === 1) { // Only updated_at
      return getPlanningSession(sessionId);
    }

    // Add the session ID to the values array
    values.push(sessionId);

    const result = await query(
      `
        UPDATE planning_sessions
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No planning session found to update', { sessionId });
      return null;
    }

    logger.info('Planning session updated', { sessionId });
    return result.rows[0] as PlanningSession;
  } catch (error) {
    logger.error('Error updating planning session', { error, sessionId });
    throw error;
  }
};

/**
 * Deletes a planning session
 */
export const deletePlanningSession = async (sessionId: number): Promise<boolean> => {
  try {
    // Start a transaction to delete the session and all related records
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Delete related planning_features (which will cascade to planning_stories)
      await client.query(
        'DELETE FROM planning_features WHERE planning_session_id = $1',
        [sessionId]
      );

      // Delete related planning_enablers
      await client.query(
        'DELETE FROM planning_enablers WHERE planning_session_id = $1',
        [sessionId]
      );

      // Delete the planning session
      const result = await client.query(
        'DELETE FROM planning_sessions WHERE id = $1',
        [sessionId]
      );

      await client.query('COMMIT');

      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        logger.info('Planning session deleted', { sessionId });
      } else {
        logger.warn('No planning session found to delete', { sessionId });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error deleting planning session', { error, sessionId });
    throw error;
  }
};

// Planning Feature CRUD Operations

/**
 * Creates a new planning feature
 */
export const createPlanningFeature = async (
  planningSessionId: number,
  featureId: string,
  title: string,
  description?: string
): Promise<PlanningFeature> => {
  try {
    const result = await query(
      `
        INSERT INTO planning_features (
          planning_session_id, feature_id, title, description
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [planningSessionId, featureId, title, description]
    );

    logger.info('Planning feature created', {
      planningSessionId,
      featureId,
      title,
      featureDbId: result.rows[0].id
    });

    return result.rows[0] as PlanningFeature;
  } catch (error) {
    logger.error('Error creating planning feature', {
      error,
      planningSessionId,
      featureId,
      title
    });
    throw error;
  }
};

/**
 * Gets a planning feature by ID
 */
export const getPlanningFeature = async (featureId: number): Promise<PlanningFeature | null> => {
  try {
    const result = await query(
      'SELECT * FROM planning_features WHERE id = $1',
      [featureId]
    );

    if (result.rows.length === 0) {
      logger.warn('No planning feature found with ID', { featureId });
      return null;
    }

    return result.rows[0] as PlanningFeature;
  } catch (error) {
    logger.error('Error retrieving planning feature', { error, featureId });
    throw error;
  }
};

/**
 * Gets all planning features for a planning session
 */
export const getPlanningFeaturesBySession = async (
  planningSessionId: number
): Promise<PlanningFeature[]> => {
  try {
    const result = await query(
      'SELECT * FROM planning_features WHERE planning_session_id = $1 ORDER BY created_at',
      [planningSessionId]
    );

    return result.rows as PlanningFeature[];
  } catch (error) {
    logger.error('Error retrieving planning features', { error, planningSessionId });
    throw error;
  }
};

/**
 * Updates a planning feature
 */
export const updatePlanningFeature = async (
  featureId: number,
  updates: Partial<PlanningFeature>
): Promise<PlanningFeature | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.feature_id !== undefined) {
      updateFields.push(`feature_id = $${paramIndex}`);
      values.push(updates.feature_id);
      paramIndex++;
    }

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current feature
    if (updateFields.length === 1) { // Only updated_at
      return getPlanningFeature(featureId);
    }

    // Add the feature ID to the values array
    values.push(featureId);

    const result = await query(
      `
        UPDATE planning_features
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No planning feature found to update', { featureId });
      return null;
    }

    logger.info('Planning feature updated', { featureId });
    return result.rows[0] as PlanningFeature;
  } catch (error) {
    logger.error('Error updating planning feature', { error, featureId });
    throw error;
  }
};

/**
 * Deletes a planning feature
 */
export const deletePlanningFeature = async (featureId: number): Promise<boolean> => {
  try {
    // Start a transaction to delete the feature and all related stories
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Delete related planning_stories
      await client.query(
        'DELETE FROM planning_stories WHERE planning_feature_id = $1',
        [featureId]
      );

      // Delete the planning feature
      const result = await client.query(
        'DELETE FROM planning_features WHERE id = $1',
        [featureId]
      );

      await client.query('COMMIT');

      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        logger.info('Planning feature deleted', { featureId });
      } else {
        logger.warn('No planning feature found to delete', { featureId });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error deleting planning feature', { error, featureId });
    throw error;
  }
};

// Planning Story CRUD Operations

/**
 * Creates a new planning story
 */
export const createPlanningStory = async (
  planningFeatureId: number,
  storyId: string,
  title: string,
  description?: string
): Promise<PlanningStory> => {
  try {
    const result = await query(
      `
        INSERT INTO planning_stories (
          planning_feature_id, story_id, title, description
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [planningFeatureId, storyId, title, description]
    );

    logger.info('Planning story created', {
      planningFeatureId,
      storyId,
      title,
      storyDbId: result.rows[0].id
    });

    return result.rows[0] as PlanningStory;
  } catch (error) {
    logger.error('Error creating planning story', {
      error,
      planningFeatureId,
      storyId,
      title
    });
    throw error;
  }
};

/**
 * Gets a planning story by ID
 */
export const getPlanningStory = async (storyId: number): Promise<PlanningStory | null> => {
  try {
    const result = await query(
      'SELECT * FROM planning_stories WHERE id = $1',
      [storyId]
    );

    if (result.rows.length === 0) {
      logger.warn('No planning story found with ID', { storyId });
      return null;
    }

    return result.rows[0] as PlanningStory;
  } catch (error) {
    logger.error('Error retrieving planning story', { error, storyId });
    throw error;
  }
};

/**
 * Gets all planning stories for a planning feature
 */
export const getPlanningStoriesByFeature = async (
  planningFeatureId: number
): Promise<PlanningStory[]> => {
  try {
    const result = await query(
      'SELECT * FROM planning_stories WHERE planning_feature_id = $1 ORDER BY created_at',
      [planningFeatureId]
    );

    return result.rows as PlanningStory[];
  } catch (error) {
    logger.error('Error retrieving planning stories', { error, planningFeatureId });
    throw error;
  }
};

/**
 * Updates a planning story
 */
export const updatePlanningStory = async (
  storyId: number,
  updates: Partial<PlanningStory>
): Promise<PlanningStory | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.story_id !== undefined) {
      updateFields.push(`story_id = $${paramIndex}`);
      values.push(updates.story_id);
      paramIndex++;
    }

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current story
    if (updateFields.length === 1) { // Only updated_at
      return getPlanningStory(storyId);
    }

    // Add the story ID to the values array
    values.push(storyId);

    const result = await query(
      `
        UPDATE planning_stories
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No planning story found to update', { storyId });
      return null;
    }

    logger.info('Planning story updated', { storyId });
    return result.rows[0] as PlanningStory;
  } catch (error) {
    logger.error('Error updating planning story', { error, storyId });
    throw error;
  }
};

/**
 * Deletes a planning story
 */
export const deletePlanningStory = async (storyId: number): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM planning_stories WHERE id = $1',
      [storyId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('Planning story deleted', { storyId });
    } else {
      logger.warn('No planning story found to delete', { storyId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting planning story', { error, storyId });
    throw error;
  }
};

// Confluence Token CRUD Operations

/**
 * Stores Confluence OAuth tokens for an organization
 */
export const storeConfluenceToken = async (
  organizationId: string,
  accessToken: string,
  refreshToken: string,
  siteUrl: string,
  expiresAt: Date
): Promise<void> => {
  try {
    await query(
      `
        INSERT INTO confluence_tokens (organization_id, access_token, refresh_token, site_url, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (organization_id) DO UPDATE SET
          access_token = $2,
          refresh_token = $3,
          site_url = $4,
          expires_at = $5,
          updated_at = NOW()
      `,
      [organizationId, accessToken, refreshToken, siteUrl, expiresAt]
    );

    logger.info('Confluence tokens stored for organization', { organizationId });
  } catch (error) {
    logger.error('Error storing Confluence tokens', { error, organizationId });
    throw error;
  }
};

/**
 * Retrieves the Confluence token for an organization
 */
export const getConfluenceToken = async (organizationId: string): Promise<ConfluenceToken | null> => {
  try {
    const result = await query(
      'SELECT * FROM confluence_tokens WHERE organization_id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      logger.warn('No Confluence tokens found for organization', { organizationId });
      return null;
    }

    return result.rows[0] as ConfluenceToken;
  } catch (error) {
    logger.error('Error retrieving Confluence token', { error, organizationId });
    throw error;
  }
};

/**
 * Retrieves the Confluence access token for an organization
 */
export const getConfluenceAccessToken = async (organizationId: string): Promise<string | null> => {
  try {
    const token = await getConfluenceToken(organizationId);

    if (!token) {
      return null;
    }

    // Check if token is expired
    if (new Date() > new Date(token.expires_at)) {
      logger.warn('Confluence token expired for organization', { organizationId });
      // Token is expired, try to refresh it
      const { refreshConfluenceToken } = require('../auth/confluence-oauth');
      return await refreshConfluenceToken(organizationId);
    }

    return token.access_token;
  } catch (error) {
    logger.error('Error retrieving Confluence access token', { error, organizationId });
    throw error;
  }
};

/**
 * Deletes a Confluence token for an organization
 */
export const deleteConfluenceToken = async (organizationId: string): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM confluence_tokens WHERE organization_id = $1',
      [organizationId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('Confluence token deleted for organization', { organizationId });
    } else {
      logger.warn('No Confluence token found to delete for organization', { organizationId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting Confluence token', { error, organizationId });
    throw error;
  }
};

// Planning Enabler CRUD Operations

/**
 * Creates a new planning enabler
 */
export const createPlanningEnabler = async (
  planningSessionId: number,
  enablerId: string,
  title: string,
  enablerType: string,
  description?: string
): Promise<PlanningEnabler> => {
  try {
    const result = await query(
      `
        INSERT INTO planning_enablers (
          planning_session_id, enabler_id, title, enabler_type, description
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [planningSessionId, enablerId, title, enablerType, description]
    );

    logger.info('Planning enabler created', {
      planningSessionId,
      enablerId,
      title,
      enablerType,
      enablerDbId: result.rows[0].id
    });

    return result.rows[0] as PlanningEnabler;
  } catch (error) {
    logger.error('Error creating planning enabler', {
      error,
      planningSessionId,
      enablerId,
      title,
      enablerType
    });
    throw error;
  }
};

/**
 * Gets a planning enabler by ID
 */
export const getPlanningEnabler = async (enablerId: number): Promise<PlanningEnabler | null> => {
  try {
    const result = await query(
      'SELECT * FROM planning_enablers WHERE id = $1',
      [enablerId]
    );

    if (result.rows.length === 0) {
      logger.warn('No planning enabler found with ID', { enablerId });
      return null;
    }

    return result.rows[0] as PlanningEnabler;
  } catch (error) {
    logger.error('Error retrieving planning enabler', { error, enablerId });
    throw error;
  }
};

/**
 * Gets all planning enablers for a planning session
 */
export const getPlanningEnablersBySession = async (
  planningSessionId: number
): Promise<PlanningEnabler[]> => {
  try {
    const result = await query(
      'SELECT * FROM planning_enablers WHERE planning_session_id = $1 ORDER BY created_at',
      [planningSessionId]
    );

    return result.rows as PlanningEnabler[];
  } catch (error) {
    logger.error('Error retrieving planning enablers', { error, planningSessionId });
    throw error;
  }
};

/**
 * Updates a planning enabler
 */
export const updatePlanningEnabler = async (
  enablerId: number,
  updates: Partial<PlanningEnabler>
): Promise<PlanningEnabler | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.enabler_id !== undefined) {
      updateFields.push(`enabler_id = $${paramIndex}`);
      values.push(updates.enabler_id);
      paramIndex++;
    }

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }

    if (updates.enabler_type !== undefined) {
      updateFields.push(`enabler_type = $${paramIndex}`);
      values.push(updates.enabler_type);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current enabler
    if (updateFields.length === 1) { // Only updated_at
      return getPlanningEnabler(enablerId);
    }

    // Add the enabler ID to the values array
    values.push(enablerId);

    const result = await query(
      `
        UPDATE planning_enablers
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No planning enabler found to update', { enablerId });
      return null;
    }

    logger.info('Planning enabler updated', { enablerId });
    return result.rows[0] as PlanningEnabler;
  } catch (error) {
    logger.error('Error updating planning enabler', { error, enablerId });
    throw error;
  }
};

/**
 * Deletes a planning enabler
 */
export const deletePlanningEnabler = async (enablerId: number): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM planning_enablers WHERE id = $1',
      [enablerId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('Planning enabler deleted', { enablerId });
    } else {
      logger.warn('No planning enabler found to delete', { enablerId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting planning enabler', { error, enablerId });
    throw error;
  }
};

// Program Increment CRUD Operations

/**
 * Creates a new program increment
 */
export const createProgramIncrement = async (
  organizationId: string,
  piId: string,
  name: string,
  startDate: Date,
  endDate: Date,
  description?: string,
  status: string = 'planning'
): Promise<ProgramIncrementDB> => {
  try {
    const result = await query(
      `
        INSERT INTO program_increments (
          organization_id, pi_id, name, start_date, end_date, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [organizationId, piId, name, startDate, endDate, description, status]
    );

    logger.info('Program increment created', {
      organizationId,
      piId,
      name
    });

    return result.rows[0] as ProgramIncrementDB;
  } catch (error) {
    logger.error('Error creating program increment', {
      error,
      organizationId,
      piId,
      name
    });
    throw error;
  }
};

/**
 * Gets a program increment by ID
 */
export const getProgramIncrement = async (incrementId: number): Promise<ProgramIncrementDB | null> => {
  try {
    const result = await query(
      'SELECT * FROM program_increments WHERE id = $1',
      [incrementId]
    );

    if (result.rows.length === 0) {
      logger.warn('No program increment found with ID', { incrementId });
      return null;
    }

    return result.rows[0] as ProgramIncrementDB;
  } catch (error) {
    logger.error('Error retrieving program increment', { error, incrementId });
    throw error;
  }
};

/**
 * Gets a program increment by Linear ID
 */
export const getProgramIncrementByPiId = async (piId: string): Promise<ProgramIncrementDB | null> => {
  try {
    const result = await query(
      'SELECT * FROM program_increments WHERE pi_id = $1',
      [piId]
    );

    if (result.rows.length === 0) {
      logger.warn('No program increment found with PI ID', { piId });
      return null;
    }

    return result.rows[0] as ProgramIncrementDB;
  } catch (error) {
    logger.error('Error retrieving program increment by PI ID', { error, piId });
    throw error;
  }
};

/**
 * Gets all program increments for an organization
 */
export const getProgramIncrementsByOrganization = async (
  organizationId: string
): Promise<ProgramIncrementDB[]> => {
  try {
    const result = await query(
      'SELECT * FROM program_increments WHERE organization_id = $1 ORDER BY start_date DESC',
      [organizationId]
    );

    return result.rows as ProgramIncrementDB[];
  } catch (error) {
    logger.error('Error retrieving program increments', { error, organizationId });
    throw error;
  }
};

/**
 * Gets the current program increment for an organization
 */
export const getCurrentProgramIncrement = async (
  organizationId: string
): Promise<ProgramIncrementDB | null> => {
  try {
    const now = new Date();
    const result = await query(
      'SELECT * FROM program_increments WHERE organization_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1',
      [organizationId, now]
    );

    if (result.rows.length === 0) {
      logger.warn('No current program increment found for organization', { organizationId });
      return null;
    }

    return result.rows[0] as ProgramIncrementDB;
  } catch (error) {
    logger.error('Error retrieving current program increment', { error, organizationId });
    throw error;
  }
};

/**
 * Updates a program increment
 */
export const updateProgramIncrement = async (
  incrementId: number,
  updates: Partial<ProgramIncrementDB>
): Promise<ProgramIncrementDB | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Add each field to the update query if it exists in the updates object
    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex}`);
      values.push(updates.start_date);
      paramIndex++;
    }

    if (updates.end_date !== undefined) {
      updateFields.push(`end_date = $${paramIndex}`);
      values.push(updates.end_date);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current program increment
    if (updateFields.length === 1) { // Only updated_at
      return getProgramIncrement(incrementId);
    }

    // Add the increment ID to the values array
    values.push(incrementId);

    const result = await query(
      `
        UPDATE program_increments
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No program increment found to update', { incrementId });
      return null;
    }

    logger.info('Program increment updated', { incrementId });
    return result.rows[0] as ProgramIncrementDB;
  } catch (error) {
    logger.error('Error updating program increment', { error, incrementId });
    throw error;
  }
};

/**
 * Deletes a program increment
 */
export const deleteProgramIncrement = async (incrementId: number): Promise<boolean> => {
  try {
    // Start a transaction to delete the increment and all related records
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Delete related PI features
      await client.query(
        'DELETE FROM pi_features WHERE program_increment_id = $1',
        [incrementId]
      );

      // Delete related PI objectives
      await client.query(
        'DELETE FROM pi_objectives WHERE program_increment_id = $1',
        [incrementId]
      );

      // Delete related PI risks
      await client.query(
        'DELETE FROM pi_risks WHERE program_increment_id = $1',
        [incrementId]
      );

      // Delete the program increment
      const result = await client.query(
        'DELETE FROM program_increments WHERE id = $1',
        [incrementId]
      );

      await client.query('COMMIT');

      const deleted = (result.rowCount ?? 0) > 0;
      if (deleted) {
        logger.info('Program increment deleted', { incrementId });
      } else {
        logger.warn('No program increment found to delete', { incrementId });
      }

      return deleted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error deleting program increment', { error, incrementId });
    throw error;
  }
};

// PI Feature CRUD Operations

/**
 * Creates a new PI feature
 */
export const createPIFeature = async (
  programIncrementId: number,
  featureId: string,
  teamId: string,
  status: string = 'planned',
  confidence: number = 3
): Promise<PIFeatureDB> => {
  try {
    const result = await query(
      `
        INSERT INTO pi_features (
          program_increment_id, feature_id, team_id, status, confidence
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [programIncrementId, featureId, teamId, status, confidence]
    );

    logger.info('PI feature created', {
      programIncrementId,
      featureId,
      teamId
    });

    return result.rows[0] as PIFeatureDB;
  } catch (error) {
    logger.error('Error creating PI feature', {
      error,
      programIncrementId,
      featureId,
      teamId
    });
    throw error;
  }
};

/**
 * Gets a PI feature by ID
 */
export const getPIFeature = async (featureId: number): Promise<PIFeatureDB | null> => {
  try {
    const result = await query(
      'SELECT * FROM pi_features WHERE id = $1',
      [featureId]
    );

    if (result.rows.length === 0) {
      logger.warn('No PI feature found with ID', { featureId });
      return null;
    }

    return result.rows[0] as PIFeatureDB;
  } catch (error) {
    logger.error('Error retrieving PI feature', { error, featureId });
    throw error;
  }
};

/**
 * Gets all PI features for a program increment
 */
export const getPIFeaturesByProgramIncrement = async (
  programIncrementId: number
): Promise<PIFeatureDB[]> => {
  try {
    const result = await query(
      'SELECT * FROM pi_features WHERE program_increment_id = $1',
      [programIncrementId]
    );

    return result.rows as PIFeatureDB[];
  } catch (error) {
    logger.error('Error retrieving PI features', { error, programIncrementId });
    throw error;
  }
};

/**
 * Updates a PI feature
 */
export const updatePIFeature = async (
  featureId: number,
  updates: Partial<PIFeatureDB>
): Promise<PIFeatureDB | null> => {
  try {
    // Build the SET clause dynamically based on the provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Add each field to the update query if it exists in the updates object
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.confidence !== undefined) {
      updateFields.push(`confidence = $${paramIndex}`);
      values.push(updates.confidence);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // If no fields to update, return the current PI feature
    if (updateFields.length === 1) { // Only updated_at
      return getPIFeature(featureId);
    }

    // Add the feature ID to the values array
    values.push(featureId);

    const result = await query(
      `
        UPDATE pi_features
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      logger.warn('No PI feature found to update', { featureId });
      return null;
    }

    logger.info('PI feature updated', { featureId });
    return result.rows[0] as PIFeatureDB;
  } catch (error) {
    logger.error('Error updating PI feature', { error, featureId });
    throw error;
  }
};

/**
 * Deletes a PI feature
 */
export const deletePIFeature = async (featureId: number): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM pi_features WHERE id = $1',
      [featureId]
    );

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info('PI feature deleted', { featureId });
    } else {
      logger.warn('No PI feature found to delete', { featureId });
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting PI feature', { error, featureId });
    throw error;
  }
};

/**
 * Gets a database interface for testing purposes
 * This function is primarily used by tests to mock database operations
 */
export const getDatabase = async (): Promise<DatabaseInterface> => {
  return {
    async get(sql: string, params: any[] = []): Promise<any> {
      const result = await query(sql, params);
      return result.rows.length > 0 ? result.rows[0] : null;
    },

    async all(sql: string, params: any[] = []): Promise<any[]> {
      const result = await query(sql, params);
      return result.rows;
    },

    async run(sql: string, params: any[] = []): Promise<any> {
      const result = await query(sql, params);
      return result;
    }
  };
};
