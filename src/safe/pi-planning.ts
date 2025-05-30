/**
 * Program Increment (PI) Planning implementation
 *
 * This module handles PI planning activities in Linear following SAFe methodology.
 */
import { LinearClient, Cycle, Issue } from '@linear/sdk';
import { IssueRelationType } from '@linear/sdk/dist/_generated_documents';
import * as logger from '../utils/logger';
import { ProgramIncrement, PIFeature, PIIteration, PIObjective, PIRisk } from './pi-model';
import { SAFeLinearImplementation } from './safe_linear_implementation';

/**
 * PI Planning Manager
 *
 * Manages Program Increment (PI) planning activities in Linear following SAFe methodology.
 * This includes creating and managing Program Increments, assigning features to PIs,
 * tracking PI progress, and managing PI iterations, objectives, and risks.
 */
export class PIManager {
  private linearClient: LinearClient;
  private safeImplementation: SAFeLinearImplementation;

  /**
   * Creates a new PIManager instance
   *
   * @param accessToken - Linear API access token
   */
  constructor(accessToken: string) {
    this.linearClient = new LinearClient({ accessToken });
    this.safeImplementation = new SAFeLinearImplementation(accessToken);
  }

  /**
   * Creates a Program Increment in Linear
   *
   * @param teamId - ID of the team the PI belongs to
   * @param name - Name of the Program Increment (e.g., "PI-2023-Q1")
   * @param startDate - Start date of the Program Increment
   * @param endDate - End date of the Program Increment
   * @param description - Optional description of the Program Increment
   * @returns The created Program Increment
   */
  async createProgramIncrement(
    teamId: string,
    name: string,
    startDate: Date,
    endDate: Date,
    description?: string
  ): Promise<ProgramIncrement> {
    try {
      // Create a cycle in Linear to represent the PI
      const cycle = await this.linearClient.createCycle({
        teamId,
        name: `PI-${name}`,
        description,
        startsAt: startDate,
        endsAt: endDate
      });

      if (!cycle.success || !cycle.cycle) {
        throw new Error('Failed to create Program Increment');
      }

      const cycleData = await cycle.cycle;
      // Create a PI object
      const pi: ProgramIncrement = {
        id: cycleData.id,
        name: cycleData.name || 'Unnamed PI',
        startDate: new Date(cycleData.startsAt),
        endDate: new Date(cycleData.endsAt),
        description: cycleData.description || undefined,
        features: [],
        status: this.getPIStatus(cycleData)
      };

      logger.info('Created Program Increment', {
        piId: pi.id,
        name: pi.name
      });

      return pi;
    } catch (error) {
      logger.error('Error creating Program Increment', { error, name });
      throw error;
    }
  }

  /**
   * Assigns features to a Program Increment
   *
   * @param piId - ID of the Program Increment
   * @param featureIds - IDs of the features to assign
   * @returns Array of PIFeature objects representing the assigned features
   */
  async assignFeaturesToPI(
    piId: string,
    featureIds: string[]
  ): Promise<PIFeature[]> {
    try {
      const results: PIFeature[] = [];

      for (const featureId of featureIds) {
        // Get the feature to determine its team
        const feature = await this.linearClient.issue(featureId);

        if (!feature) {
          logger.warn(`Feature ${featureId} not found`);
          continue;
        }

        // Assign the feature to the PI in Linear
        const response = await this.linearClient.updateIssue(featureId, {
          cycleId: piId
        });

        if (!response.success) {
          logger.warn(`Failed to assign feature ${featureId} to PI ${piId}`);
          continue;
        }

        // Create a PIFeature object
        const team = feature.team ? await feature.team : null;
        const state = feature.state ? await feature.state : null;

        const piFeature: PIFeature = {
          id: `${piId}-${featureId}`,
          piId,
          featureId,
          teamId: team?.id || 'unknown',
          status: this.getFeatureStatus(state?.name || 'unknown'),
          confidence: 3, // Default confidence
          dependencies: []
        };

        results.push(piFeature);
        logger.info('Assigned feature to PI', { featureId, piId });
      }

      return results;
    } catch (error) {
      logger.error('Error assigning features to PI', { error, piId, featureIds });
      throw error;
    }
  }

