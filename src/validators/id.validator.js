const MAX_PG_INTEGER = 2147483647; // PostgreSQL INTEGER/SERIAL upper bound

/**
 * Validates a route `:id` param against the `imports.id` column type
 * (SERIAL / INTEGER - see database/schema.sql).
 *
 * Without this check, a value like "abc" or "1e10" reaches the
 * repository's `WHERE id = $1` query and Postgres rejects it with
 * "invalid input syntax for type integer". That error is caught by the
 * generic error handler and surfaces as an opaque 500, when it is really
 * a 400 (bad input from the client).
 *
 * Returns { valid: boolean, errors: string[] }
 */
function validateId(rawId) {
  const errors = [];
  const value = String(rawId);

  if (!/^[1-9]\d*$/.test(value)) {
    errors.push('Import id must be a positive integer.');
    return { valid: false, errors };
  }

  if (Number(value) > MAX_PG_INTEGER) {
    errors.push('Import id is out of range.');
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

module.exports = { validateId };
