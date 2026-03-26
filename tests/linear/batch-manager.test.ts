import {
  BatchOperationManager,
  BatchOperation,
  BatchResult,
  BatchSummary,
} from '../../src/linear/batch-manager';

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('BatchOperationManager', () => {
  let manager: BatchOperationManager;

  beforeEach(() => {
    manager = new BatchOperationManager();
  });

  // Helper: create a simple successful operation
  function makeOp<T>(id: string, result: T, delay = 0, opts?: Partial<BatchOperation<T>>): BatchOperation<T> {
    return {
      id,
      execute: () =>
        delay > 0
          ? new Promise<T>((resolve) => setTimeout(resolve, delay, result))
          : Promise.resolve(result),
      ...opts,
    };
  }

  // Helper: create a failing operation
  function makeFailingOp(id: string, errorMsg: string, delay = 0): BatchOperation<string> {
    return {
      id,
      execute: () =>
        delay > 0
          ? new Promise<string>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), delay))
          : Promise.reject(new Error(errorMsg)),
    };
  }

  // --- Test 1 ---
  it('should execute all operations successfully', async () => {
    const ops = [
      makeOp('op-1', 'result-1'),
      makeOp('op-2', 'result-2'),
      makeOp('op-3', 'result-3'),
    ];

    const summary = await manager.executeBatch(ops);

    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.results).toHaveLength(3);
    expect(summary.duration).toBeGreaterThanOrEqual(0);

    for (const r of summary.results) {
      expect(r.success).toBe(true);
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });

  // --- Test 2 ---
  it('should handle an empty batch', async () => {
    const summary = await manager.executeBatch([]);

    expect(summary.total).toBe(0);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.results).toHaveLength(0);
  });

  // --- Test 3 ---
  it('should respect concurrency limits', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const makeTrackedOp = (id: string): BatchOperation<string> => ({
      id,
      execute: async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) {
          maxConcurrent = concurrentCount;
        }
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrentCount--;
        return `done-${id}`;
      },
    });

    const ops = Array.from({ length: 10 }, (_, i) => makeTrackedOp(`op-${i}`));
    const summary = await manager.executeBatch(ops, { concurrency: 3 });

    expect(summary.succeeded).toBe(10);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThanOrEqual(1);
  });

  // --- Test 4 ---
  it('should handle partial failures and continue processing', async () => {
    const ops: BatchOperation<string>[] = [
      makeOp('op-1', 'ok-1'),
      makeFailingOp('op-2', 'boom'),
      makeOp('op-3', 'ok-3'),
      makeFailingOp('op-4', 'kaboom'),
      makeOp('op-5', 'ok-5'),
    ];

    const summary = await manager.executeBatch(ops);

    expect(summary.total).toBe(5);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(2);

    const failedResults = summary.results.filter((r) => !r.success);
    expect(failedResults).toHaveLength(2);
    expect(failedResults[0].error?.message).toBe('boom');
    expect(failedResults[1].error?.message).toBe('kaboom');

    const succeededResults = summary.results.filter((r) => r.success);
    expect(succeededResults).toHaveLength(3);
  });

  // --- Test 5 ---
  it('should fire progress callback for each operation', async () => {
    const progressCalls: Array<{ completed: number; total: number; id: string }> = [];

    const ops = [
      makeOp('op-1', 'a'),
      makeOp('op-2', 'b'),
      makeOp('op-3', 'c'),
    ];

    await manager.executeBatch(ops, {
      concurrency: 1, // Serial so order is deterministic
      onProgress: (completed, total, current) => {
        progressCalls.push({ completed, total, id: current.id });
      },
    });

    expect(progressCalls).toHaveLength(3);
    expect(progressCalls[0]).toEqual({ completed: 1, total: 3, id: 'op-1' });
    expect(progressCalls[1]).toEqual({ completed: 2, total: 3, id: 'op-2' });
    expect(progressCalls[2]).toEqual({ completed: 3, total: 3, id: 'op-3' });
  });

  // --- Test 6 ---
  it('should process higher priority operations first', async () => {
    const executionOrder: string[] = [];

    const makeTrackedOp = (id: string, priority: number): BatchOperation<string> => ({
      id,
      priority,
      execute: async () => {
        executionOrder.push(id);
        return id;
      },
    });

    const ops = [
      makeTrackedOp('low', 1),
      makeTrackedOp('high', 10),
      makeTrackedOp('medium', 5),
    ];

    await manager.executeBatch(ops, { concurrency: 1 }); // Serial for deterministic order

    expect(executionOrder).toEqual(['high', 'medium', 'low']);
  });

  // --- Test 7 ---
  it('should deduplicate operations by idempotency key', async () => {
    const executionCount: Record<string, number> = {};

    const makeIdempotentOp = (id: string, key: string): BatchOperation<string> => ({
      id,
      idempotencyKey: key,
      execute: async () => {
        executionCount[id] = (executionCount[id] || 0) + 1;
        return id;
      },
    });

    const ops = [
      makeIdempotentOp('op-1', 'key-A'),
      makeIdempotentOp('op-2', 'key-A'), // Duplicate - should be skipped
      makeIdempotentOp('op-3', 'key-B'),
      makeIdempotentOp('op-4', 'key-B'), // Duplicate - should be skipped
      makeIdempotentOp('op-5', 'key-C'),
    ];

    const summary = await manager.executeBatch(ops);

    expect(summary.total).toBe(5);
    expect(summary.skipped).toBe(2);
    expect(summary.succeeded).toBe(5); // Skipped count as success
    expect(summary.results).toHaveLength(5);

    // Only first occurrences should have actually executed
    expect(executionCount['op-1']).toBe(1);
    expect(executionCount['op-2']).toBeUndefined();
    expect(executionCount['op-3']).toBe(1);
    expect(executionCount['op-4']).toBeUndefined();
    expect(executionCount['op-5']).toBe(1);
  });

  // --- Test 8 ---
  it('should stop on fatal error when stopOnFatalError is true', async () => {
    const executionOrder: string[] = [];

    const ops: BatchOperation<string>[] = [
      {
        id: 'op-1',
        execute: async () => {
          executionOrder.push('op-1');
          return 'ok';
        },
      },
      {
        id: 'op-2',
        execute: async () => {
          executionOrder.push('op-2');
          throw new Error('fatal');
        },
      },
      {
        id: 'op-3',
        execute: async () => {
          executionOrder.push('op-3');
          return 'ok';
        },
      },
    ];

    const summary = await manager.executeBatch(ops, {
      concurrency: 1,
      stopOnFatalError: true,
    });

    // op-1 succeeded, op-2 failed, op-3 should NOT have run
    expect(executionOrder).toEqual(['op-1', 'op-2']);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results).toHaveLength(2);
  });

  // --- Test 9 ---
  it('should record duration for each operation', async () => {
    const ops = [
      makeOp('fast', 'done', 10),
      makeOp('slow', 'done', 100),
    ];

    const summary = await manager.executeBatch(ops, { concurrency: 2 });

    const fast = summary.results.find((r) => r.id === 'fast')!;
    const slow = summary.results.find((r) => r.id === 'slow')!;

    expect(fast.duration).toBeGreaterThanOrEqual(0);
    expect(slow.duration).toBeGreaterThanOrEqual(fast.duration);
    expect(summary.duration).toBeGreaterThanOrEqual(0);
  });

  // --- Test 10 ---
  it('should handle operations that throw non-Error values', async () => {
    const ops: BatchOperation<string>[] = [
      {
        id: 'op-string-throw',
        execute: async () => {
          throw 'string error';
        },
      },
      {
        id: 'op-number-throw',
        execute: async () => {
          throw 42;
        },
      },
      makeOp('op-ok', 'fine'),
    ];

    const summary = await manager.executeBatch(ops);

    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(2);

    const stringThrow = summary.results.find((r) => r.id === 'op-string-throw')!;
    expect(stringThrow.error).toBeInstanceOf(Error);
    expect(stringThrow.error?.message).toBe('string error');

    const numberThrow = summary.results.find((r) => r.id === 'op-number-throw')!;
    expect(numberThrow.error).toBeInstanceOf(Error);
    expect(numberThrow.error?.message).toBe('42');
  });

  // --- Test 11 ---
  it('should use default concurrency of 5', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const makeTrackedOp = (id: string): BatchOperation<string> => ({
      id,
      execute: async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) {
          maxConcurrent = concurrentCount;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrentCount--;
        return `done`;
      },
    });

    const ops = Array.from({ length: 20 }, (_, i) => makeTrackedOp(`op-${i}`));
    await manager.executeBatch(ops); // No concurrency option = default 5

    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThanOrEqual(1);
  });

  // --- Test 12 ---
  it('should allow operations without idempotency keys to run even if others are deduplicated', async () => {
    const executed: string[] = [];

    const ops: BatchOperation<string>[] = [
      {
        id: 'op-1',
        idempotencyKey: 'shared-key',
        execute: async () => { executed.push('op-1'); return 'a'; },
      },
      {
        id: 'op-2',
        idempotencyKey: 'shared-key',
        execute: async () => { executed.push('op-2'); return 'b'; },
      },
      {
        id: 'op-3', // No idempotency key
        execute: async () => { executed.push('op-3'); return 'c'; },
      },
    ];

    const summary = await manager.executeBatch(ops, { concurrency: 1 });

    expect(executed).toEqual(['op-1', 'op-3']);
    expect(summary.skipped).toBe(1);
    expect(summary.succeeded).toBe(3);
  });

  // --- Test 13 ---
  it('should handle concurrency of 1 (serial execution)', async () => {
    const timeline: Array<{ id: string; event: 'start' | 'end' }> = [];

    const makeTrackedOp = (id: string): BatchOperation<string> => ({
      id,
      execute: async () => {
        timeline.push({ id, event: 'start' });
        await new Promise((resolve) => setTimeout(resolve, 20));
        timeline.push({ id, event: 'end' });
        return id;
      },
    });

    const ops = [makeTrackedOp('a'), makeTrackedOp('b'), makeTrackedOp('c')];
    await manager.executeBatch(ops, { concurrency: 1 });

    // With concurrency 1, each op should start only after the previous ends
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].event === 'start' && i > 0) {
        expect(timeline[i - 1].event).toBe('end');
      }
    }
  });

  // --- Test 14 ---
  it('should fire progress callback for failed operations too', async () => {
    const progressCalls: Array<{ id: string; success: boolean }> = [];

    const ops: BatchOperation<string>[] = [
      makeOp('op-ok', 'fine'),
      makeFailingOp('op-fail', 'oops'),
    ];

    await manager.executeBatch(ops, {
      concurrency: 1,
      onProgress: (_completed, _total, current) => {
        progressCalls.push({ id: current.id, success: current.success });
      },
    });

    expect(progressCalls).toHaveLength(2);
    const failCall = progressCalls.find((p) => p.id === 'op-fail');
    expect(failCall?.success).toBe(false);
  });
});
