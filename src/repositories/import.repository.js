const pool = require('../config/database');

/**
 * Data access layer for the `imports` table.
 * No business logic lives here - only SQL queries.
 */

async function create(fileName) {
  const { rows } = await pool.query(
    `INSERT INTO imports (file_name, status)
     VALUES ($1, 'pending')
     RETURNING *`,
    [fileName]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM imports WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM imports ORDER BY created_at DESC');
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE imports
     SET status = $2::varchar,
         completed_at = CASE WHEN $2::varchar IN ('completed', 'failed') THEN NOW() ELSE completed_at END
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return rows[0];
}

async function updateCounts(id, { totalRecords, processedRecords, successfulRecords, failedRecords }) {
  const { rows } = await pool.query(
    `UPDATE imports
     SET total_records = COALESCE($2, total_records),
         processed_records = COALESCE($3, processed_records),
         successful_records = COALESCE($4, successful_records),
         failed_records = COALESCE($5, failed_records)
     WHERE id = $1
     RETURNING *`,
    [id, totalRecords, processedRecords, successfulRecords, failedRecords]
  );
  return rows[0];
}

module.exports = {
  create,
  findById,
  findAll,
  updateStatus,
  updateCounts,
};