  /**
   * Gets all Program Increments for a team
   *
   * @param teamId - ID of the team
   * @returns Array of Program Increments
   */
  async getProgramIncrements(teamId: string): Promise<ProgramIncrement[]> {
    try {
      // Get all cycles that represent PIs
      const cycles = await this.linearClient.cycles({
        filter: {
          team: { id: { eq: teamId } },
          name: { startsWith: 'PI-' }
        }
      });

      // Convert cycles to PIs
      const pis: ProgramIncrement[] = await Promise.all(
        cycles.nodes.map(async cycle => {
          // Get features assigned to this PI
          const features = await this.getFeaturesForPI(cycle.id);

          return {
            id: cycle.id,
            name: cycle.name || 'Unnamed PI',
            startDate: cycle.startsAt ? new Date(cycle.startsAt) : new Date(),
            endDate: cycle.endsAt ? new Date(cycle.endsAt) : new Date(),
            description: cycle.description || undefined,
            features: features.map(f => f.featureId),
            status: this.getPIStatus(cycle)
          };
        })
      );

      return pis;
    } catch (error) {
      logger.error('Error getting Program Increments', { error, teamId });
      throw error;
    }
  }

  /**
   * Gets the current Program Increment for a team
   *
   * @param teamId - ID of the team
   * @returns The current Program Increment, or null if none is active
   */
  async getCurrentProgramIncrement(teamId: string): Promise<ProgramIncrement | null> {
    try {
      const now = new Date();

      // Get all cycles that represent PIs and are currently active
      const cycles = await this.linearClient.cycles({
        filter: {
          team: { id: { eq: teamId } },
          name: { startsWith: 'PI-' },
          startsAt: { lte: now },
          endsAt: { gte: now }
        }
      });

      if (cycles.nodes.length === 0) {
        return null;
      }

      const cycle = cycles.nodes[0];

      // Get features assigned to this PI
      const features = await this.getFeaturesForPI(cycle.id);

      // Convert cycle to PI
      const pi: ProgramIncrement = {
        id: cycle.id,
        name: cycle.name || 'Unnamed PI',
        startDate: new Date(cycle.startsAt),
        endDate: new Date(cycle.endsAt),
        description: cycle.description || undefined,
        features: features.map(f => f.featureId),
        status: this.getPIStatus(cycle)
      };

      return pi;
    } catch (error) {
      logger.error('Error getting current Program Increment', { error, teamId });
      throw error;
    }
  }

  /**
   * Gets all features assigned to a Program Increment
   *
   * @param piId - ID of the Program Increment
   * @returns Array of PIFeature objects
   */
  async getFeaturesForPI(piId: string): Promise<PIFeature[]> {
    try {
      // Get all issues assigned to this cycle that are features
      const issues = await this.linearClient.issues({
        filter: {
          cycle: { id: { eq: piId } },
          labels: { name: { eq: 'Feature' } }
        }
      });

      // Convert issues to PIFeatures
      const piFeatures: PIFeature[] = await Promise.all(
        issues.nodes.map(async issue => {
          const team = issue.team ? await issue.team : null;
          const state = issue.state ? await issue.state : null;

          return {
            id: `${piId}-${issue.id}`,
            piId,
            featureId: issue.id,
            teamId: team?.id || 'unknown',
            status: this.getFeatureStatus(state?.name || 'unknown'),
            confidence: 3, // Default confidence
            dependencies: [] // Dependencies would need to be extracted from issue relationships
          };
        })
      );

      return piFeatures;
    } catch (error) {
      logger.error('Error getting features for PI', { error, piId });
      throw error;
    }
  }

