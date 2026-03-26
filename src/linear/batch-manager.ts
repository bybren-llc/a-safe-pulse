/**
 * Batch Operation Manager for Linear API
 *
 * Provides queue-based batch execution of Linear API operations with
 * configurable concurrency, priority ordering, progress tracking,
 * partial failure handling, and idempotency support.
 */

import * as logger from '../utils/logger';

/**
 * A single operation in a batch
 */
export interface BatchOperation<T> {
  /** Unique identifier for this operation */
  id: string;
  /** Optional idempotency key to deduplicate operations */
  idempotencyKey?: string;
  /** Priority (higher = processed first). Defaults to 0 */
  priority?: number;
  /** The async function to execute */
  execute: () => Promise<T>;
}

/**
 * Result of a single batch operation
 */
export interface BatchResult<T> {
  /** The operation ID */
  id: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** The result value (if successful) */
  result?: T;
  /** The error (if failed) */
  error?: Error;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Options for batch execution
 */
export interface BatchOptions {
  /** Maximum number of concurrent operations. Defaults to 5 */
  concurrency?: number;
  /** Callback fired after each operation completes */
  onProgress?: (completed: number, total: number, current: BatchResult<any>) => void;
  /** If true, stop all processing when a fatal error occurs. Defaults to false */
  stopOnFatalError?: boolean;
}

/**
 * Summary of a batch execution run
 */
export interface BatchSummary<T> {
  /** Total number of operations submitted */
  total: number;
  /** Number of successful operations */
  succeeded: number;
  /** Number of failed operations */
  failed: number;
  /** Number of operations skipped due to idempotency deduplication */
  skipped: number;
  /** All individual results */
  results: BatchResult<T>[];
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Manages batch execution of Linear API operations with concurrency control,
 * priority ordering, progress tracking, and partial failure handling.
 */
export class BatchOperationManager {
  private readonly defaultConcurrency = 5;

  /**
   * Executes a batch of operations with concurrency control.
   *
   * Operations are sorted by priority (descending) before execution.
   * Duplicate idempotency keys are deduplicated (first occurrence wins).
   * Failed operations do not stop the batch unless stopOnFatalError is set.
   *
   * @param operations The operations to execute
   * @param options Batch execution options
   * @returns A summary of all results
   */
  async executeBatch<T>(
    operations: BatchOperation<T>[],
    options: BatchOptions = {}
  ): Promise<BatchSummary<T>> {
    const batchStart = Date.now();
    const concurrency = options.concurrency ?? this.defaultConcurrency;

    if (operations.length === 0) {
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: [],
        duration: Date.now() - batchStart,
      };
    }

    // Deduplicate by idempotencyKey (first occurrence wins)
    const seen = new Set<string>();
    const deduped: BatchOperation<T>[] = [];
    const skippedIds: string[] = [];

    for (const op of operations) {
      if (op.idempotencyKey) {
        if (seen.has(op.idempotencyKey)) {
          skippedIds.push(op.id);
          continue;
        }
        seen.add(op.idempotencyKey);
      }
      deduped.push(op);
    }

    // Sort by priority descending (higher priority first)
    const sorted = [...deduped].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );

    const results: BatchResult<T>[] = [];
    let completed = 0;
    const total = operations.length; // Report total including skipped
    let stopped = false;

    // Add skipped results
    for (const id of skippedIds) {
      const skippedResult: BatchResult<T> = {
        id,
        success: true,
        duration: 0,
      };
      results.push(skippedResult);
      completed++;
      if (options.onProgress) {
        options.onProgress(completed, total, skippedResult);
      }
    }

    logger.info('Starting batch execution', {
      total: operations.length,
      deduplicated: sorted.length,
      skipped: skippedIds.length,
      concurrency,
    });

    // Process operations with concurrency limit using a worker pool
    const queue = [...sorted];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      workers.push(
        this.runWorker(queue, results, () => completed, (val) => { completed = val; }, total, options, () => stopped, (val) => { stopped = val; })
      );
    }

    await Promise.all(workers);

    const summary: BatchSummary<T> = {
      total,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      skipped: skippedIds.length,
      results,
      duration: Date.now() - batchStart,
    };

    logger.info('Batch execution complete', {
      total: summary.total,
      succeeded: summary.succeeded,
      failed: summary.failed,
      skipped: summary.skipped,
      duration: summary.duration,
    });

    return summary;
  }

  /**
   * Worker that pulls operations from the shared queue and executes them.
   */
  private async runWorker<T>(
    queue: BatchOperation<T>[],
    results: BatchResult<T>[],
    getCompleted: () => number,
    setCompleted: (val: number) => void,
    total: number,
    options: BatchOptions,
    getStopped: () => boolean,
    setStopped: (val: boolean) => void
  ): Promise<void> {
    while (queue.length > 0) {
      if (getStopped()) {
        return;
      }

      const operation = queue.shift()!;
      const result = await this.executeOperation(operation);

      results.push(result);
      setCompleted(getCompleted() + 1);

      if (options.onProgress) {
        options.onProgress(getCompleted(), total, result);
      }

      if (!result.success && options.stopOnFatalError) {
        logger.error('Fatal error in batch operation, stopping', {
          operationId: operation.id,
          error: result.error?.message,
        });
        setStopped(true);
        return;
      }
    }
  }

  /**
   * Executes a single operation and captures the result.
   */
  private async executeOperation<T>(
    operation: BatchOperation<T>
  ): Promise<BatchResult<T>> {
    const start = Date.now();

    try {
      const result = await operation.execute();
      return {
        id: operation.id,
        success: true,
        result,
        duration: Date.now() - start,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.warn('Batch operation failed', {
        operationId: operation.id,
        error: error.message,
      });
      return {
        id: operation.id,
        success: false,
        error,
        duration: Date.now() - start,
      };
    }
  }
}
