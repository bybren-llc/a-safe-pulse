/**
 * Multiplexer Registry
 *
 * Bridges the existing 6 webhook processors into the WebhookMultiplexer
 * as an opt-in migration path. The original handler.ts is unchanged —
 * this registry can be activated alongside it when ready.
 */

import { WebhookMultiplexer, WebhookHandler, WebhookEvent } from './multiplexer';
import {
  IssueMentionProcessor,
  IssueCommentMentionProcessor,
  IssueAssignmentProcessor,
  IssueStatusChangeProcessor,
  IssueReactionProcessor,
  IssueNewCommentProcessor,
  AppUserNotification,
} from './processors';
import { LinearClientWrapper } from '../linear/client';
import { OperationalNotificationCoordinator } from '../utils/operational-notification-coordinator';
import * as logger from '../utils/logger';

/**
 * Wraps a BaseWebhookProcessor into a WebhookHandler so it can be
 * registered with the multiplexer.
 */
function wrapProcessor(
  name: string,
  processor: { process(notification: AppUserNotification): Promise<void> },
  priority?: number
): WebhookHandler {
  return {
    name,
    priority,
    async handle(event: WebhookEvent): Promise<void> {
      // Reconstruct the AppUserNotification shape the processors expect
      const notification: AppUserNotification = (event.rawPayload ??
        event.data) as unknown as AppUserNotification;
      await processor.process(notification);
    },
  };
}

/**
 * Options for creating the default multiplexer registry.
 */
export interface MultiplexerRegistryOptions {
  linearClient: LinearClientWrapper;
  notificationCoordinator: OperationalNotificationCoordinator;
  defaultTimeoutMs?: number;
}

/**
 * Creates a WebhookMultiplexer pre-loaded with all 6 existing
 * processors mapped to their respective AppUserNotification actions.
 *
 * The mapping mirrors the switch statement in handler.ts:
 *   - issueMention             -> IssueMentionProcessor
 *   - issueCommentMention      -> IssueCommentMentionProcessor
 *   - issueAssignedToYou       -> IssueAssignmentProcessor
 *   - issueUnassignedFromYou   -> IssueAssignmentProcessor
 *   - issueStatusChanged       -> IssueStatusChangeProcessor
 *   - issueEmojiReaction       -> IssueReactionProcessor
 *   - issueCommentReaction     -> IssueReactionProcessor
 *   - issueNewComment          -> IssueNewCommentProcessor
 */
export function createDefaultMultiplexer(
  options: MultiplexerRegistryOptions
): WebhookMultiplexer {
  const { linearClient, notificationCoordinator, defaultTimeoutMs } = options;
  const mux = new WebhookMultiplexer({ defaultTimeoutMs });

  // 1. Issue Mention
  const mentionProcessor = new IssueMentionProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueMention',
    wrapProcessor('IssueMentionProcessor', mentionProcessor, 10)
  );

  // 2. Issue Comment Mention
  const commentMentionProcessor = new IssueCommentMentionProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueCommentMention',
    wrapProcessor('IssueCommentMentionProcessor', commentMentionProcessor, 10)
  );

  // 3. Issue Assignment (handles both assign & unassign)
  const assignmentProcessor = new IssueAssignmentProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueAssignedToYou',
    wrapProcessor('IssueAssignmentProcessor-assign', assignmentProcessor, 20)
  );
  mux.register(
    'AppUserNotification',
    'issueUnassignedFromYou',
    wrapProcessor('IssueAssignmentProcessor-unassign', assignmentProcessor, 20)
  );

  // 4. Issue Status Change
  const statusProcessor = new IssueStatusChangeProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueStatusChanged',
    wrapProcessor('IssueStatusChangeProcessor', statusProcessor, 30)
  );

  // 5. Reactions (handles both emoji and comment reactions)
  const reactionProcessor = new IssueReactionProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueEmojiReaction',
    wrapProcessor('IssueReactionProcessor-emoji', reactionProcessor, 40)
  );
  mux.register(
    'AppUserNotification',
    'issueCommentReaction',
    wrapProcessor('IssueReactionProcessor-comment', reactionProcessor, 40)
  );

  // 6. New Comment
  const newCommentProcessor = new IssueNewCommentProcessor(linearClient, notificationCoordinator);
  mux.register(
    'AppUserNotification',
    'issueNewComment',
    wrapProcessor('IssueNewCommentProcessor', newCommentProcessor, 50)
  );

  logger.info('Multiplexer registry: all 6 processors registered', {
    handlerCount: mux.handlerCount,
    eventKeys: mux.registeredEventKeys,
  });

  return mux;
}