  /**
   * Creates iterations for a Program Increment
   *
   * @param piId - ID of the Program Increment
   * @param teamId - ID of the team
   * @param iterationCount - Number of iterations to create (default: 5)
   * @returns Array of created iterations
   */
  async createPIIterations(
    piId: string,
    teamId: string,
    iterationCount: number = 5
  ): Promise<PIIteration[]> {
    try {
      // Get the PI to determine its start and end dates
      const pi = await this.linearClient.cycle(piId);

      if (!pi) {
        throw new Error(`Program Increment ${piId} not found`);
      }

      const piStartDate = new Date(pi.startsAt);
      const piEndDate = new Date(pi.endsAt);

      // Calculate the duration of each iteration
      const piDurationMs = piEndDate.getTime() - piStartDate.getTime();
      const iterationDurationMs = piDurationMs / iterationCount;

      const iterations: PIIteration[] = [];

      // Create iterations
      for (let i = 0; i < iterationCount; i++) {
        const isIP = i === iterationCount - 1; // Last iteration is IP
        const iterationStartDate = new Date(piStartDate.getTime() + i * iterationDurationMs);
        const iterationEndDate = new Date(piStartDate.getTime() + (i + 1) * iterationDurationMs);

        // Create a cycle in Linear to represent the iteration
        const cycle = await this.linearClient.createCycle({
          teamId,
          name: `${pi.name}-I${i + 1}${isIP ? '-IP' : ''}`,
          description: isIP ? 'Innovation and Planning Iteration' : `Iteration ${i + 1}`,
          startsAt: iterationStartDate,
          endsAt: iterationEndDate
        });

        if (!cycle.success || !cycle.cycle) {
          logger.warn(`Failed to create iteration ${i + 1} for PI ${piId}`);
          continue;
        }

        const cycleData = await cycle.cycle;
        // Create a PIIteration object
        const iteration: PIIteration = {
          id: cycleData.id,
          piId,
          number: i + 1,
          startDate: iterationStartDate,
          endDate: iterationEndDate,
          isInnovationAndPlanning: isIP,
          stories: []
        };

        iterations.push(iteration);
        logger.info('Created PI Iteration', {
          piId,
          iterationId: iteration.id,
          number: iteration.number
        });
      }

      return iterations;
    } catch (error) {
      logger.error('Error creating PI Iterations', { error, piId, teamId });
      throw error;
    }
  }

  /**
   * Creates a PI Objective
   *
   * @param piId - ID of the Program Increment
   * @param teamId - ID of the team
   * @param description - Description of the objective
   * @param businessValue - Business value of the objective (1-10)
   * @param featureIds - IDs of features associated with this objective
   * @returns The created PI Objective
   */
  async createPIObjective(
    piId: string,
    teamId: string,
    description: string,
    businessValue: number,
    featureIds: string[] = []
  ): Promise<PIObjective> {
    try {
      // In Linear, we'll represent a PI Objective as an issue with a label
      const labels = await this.linearClient.issueLabels();
      const objectiveLabel = labels.nodes.find(label => label.name === 'PI Objective');

      let objectiveLabelId: string;

      if (!objectiveLabel) {
        // Create the label if it doesn't exist
        const newLabel = await this.linearClient.createIssueLabel({
          name: 'PI Objective',
          color: '#F2C94C'
        });

        if (!newLabel.success || !newLabel.issueLabel) {
          throw new Error('Failed to create PI Objective label');
        }

        const issueLabel = await newLabel.issueLabel;
        objectiveLabelId = issueLabel.id;
      } else {
        objectiveLabelId = objectiveLabel.id;
      }

      // Get the PI to include its name in the title
      const pi = await this.linearClient.cycle(piId);

      if (!pi) {
        throw new Error(`Program Increment ${piId} not found`);
      }

      // Create the objective as an issue
      const response = await this.linearClient.createIssue({
        teamId,
        title: `[OBJECTIVE] ${description}`,
        description: `PI Objective for ${pi.name}\n\nBusiness Value: ${businessValue}/10`,
        labelIds: [objectiveLabelId],
        cycleId: piId
      });

      if (!response.success || !response.issue) {
        throw new Error('Failed to create PI Objective');
      }

      const issue = await response.issue;
      // Create a PIObjective object
      const objective: PIObjective = {
        id: issue.id,
        piId,
        teamId,
        description,
        businessValue,
        status: 'planned',
        features: featureIds
      };

      // Assign features to the objective
      if (featureIds.length > 0) {
        for (const featureId of featureIds) {
          // Use Linear SDK v2.6.0 enum constant for issue relationship type
          await this.linearClient.createIssueRelation({
            issueId: issue.id,
            relatedIssueId: featureId,
            type: IssueRelationType.Related
          });
        }
      }

      logger.info('Created PI Objective', {
        piId,
        objectiveId: objective.id,
        description
      });

      return objective;
    } catch (error) {
      logger.error('Error creating PI Objective', { error, piId, teamId, description });
      throw error;
    }
  }

