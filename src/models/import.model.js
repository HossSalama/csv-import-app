/**
 * Import - represents a single CSV upload/processing job.
 * This project uses plain SQL (no ORM), so this "model" is a thin
 * shape/documentation object plus a couple of helpers used across the app.
 *
 * Columns (see database/schema.sql):
 *  id, file_name, status, total_records, processed_records,
 *  successful_records, failed_records, created_at, completed_at
 */

const STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

module.exports = { STATUS };
