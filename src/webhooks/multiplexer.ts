/**
 * Webhook Event Multiplexer
 *
 * Routes incoming webhook events to multiple registered handlers with:
 * - Handler registration by event type + action (e.g., "Issue:update")
 * - Fan-out to multiple handlers per event type
 * - Priority-based ordering (lower number = higher priority)
 * - Error isolation: one handler failure does not block others
 * - Configurable per-handler timeout
 * - Health tracking per handler (success rate, latency)
 */

import * as logger from '../utils/logger';

/**
 * Represents an incoming webhook event routed through the multiplexer.
 */
export interface WebhookEvent {
  type: string;
  action: string;
  data: Record<string, unknown>;
  /** Full raw payload from the webhook */
  rawPayload?: Record<string, unknown>;
}

/**
 * Handler interface that consumers implement to receive webhook events.
 */
export interface WebhookHandler {
  name: string;
  priority?: number;
  timeout?: number;
  handle(event: WebhookEvent): Promise<void>;
}

/**
 * Per-handler health metrics exposed by the multiplexer.
 */
export interface HandlerHealthMetrics {
  name: string;
  eventKey: string;
  totalInvocations: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  successRate: number;
  averageLatencyMs: number;
  lastInvokedAt: Date | null;
  lastErrorMessage: string | null;
}

/** Internal registration record. */
interface HandlerRegistration {
  handler: WebhookHandler;
  eventKey: string;
  metrics: {
    totalInvocations: number;
    successCount: number;
    failureCount: number;
    timeoutCount: number;
    totalLatencyMs: number;
    lastInvokedAt: Date | null;
    lastErrorMessage: string | null;
  };
}

/**
 * Result of dispatching a single event through all matching handlers.
 */