  /**
   * Creates a PI Risk
   *
   * @param piId - ID of the Program Increment
   * @param teamId - ID of the team
   * @param description - Description of the risk
   * @param impact - Impact of the risk (1-5)
   * @param likelihood - Likelihood of the risk occurring (1-5)
   * @param mitigationPlan - Optional mitigation plan for the risk
   * @returns The created PI Risk
   */
  async createPIRisk(
    piId: string,
    teamId: string,
    description: string,
    impact: 1 | 2 | 3 | 4 | 5,
    likelihood: 1 | 2 | 3 | 4 | 5,
    mitigationPlan?: string
  ): Promise<PIRisk> {
    try {
      // In Linear, we'll represent a PI Risk as an issue with a label
      const labels = await this.linearClient.issueLabels();
      const riskLabel = labels.nodes.find(label => label.name === 'PI Risk');

      let riskLabelId: string;

      if (!riskLabel) {
        // Create the label if it doesn't exist
        const newLabel = await this.linearClient.createIssueLabel({
          name: 'PI Risk',
          color: '#EB5757'
        });

        if (!newLabel.success || !newLabel.issueLabel) {
          throw new Error('Failed to create PI Risk label');
        }

        const issueLabel = await newLabel.issueLabel;
        riskLabelId = issueLabel.id;
      } else {
        riskLabelId = riskLabel.id;
      }

      // Get the PI to include its name in the title
      const pi = await this.linearClient.cycle(piId);

      if (!pi) {
        throw new Error(`Program Increment ${piId} not found`);
      }

      // Calculate risk score
      const riskScore = impact * likelihood;

      // Determine priority based on risk score
      let priority = 0; // No priority
      if (riskScore >= 20) {
        priority = 1; // Urgent
      } else if (riskScore >= 12) {
        priority = 2; // High
      } else if (riskScore >= 6) {
        priority = 3; // Medium
      } else {
        priority = 4; // Low
      }

      // Create the risk as an issue
      const response = await this.linearClient.createIssue({
        teamId,
        title: `[RISK] ${description}`,
        description: `PI Risk for ${pi.name}\n\nImpact: ${impact}/5\nLikelihood: ${likelihood}/5\nRisk Score: ${riskScore}/25\n\n${mitigationPlan ? `Mitigation Plan:\n${mitigationPlan}` : ''}`,
        labelIds: [riskLabelId],
        cycleId: piId,
        priority
      });

      if (!response.success || !response.issue) {
        throw new Error('Failed to create PI Risk');
      }

      const issue = await response.issue;
      // Create a PIRisk object
      const risk: PIRisk = {
        id: issue.id,
        piId,
        description,
        impact,
        likelihood,
        status: 'identified',
        mitigationPlan
      };

      logger.info('Created PI Risk', {
        piId,
        riskId: risk.id,
        description
      });

      return risk;
    } catch (error) {
      logger.error('Error creating PI Risk', { error, piId, teamId, description });
      throw error;
    }
  }

