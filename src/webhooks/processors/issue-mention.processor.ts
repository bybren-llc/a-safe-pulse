/**
 * Issue Mention Processor
 * 
 * Handles webhook events when @saafepulse is mentioned in a Linear issue description.
 * This is the foundation for all agent interactions.
 */

import { BaseWebhookProcessor, AppUserNotification } from './base-processor';
import * as logger from '../../utils/logger';

/**
 * Processor for handling issue mention events
 */
export class IssueMentionProcessor extends BaseWebhookProcessor {
  /**
   * Process an issue mention notification
   * 
   * @param notification The notification payload from Linear
   */
  async process(notification: AppUserNotification): Promise<void> {
    const { issue, actor } = notification.notification;

    if (!issue) {
      logger.warn('Issue mention notification missing issue data');
      return;
    }

    logger.info('Processing issue mention', {
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      issueTitle: issue.title,
      actorName: actor?.name
    });

    try {
      // Extract mention text from issue description
      const mentionText = issue.description ? this.extractMentionText(issue.description) : null;

      // Create appropriate response based on mention context
      const response = this.generateResponse(
        actor?.name || 'there',
        issue,
        mentionText
      );

      // Send response to Linear as a comment
      await this.createLinearComment(issue.id, response);

      // Send notification to Slack
      await this.notifySlack(
        'issue_mention',
        `Issue Mention: ${issue.identifier}`,
        `@saafepulse mentioned in "${issue.title}" by ${actor?.name || 'Unknown User'}`,
        issue.url,
        actor?.name
      );

      logger.info('Successfully processed issue mention', {
        issueId: issue.id,
        responseLength: response.length
      });
    } catch (error) {
      logger.error('Failed to process issue mention', {
        error: (error as Error).message,
        issueId: issue.id
      });

      // Try to send error notification to Slack
      await this.notifySlack(
        'issue_mention_error',
        `Error Processing Issue Mention: ${issue.identifier}`,
        `Failed to process mention: ${(error as Error).message}`,
        issue.url,
        'System'
      );

      throw error;
    }
  }

  /**
   * Generates an appropriate response based on the mention context
   * 
   * @param username The username of the person who mentioned the agent
   * @param issue The Linear issue object
   * @param mentionText The text after @saafepulse mention
   * @returns The response message
   */
  private generateResponse(
    username: string,
    issue: {
      id: string;
      identifier: string;
      title: string;
      description?: string;
      state?: {
        name: string;
        type: string;
      };
      team?: {
        key: string;
        name: string;
      };
    },
    mentionText: string | null
  ): string {
    // Professional greeting
    let response = `👋 Hello @${username}!\n\n`;
    response += `I'm SAFe PULSE, your AI-powered planning assistant. `;
    response += `I see you've mentioned me in **${issue.identifier}: ${issue.title}**.\n\n`;

    // Context-aware response based on issue state
    if (issue.state?.type === 'backlog' || issue.state?.type === 'unstarted') {
      response += `This issue is currently in **${issue.state.name}** status. `;
      response += `I can help you with:\n\n`;
      response += `• 📋 **Planning and estimation** - Break down complex work\n`;
      response += `• 🔍 **Dependency analysis** - Identify blockers and relationships\n`;
      response += `• 📊 **SAFe alignment** - Ensure proper hierarchy and workflow\n`;
      response += `• 🎯 **Story decomposition** - Split large stories into manageable pieces\n\n`;
    } else if (issue.state?.type === 'started') {
      response += `I notice this issue is already **${issue.state.name}**. `;
      response += `I can assist with:\n\n`;
      response += `• 📈 **Progress tracking** - Monitor velocity and blockers\n`;
      response += `• 🔄 **Scope adjustments** - Handle changes efficiently\n`;
      response += `• 📝 **Documentation** - Keep everyone aligned\n\n`;
    }

    // Analyze mention text if provided
    if (mentionText) {
      response += `I see you mentioned: "_${mentionText}_"\n\n`;
      
      // Detect potential commands (preparation for Phase 2)
      if (mentionText.toLowerCase().includes('help')) {
        response += this.getHelpText();
      } else if (mentionText.toLowerCase().includes('plan')) {
        response += `I'll help you plan this work! In the next update, I'll be able to:\n`;
        response += `• Analyze the issue requirements\n`;
        response += `• Create a detailed implementation plan\n`;
        response += `• Break down into subtasks if needed\n\n`;
        response += `_Full planning capabilities coming soon!_`;
      } else if (mentionText.toLowerCase().includes('decompose') || mentionText.toLowerCase().includes('break down')) {
        response += `Story decomposition is one of my specialties! Soon I'll be able to:\n`;
        response += `• Analyze story complexity\n`;
        response += `• Suggest optimal splits (≤5 points each)\n`;
        response += `• Create subtasks automatically\n\n`;
        response += `_Decomposition features arriving shortly!_`;
      } else {
        response += `I'm still learning to understand natural language commands. `;
        response += `For now, I'm acknowledging your mention and letting the team know.\n\n`;
      }
    } else {
      response += this.getHelpText();
    }

    // Professional closing
    response += `---\n`;
    response += `_SAFe PULSE Agent • Powered by A SAFe Pulse_`;

    return response;
  }

  /**
   * Returns help text for the agent
   */
  private getHelpText(): string {
    let help = `**How can I help you?**\n\n`;
    help += `Simply mention me with a command:\n`;
    help += `• \`@saafepulse help\` - Show available commands\n`;
    help += `• \`@saafepulse plan this\` - Create implementation plan _(coming soon)_\n`;
    help += `• \`@saafepulse decompose\` - Break down large stories _(coming soon)_\n`;
    help += `• \`@saafepulse analyze dependencies\` - Map relationships _(coming soon)_\n`;
    help += `• \`@saafepulse status\` - Get ART status report _(coming soon)_\n\n`;
    
    return help;
  }
}