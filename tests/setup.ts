/**
 * Jest Test Setup
 *
 * Global test configuration and utilities for timer mocking and database mocking
 */

// Mock PostgreSQL database connections globally
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined)
  })),
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Global test utilities for timer mocking
declare global {
  var mockSetTimeout: jest.SpyInstance;
  var mockClearTimeout: jest.SpyInstance;
}

// Export timer utilities for tests
export const setupTimerMocks = () => {
  // Enable fake timers with modern implementation
  jest.useFakeTimers({
    advanceTimers: true,
    doNotFake: ['nextTick', 'setImmediate']
  });

  // Spy on timer functions after enabling fake timers
  global.mockSetTimeout = jest.spyOn(global, 'setTimeout');
  global.mockClearTimeout = jest.spyOn(global, 'clearTimeout');
};

export const cleanupTimerMocks = () => {
  // Clear all timers and restore real timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Restore original timer functions
  if (global.mockSetTimeout) {
    global.mockSetTimeout.mockRestore();
  }
  if (global.mockClearTimeout) {
    global.mockClearTimeout.mockRestore();
  }
};