export interface DispatchResult {
  eventKey: string;
  handlersInvoked: number;
  successes: number;
  failures: number;
  timeouts: number;
  errors: Array<{ handlerName: string; error: string }>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class WebhookMultiplexer {
  /** eventKey -> sorted registrations */
  private handlers: Map<string, HandlerRegistration[]> = new Map();
  private defaultTimeout: number;

  constructor(options?: { defaultTimeoutMs?: number }) {
    this.defaultTimeout = options?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Build the canonical key for an event type + action pair.
   * Wildcard listeners use "*" as the action.
   */
  static eventKey(type: string, action?: string): string {
    return action ? `${type}:${action}` : `${type}:*`;
  }

  /**
   * Register a handler for a specific event type and optional action.
   * Duplicate handler names for the same event key are rejected.
   */
  register(type: string, action: string | undefined, handler: WebhookHandler): void {
    const key = WebhookMultiplexer.eventKey(type, action);
    let list = this.handlers.get(key);
    if (!list) {
      list = [];
      this.handlers.set(key, list);
    }

    if (list.some((r) => r.handler.name === handler.name)) {
      throw new Error(
        `Handler "${handler.name}" is already registered for event "${key}"`
      );
    }

    list.push({
      handler,
      eventKey: key,
      metrics: {
        totalInvocations: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        totalLatencyMs: 0,
        lastInvokedAt: null,
        lastErrorMessage: null,
      },
    });

    // Re-sort by priority (ascending — lower value = higher priority)
    list.sort(
      (a, b) => (a.handler.priority ?? 100) - (b.handler.priority ?? 100)
    );

    logger.info(`Multiplexer: registered handler "${handler.name}" for "${key}"`, {
      priority: handler.priority ?? 100,
    });
  }

  /**
   * Remove a previously registered handler by name and event key.
   * Returns true if the handler was found and removed.
   */
  deregister(type: string, action: string | undefined, handlerName: string): boolean {
    const key = WebhookMultiplexer.eventKey(type, action);
    const list = this.handlers.get(key);
    if (!list) return false;

    const idx = list.findIndex((r) => r.handler.name === handlerName);
    if (idx === -1) return false;

    list.splice(idx, 1);
    if (list.length === 0) {
      this.handlers.delete(key);
    }

    logger.info(`Multiplexer: deregistered handler "${handlerName}" from "${key}"`);
    return true;
  }

  /**
   * Dispatch an event to all matching handlers.
   *
   * Matching considers both the specific key (`Type:action`) and the
   * wildcard key (`Type:*`). Handlers run concurrently within priority
   * groups — handlers sharing the same priority run in parallel; different
   * priority levels run sequentially from lowest number to highest.
   *
   * Errors are isolated: a failing handler does not prevent others from
   * executing.
   */
  async dispatch(event: WebhookEvent): Promise<DispatchResult> {
    const specificKey = WebhookMultiplexer.eventKey(event.type, event.action);
    const wildcardKey = WebhookMultiplexer.eventKey(event.type);

    // Collect matching registrations, de-duplicating
    const seen = new Set<string>();
    const matchedRegistrations: HandlerRegistration[] = [];

    for (const key of [specificKey, wildcardKey]) {
      const list = this.handlers.get(key);
      if (list) {
        for (const reg of list) {
          if (!seen.has(reg.handler.name)) {
            seen.add(reg.handler.name);
            matchedRegistrations.push(reg);
          }
        }
      }
    }

    // Sort all matched by priority
    matchedRegistrations.sort(
      (a, b) => (a.handler.priority ?? 100) - (b.handler.priority ?? 100)
    );

    const result: DispatchResult = {
      eventKey: specificKey,
      handlersInvoked: matchedRegistrations.length,
      successes: 0,
      failures: 0,
      timeouts: 0,
      errors: [],
    };

    if (matchedRegistrations.length === 0) {
      logger.debug(`Multiplexer: no handlers for "${specificKey}"`);
      return result;
    }

    logger.info(`Multiplexer: dispatching "${specificKey}" to ${matchedRegistrations.length} handler(s)`);

    // Group by priority for ordered concurrent execution
    const priorityGroups = new Map<number, HandlerRegistration[]>();
    for (const reg of matchedRegistrations) {
      const p = reg.handler.priority ?? 100;
      let group = priorityGroups.get(p);
      if (!group) {
        group = [];
        priorityGroups.set(p, group);
      }
      group.push(reg);
    }

    const sortedPriorities = [...priorityGroups.keys()].sort((a, b) => a - b);

    for (const priority of sortedPriorities) {
      const group = priorityGroups.get(priority)!;
      const outcomes = await Promise.allSettled(
        group.map((reg) => this.invokeHandler(reg, event))
      );

      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        if (outcome.status === 'fulfilled') {
          if (outcome.value.timedOut) {
            result.timeouts++;
            result.errors.push({
              handlerName: group[i].handler.name,
              error: `Timed out after ${group[i].handler.timeout ?? this.defaultTimeout}ms`,
            });
          } else if (outcome.value.error) {
            result.failures++;
            result.errors.push({
              handlerName: group[i].handler.name,
              error: outcome.value.error,
            });
          } else {
            result.successes++;
          }
        } else {
          // Should not happen since invokeHandler catches, but guard anyway
          result.failures++;
          result.errors.push({
            handlerName: group[i].handler.name,
            error: String(outcome.reason),
          });
        }
      }
    }

    return result;
  }

  /**
   * Get health metrics for all registered handlers.
   */
  getHealthMetrics(): HandlerHealthMetrics[] {
    const metrics: HandlerHealthMetrics[] = [];
    for (const [, list] of this.handlers) {
      for (const reg of list) {
        const m = reg.metrics;
        metrics.push({
          name: reg.handler.name,
          eventKey: reg.eventKey,
          totalInvocations: m.totalInvocations,
          successCount: m.successCount,
          failureCount: m.failureCount,
          timeoutCount: m.timeoutCount,
          successRate:
            m.totalInvocations > 0
              ? m.successCount / m.totalInvocations
              : 0,
          averageLatencyMs:
            m.totalInvocations > 0
              ? m.totalLatencyMs / m.totalInvocations
              : 0,
          lastInvokedAt: m.lastInvokedAt,
          lastErrorMessage: m.lastErrorMessage,
        });
      }
    }
    return metrics;
  }

  /**
   * Get the count of registered handlers across all event keys.
   */
  get handlerCount(): number {
    let count = 0;
    for (const [, list] of this.handlers) {
      count += list.length;
    }
    return count;
  }

  /**
   * List all registered event keys.
   */
  get registeredEventKeys(): string[] {
    return [...this.handlers.keys()];
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async invokeHandler(
    reg: HandlerRegistration,
    event: WebhookEvent
  ): Promise<{ timedOut: boolean; error: string | null }> {
    const timeoutMs = reg.handler.timeout ?? this.defaultTimeout;
    const start = Date.now();
    reg.metrics.totalInvocations++;
    reg.metrics.lastInvokedAt = new Date();

    try {
      await Promise.race([
        reg.handler.handle(event),
        this.createTimeout(timeoutMs),
      ]).then((result) => {
        if (result === 'TIMEOUT') {
          throw new TimeoutError(
            `Handler "${reg.handler.name}" timed out after ${timeoutMs}ms`
          );
        }
      });

      const latency = Date.now() - start;
      reg.metrics.successCount++;
      reg.metrics.totalLatencyMs += latency;

      return { timedOut: false, error: null };
    } catch (err) {
      const latency = Date.now() - start;
      reg.metrics.totalLatencyMs += latency;

      if (err instanceof TimeoutError) {
        reg.metrics.timeoutCount++;
        reg.metrics.failureCount++;
        reg.metrics.lastErrorMessage = err.message;

        logger.warn(`Multiplexer: handler "${reg.handler.name}" timed out`, {
          eventKey: reg.eventKey,
          timeoutMs,
        });

        return { timedOut: true, error: err.message };
      }

      reg.metrics.failureCount++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      reg.metrics.lastErrorMessage = errorMessage;

      logger.error(`Multiplexer: handler "${reg.handler.name}" failed`, {
        eventKey: reg.eventKey,
        error: errorMessage,
      });

      return { timedOut: false, error: errorMessage };
    }
  }

  private createTimeout(ms: number): Promise<string> {
    return new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms));
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
