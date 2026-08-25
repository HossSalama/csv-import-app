const pool = require('../config/database');

/**
 * Data access layer for the `import_errors` table.
 */

async function insertMany(importId, errors) {
  if (!errors.length) return [];

  const values = [];
  const placeholders = errors
    .map((e, i) => {
      const base = i * 4;
      values.push(importId, e.rowNumber, e.reason, JSON.stringify(e.rawData));
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(', ');

  const { rows } = await pool.query(
    `INSERT INTO import_errors (import_id, row_number, reason, raw_data)
     VALUES ${placeholders}
     RETURNING *`,
    values
  );
  return rows;
}

async function findByImportId(importId) {
  const { rows } = await pool.query(
    'SELECT * FROM import_errors WHERE import_id = $1 ORDER BY row_number',
    [importId]
  );
  return rows;
}

module.exports = { insertMany, findByImportId };
