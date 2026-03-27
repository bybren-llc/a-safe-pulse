import { Pool } from 'pg';
import * as logger from '../utils/logger';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Error connecting to database', { error: err });
  } else {
    logger.info('Database connection successful', { timestamp: res.rows[0].now });
  }
});

/**
 * Executes a database query
 */
export const query = async (text: string, params: any[] = []) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Executed query', {
      text,
      duration,
      rows: res.rowCount
    });

    return res;
  } catch (error) {
    logger.error('Error executing query', { error, text });
    throw error;
  }
};

/**
 * Gets a client from the pool
 */
export const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Add a property to store the last query
  const clientWithLastQuery = client as any;

  // Monkey patch the query method to log queries
  clientWithLastQuery.query = function() {
    clientWithLastQuery.lastQuery = arguments[0];
    return originalQuery.apply(client, arguments as any);
  };

  // Monkey patch the release method to log release
  clientWithLastQuery.release = () => {
    clientWithLastQuery.query = originalQuery;
    clientWithLastQuery.release = originalRelease;
    return originalRelease.apply(client);
  };

  return clientWithLastQuery;
};
