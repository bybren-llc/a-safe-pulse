/**
 * Tests for the WebhookMultiplexer
 *
 * Covers: registration/deregistration, fan-out, priority ordering,
 * error isolation, timeout handling, health tracking, and the
 * multiplexer registry integration.
 */

import {
  WebhookMultiplexer,
  WebhookEvent,
  WebhookHandler,
} from '../../src/webhooks/multiplexer';

// Suppress logger output during tests
jest.mock('../../src/utils/logger');

// Ensure pending timers are cleaned up so Jest exits cleanly
afterAll(() => {
  jest.useRealTimers();
});

/** Helper to build a minimal WebhookEvent */
function makeEvent(type: string, action: string, data?: Record<string, unknown>): WebhookEvent {
  return { type, action, data: data ?? {} };
}

/** Helper to build a simple handler that records calls */
function makeHandler(
  name: string,
  options?: { priority?: number; timeout?: number; fn?: (e: WebhookEvent) => Promise<void> }
): WebhookHandler & { calls: WebhookEvent[] } {
  const calls: WebhookEvent[] = [];
  return {
    name,
    priority: options?.priority,
    timeout: options?.timeout,
    calls,
    async handle(event: WebhookEvent): Promise<void> {
      calls.push(event);
      if (options?.fn) {
        await options.fn(event);
      }
    },
  };
}

