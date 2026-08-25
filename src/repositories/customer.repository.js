const pool = require('../config/database');

/**
 * Data access layer for the `customers` table.
 */

async function insertMany(importId, customers) {
  if (!customers.length) return [];

  // Build a single multi-row INSERT for efficiency instead of one query per row.
  const values = [];
  const placeholders = customers
    .map((c, i) => {
      const base = i * 4;
      values.push(importId, c.name, c.email, c.phone);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(', ');

  const { rows } = await pool.query(
    `INSERT INTO customers (import_id, name, email, phone)
     VALUES ${placeholders}
     RETURNING *`,
    values
  );
  return rows;
}

async function findByImportId(importId) {
  const { rows } = await pool.query(
    'SELECT * FROM customers WHERE import_id = $1 ORDER BY id',
    [importId]
  );
  return rows;
}

module.exports = { insertMany, findByImportId };