  /**
   * Gets the status of a Program Increment based on its dates
   *
   * @param cycle - The Linear cycle representing the PI
   * @returns The status of the PI
   */
  private getPIStatus(cycle: Cycle): 'planning' | 'execution' | 'completed' {
    const now = new Date();
    const startDate = new Date(cycle.startsAt);
    const endDate = new Date(cycle.endsAt);

    if (now < startDate) {
      return 'planning';
    } else if (now <= endDate) {
      return 'execution';
    } else {
      return 'completed';
    }
  }

  /**
   * Maps a Linear state name to a PI feature status
   *
   * @param stateName - The name of the Linear state
   * @returns The corresponding PI feature status
   */
  private getFeatureStatus(stateName: string): 'planned' | 'in-progress' | 'completed' {
    // Map Linear state names to PI feature statuses
    const stateMap: Record<string, 'planned' | 'in-progress' | 'completed'> = {
      'Backlog': 'planned',
      'Todo': 'planned',
      'In Progress': 'in-progress',
      'In Review': 'in-progress',
      'Done': 'completed',
      'Canceled': 'completed',
      'Duplicate': 'completed'
    };

    return stateMap[stateName] || 'planned';
  }
}

/**
 * @deprecated Use PIManager instead
 */
export class PIPlanningService {
  private linearClient: LinearClient;

  constructor(accessToken: string) {
    this.linearClient = new LinearClient({ accessToken });
    logger.warn('PIPlanningService is deprecated. Use PIManager instead.');
  }

  /**
   * Creates a Program Increment in Linear
   * @deprecated Use PIManager.createProgramIncrement instead
   */
  async createProgramIncrement(
    teamId: string,
    name: string,
    startDate: Date,
    endDate: Date,
    description: string
  ) {
    try {
      // In Linear SDK v2.6.0, we'll represent a Program Increment as a cycle
      const response = await this.linearClient.createCycle({
        teamId,
        name,
        description,
        startsAt: startDate,
        endsAt: endDate
      });

      if (!response.success || !response.cycle) {
        throw new Error('Failed to create Program Increment');
      }

      const cycle = await response.cycle;
      logger.info('Created Program Increment', {
        piId: cycle.id,
        name
      });

      return cycle;
    } catch (error) {
      logger.error('Error creating Program Increment', { error, name });
      throw error;
    }
  }

  /**
   * Assigns features to a Program Increment
   * @deprecated Use PIManager.assignFeaturesToPI instead
   */
  async assignFeaturesToPI(
    piId: string,
    featureIds: string[]
  ) {
    try {
      const results = [];

      for (const featureId of featureIds) {
        const response = await this.linearClient.updateIssue(featureId, {
          cycleId: piId
        });

        if (!response.success) {
          logger.warn(`Failed to assign feature ${featureId} to PI ${piId}`);
        } else {
          const issue = await response.issue;
          results.push(issue);
          logger.info('Assigned feature to PI', { featureId, piId });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error assigning features to PI', { error, piId, featureIds });
      throw error;
    }
  }

  /**
   * Gets all Program Increments
   * @deprecated Use PIManager.getProgramIncrements instead
   */
  async getProgramIncrements() {
    try {
      const response = await this.linearClient.cycles();

      return response.nodes;
    } catch (error) {
      logger.error('Error getting Program Increments', { error });
      throw error;
    }
  }

  /**
   * Gets the current Program Increment
   * @deprecated Use PIManager.getCurrentProgramIncrement instead
   */
  async getCurrentProgramIncrement() {
    try {
      const now = new Date();
      const cycles = await this.linearClient.cycles();

      // Find the cycle with the closest end date in the future
      const currentPI = cycles.nodes
        .filter((cycle: any) => new Date(cycle.endsAt) >= now)
        .sort((a: any, b: any) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0];

      return currentPI;
    } catch (error) {
      logger.error('Error getting current Program Increment', { error });
      throw error;
    }
  }
}