describe('WebhookMultiplexer', () => {
  let mux: WebhookMultiplexer;

  beforeEach(() => {
    mux = new WebhookMultiplexer({ defaultTimeoutMs: 5000 });
  });

  // ── Registration / Deregistration ──────────────────────────────────

  describe('registration', () => {
    it('registers a handler and includes it in handler count', () => {
      const h = makeHandler('test-handler');
      mux.register('Issue', 'update', h);
      expect(mux.handlerCount).toBe(1);
      expect(mux.registeredEventKeys).toContain('Issue:update');
    });

    it('rejects duplicate handler names for the same event key', () => {
      const h1 = makeHandler('duplicate');
      const h2 = makeHandler('duplicate');
      mux.register('Issue', 'create', h1);
      expect(() => mux.register('Issue', 'create', h2)).toThrow(
        'Handler "duplicate" is already registered'
      );
    });

    it('allows the same handler name on different event keys', () => {
      const h1 = makeHandler('shared');
      const h2 = makeHandler('shared');
      mux.register('Issue', 'create', h1);
      mux.register('Comment', 'create', h2);
      expect(mux.handlerCount).toBe(2);
    });
  });

  describe('deregistration', () => {
    it('removes a handler and updates handler count', () => {
      const h = makeHandler('removable');
      mux.register('Issue', 'update', h);
      expect(mux.handlerCount).toBe(1);

      const removed = mux.deregister('Issue', 'update', 'removable');
      expect(removed).toBe(true);
      expect(mux.handlerCount).toBe(0);
    });

    it('returns false when deregistering a non-existent handler', () => {
      expect(mux.deregister('Issue', 'update', 'ghost')).toBe(false);
    });

    it('cleans up the event key when last handler is removed', () => {
      const h = makeHandler('only-one');
      mux.register('Issue', 'update', h);
      mux.deregister('Issue', 'update', 'only-one');
      expect(mux.registeredEventKeys).not.toContain('Issue:update');
    });
  });

  // ── Fan-out ────────────────────────────────────────────────────────

  describe('fan-out', () => {
    it('dispatches to multiple handlers for the same event key', async () => {
      const h1 = makeHandler('handler-a');
      const h2 = makeHandler('handler-b');
      mux.register('Issue', 'update', h1);
      mux.register('Issue', 'update', h2);

      const event = makeEvent('Issue', 'update');
      const result = await mux.dispatch(event);

      expect(result.handlersInvoked).toBe(2);
      expect(result.successes).toBe(2);
      expect(h1.calls).toHaveLength(1);
      expect(h2.calls).toHaveLength(1);
    });

    it('matches wildcard handlers alongside specific ones', async () => {
      const specific = makeHandler('specific');
      const wildcard = makeHandler('wildcard');
      mux.register('Issue', 'update', specific);
      mux.register('Issue', undefined, wildcard);

      const event = makeEvent('Issue', 'update');
      const result = await mux.dispatch(event);

      expect(result.handlersInvoked).toBe(2);
      expect(specific.calls).toHaveLength(1);
      expect(wildcard.calls).toHaveLength(1);
    });

    it('returns zero handlers when no match exists', async () => {
      const result = await mux.dispatch(makeEvent('Unknown', 'action'));
      expect(result.handlersInvoked).toBe(0);
      expect(result.successes).toBe(0);
    });
  });

  // ── Priority Ordering ─────────────────────────────────────────────

  describe('priority ordering', () => {
    it('invokes handlers in priority order (lower number first)', async () => {
      const order: string[] = [];

      const high = makeHandler('high-priority', {
        priority: 1,
        fn: async () => { order.push('high'); },
      });
      const low = makeHandler('low-priority', {
        priority: 99,
        fn: async () => { order.push('low'); },
      });
      const medium = makeHandler('medium-priority', {
        priority: 50,
        fn: async () => { order.push('medium'); },
      });

      // Register in non-priority order
      mux.register('Issue', 'update', low);
      mux.register('Issue', 'update', high);
      mux.register('Issue', 'update', medium);

      await mux.dispatch(makeEvent('Issue', 'update'));

      expect(order).toEqual(['high', 'medium', 'low']);
    });

    it('uses default priority of 100 when none specified', async () => {
      const order: string[] = [];

      const explicit = makeHandler('explicit', {
        priority: 50,
        fn: async () => { order.push('explicit'); },
      });
      const defaultP = makeHandler('default', {
        fn: async () => { order.push('default'); },
      });

      mux.register('Issue', 'create', defaultP);
      mux.register('Issue', 'create', explicit);

      await mux.dispatch(makeEvent('Issue', 'create'));
      expect(order).toEqual(['explicit', 'default']);
    });
  });

  // ── Error Isolation ───────────────────────────────────────────────

  describe('error isolation', () => {
    it('continues executing other handlers when one throws', async () => {
      const failing = makeHandler('failing', {
        priority: 1,
        fn: async () => { throw new Error('boom'); },
      });
      const succeeding = makeHandler('succeeding', {
        priority: 1,
      });

      mux.register('Issue', 'update', failing);
      mux.register('Issue', 'update', succeeding);

      const result = await mux.dispatch(makeEvent('Issue', 'update'));

      expect(result.handlersInvoked).toBe(2);
      expect(result.failures).toBe(1);
      expect(result.successes).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].handlerName).toBe('failing');
      expect(result.errors[0].error).toBe('boom');
      expect(succeeding.calls).toHaveLength(1);
    });

    it('isolates errors across priority groups', async () => {
      const failHigh = makeHandler('fail-high', {
        priority: 1,
        fn: async () => { throw new Error('high failure'); },
      });
      const succeedLow = makeHandler('succeed-low', {
        priority: 99,
      });

      mux.register('Issue', 'update', failHigh);
      mux.register('Issue', 'update', succeedLow);

      const result = await mux.dispatch(makeEvent('Issue', 'update'));
      expect(result.failures).toBe(1);
      expect(result.successes).toBe(1);
      expect(succeedLow.calls).toHaveLength(1);
    });
  });

  // ── Timeout Handling ──────────────────────────────────────────────

  describe('timeout handling', () => {
    it('times out a handler that exceeds its timeout', async () => {
      const slow = makeHandler('slow-handler', {
        timeout: 50, // 50ms timeout
        fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        },
      });

      mux.register('Issue', 'update', slow);
      const result = await mux.dispatch(makeEvent('Issue', 'update'));

      expect(result.timeouts).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].handlerName).toBe('slow-handler');
      expect(result.errors[0].error).toContain('Timed out');
    });

    it('does not time out a fast handler', async () => {
      const fast = makeHandler('fast-handler', {
        timeout: 5000,
        fn: async () => {
          // Instant
        },
      });

      mux.register('Issue', 'update', fast);
      const result = await mux.dispatch(makeEvent('Issue', 'update'));

      expect(result.timeouts).toBe(0);
      expect(result.successes).toBe(1);
    });

    it('uses default timeout when handler does not specify one', async () => {
      // Create mux with very short default
      const shortMux = new WebhookMultiplexer({ defaultTimeoutMs: 50 });
      const slow = makeHandler('default-timeout', {
        fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        },
      });

      shortMux.register('Issue', 'update', slow);
      const result = await shortMux.dispatch(makeEvent('Issue', 'update'));

      expect(result.timeouts).toBe(1);
    });
  });

  // ── Health Tracking ───────────────────────────────────────────────

  describe('health tracking', () => {
    it('tracks success metrics correctly', async () => {
      const h = makeHandler('tracked');
      mux.register('Issue', 'update', h);

      await mux.dispatch(makeEvent('Issue', 'update'));
      await mux.dispatch(makeEvent('Issue', 'update'));

      const metrics = mux.getHealthMetrics();
      expect(metrics).toHaveLength(1);

      const m = metrics[0];
      expect(m.name).toBe('tracked');
      expect(m.totalInvocations).toBe(2);
      expect(m.successCount).toBe(2);
      expect(m.failureCount).toBe(0);
      expect(m.successRate).toBe(1);
      expect(m.averageLatencyMs).toBeGreaterThanOrEqual(0);
      expect(m.lastInvokedAt).toBeInstanceOf(Date);
      expect(m.lastErrorMessage).toBeNull();
    });

    it('tracks failure metrics and last error message', async () => {
      const h = makeHandler('fragile', {
        fn: async () => { throw new Error('oops'); },
      });
      mux.register('Issue', 'update', h);

      await mux.dispatch(makeEvent('Issue', 'update'));

      const metrics = mux.getHealthMetrics();
      const m = metrics[0];
      expect(m.failureCount).toBe(1);
      expect(m.successRate).toBe(0);
      expect(m.lastErrorMessage).toBe('oops');
    });

    it('tracks timeout as both timeout and failure', async () => {
      const h = makeHandler('timeout-tracked', {
        timeout: 50,
        fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        },
      });
      mux.register('Issue', 'update', h);

      await mux.dispatch(makeEvent('Issue', 'update'));

      const metrics = mux.getHealthMetrics();
      const m = metrics[0];
      expect(m.timeoutCount).toBe(1);
      expect(m.failureCount).toBe(1);
      expect(m.successRate).toBe(0);
    });

    it('calculates mixed success rate correctly', async () => {
      let callCount = 0;
      const h = makeHandler('mixed', {
        fn: async () => {
          callCount++;
          if (callCount === 2) throw new Error('fail on second');
        },
      });
      mux.register('Issue', 'update', h);

      await mux.dispatch(makeEvent('Issue', 'update')); // success
      await mux.dispatch(makeEvent('Issue', 'update')); // failure
      await mux.dispatch(makeEvent('Issue', 'update')); // success

      const metrics = mux.getHealthMetrics();
      const m = metrics[0];
      expect(m.totalInvocations).toBe(3);
      expect(m.successCount).toBe(2);
      expect(m.failureCount).toBe(1);
      expect(m.successRate).toBeCloseTo(2 / 3, 5);
    });

    it('returns empty array when no handlers are registered', () => {
      expect(mux.getHealthMetrics()).toEqual([]);
    });
  });

  // ── Event Key helpers ─────────────────────────────────────────────

  describe('eventKey', () => {
    it('builds specific key with type and action', () => {
      expect(WebhookMultiplexer.eventKey('Issue', 'update')).toBe('Issue:update');
    });

    it('builds wildcard key when action is omitted', () => {
      expect(WebhookMultiplexer.eventKey('Issue')).toBe('Issue:*');
    });
  });
});
