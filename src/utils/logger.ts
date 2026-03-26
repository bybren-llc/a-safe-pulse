/**
 * Structured logger using Pino
 *
 * Exports the same API as the original console.log wrapper:
 *   info(message, metadata?), warn(message, metadata?),
 *   error(message, metadata?), debug(message, metadata?)
 *
 * Configured via LOG_LEVEL env var (default: 'info').
 */

import pino from 'pino';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/**
 * Logs a debug message
 */
export const debug = (message: string, metadata?: any) => {
  if (metadata !== undefined) {
    pinoLogger.debug({ metadata }, message);
  } else {
    pinoLogger.debug(message);
  }
};

/**
 * Logs an info message
 */
export const info = (message: string, metadata?: any) => {
  if (metadata !== undefined) {
    pinoLogger.info({ metadata }, message);
  } else {
    pinoLogger.info(message);
  }
};

/**
 * Logs a warning message
 */
export const warn = (message: string, metadata?: any) => {
  if (metadata !== undefined) {
    pinoLogger.warn({ metadata }, message);
  } else {
    pinoLogger.warn(message);
  }
};

/**
 * Logs an error message
 */
export const error = (message: string, metadata?: any) => {
  if (metadata !== undefined) {
    pinoLogger.error({ metadata }, message);
  } else {
    pinoLogger.error(message);
  }
};
