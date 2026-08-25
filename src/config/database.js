const path = require('path');
const { Pool } = require('pg');

/**
 * Environment file selection.
 * When running under the test suite (NODE_ENV=test, set by the "test"
 * script in package.json) we load .env.test instead of .env, so the
 * integration tests run against a dedicated `csv_import_db_test`
 * database rather than the real dev/prod one. This matters because the
 * integration suite TRUNCATEs tables between runs - pointing it at the
 * dev database would silently wipe real data.
 * dotenv.config() never overwrites a variable that is already set in
 * process.env, so this is safe to call even if something upstream
 * (e.g. server.js) already loaded a different .env file first.
 */
const isTestEnvironment = process.env.NODE_ENV === 'test';
const envFile = isTestEnvironment ? '.env.test' : '.env';

// In test mode the test file must win over a DATABASE_URL inherited from the
// shell (or loaded earlier by another module). Otherwise a test run can
// silently point at the development database and TRUNCATE real data.
require('dotenv').config({
  path: path.resolve(process.cwd(), envFile),
  override: isTestEnvironment,
});

if (isTestEnvironment) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when NODE_ENV=test.');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL when NODE_ENV=test.');
  }

  if (!/(^|[_-])test$/i.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}". ` +
      'Set DATABASE_URL in .env.test to a dedicated database whose name ends with "_test".'
    );
  }
}

/**
 * PostgreSQL connection pool.
 * The pool is created lazily - no connection is opened until the first
 * query runs, so requiring this file never crashes the app even if the
 * database is not reachable yet.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Unexpected errors on idle clients should not crash the whole process.
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = pool;
