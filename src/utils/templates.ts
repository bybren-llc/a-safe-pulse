/**
 * Response templates for consistent agent communication
 */

/**
 * Creates a response for when the agent is mentioned
 */
export const createMentionResponse = (username: string): string => {
  return `Hi @${username}, I'm the SAFe Pulse Agent. I can help with SAFe planning activities. How can I assist you today?`;
};

/**
 * Creates a response for when the agent is assigned an issue
 */
export const createAssignmentResponse = (username: string, issueId: string): string => {
  return `Hi @${username}, I've been assigned to issue ${issueId}. I'll start working on this right away and update you with my progress.`;
};

/**
 * Creates a response for when the agent has completed planning
 */
export const createPlanningCompleteResponse = (
  username: string,
  epicId: string,
  featureCount: number
): string => {
  return `Hi @${username}, I've completed the planning process for epic ${epicId}. I've created ${featureCount} features based on the documentation. Please review and let me know if you need any adjustments.`;
};

/**
 * Creates a response for when the agent encounters an error
 */
export const createErrorResponse = (username: string, errorMessage: string): string => {
  return `Hi @${username}, I encountered an error while processing your request: ${errorMessage}. Please check the inputs and try again, or contact the development team for assistance.`;
};

/**
 * Creates a response for when the agent needs more information
 */
export const createMoreInfoResponse = (username: string, missingInfo: string): string => {
  return `Hi @${username}, I need more information to complete this task. Specifically, I need: ${missingInfo}. Could you please provide this information?`;
};

/**
 * Creates a response for when the agent has started working on a task
 */
export const createStartedResponse = (username: string): string => {
  return `Hi @${username}, I've started working on this task. I'll update you when I have more information or when the task is complete.`;
};

/**
 * Creates a response for when the agent has updated an issue
 */
export const createUpdateResponse = (username: string, changes: string[]): string => {
  const changesList = changes.map(change => `- ${change}`).join('\n');
  return `Hi @${username}, I've made the following updates:\n\n${changesList}\n\nPlease let me know if you need any further changes.`;
};
