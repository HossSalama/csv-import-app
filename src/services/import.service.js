const fs = require('fs');
const { parseCsvFile } = require('../utils/csv.parser');
const { validateRow } = require('../validators/row.validator');
const { STATUS } = require('../models/import.model');
const logger = require('../utils/logger');

const importRepository = require('../repositories/import.repository');
const customerRepository = require('../repositories/customer.repository');
const importErrorRepository = require('../repositories/import-error.repository');

// Number of rows inserted per SQL statement. This is an arbitrary starting
// point (not benchmarked against this specific schema/hardware) chosen to
// balance "one query per row" (too slow for large files) against "one
// giant query for the whole file" (risks hitting statement/parameter
// limits). Override via BATCH_SIZE env var if you need to tune it.
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 200;

async function removeUploadedFile(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (cleanupError) {
    // Cleanup is best effort. In particular, never allow an unlink failure to
    // replace the import error that caused this request to fail.
    if (cleanupError.code !== 'ENOENT') {
      logger.error(`Failed to remove uploaded file ${filePath}`, cleanupError);
    }
  }
}

/**
 * Full pipeline for a CSV import:
 * Upload -> Parse -> Validate rows -> Insert valid -> Record failed -> Track progress -> Complete
 *
 * TRANSACTION STRATEGY (explicit, not an oversight):
 * This function does NOT wrap the whole import in a single database
 * transaction. Each batch insert (see BATCH_SIZE above) is committed on
 * its own. This is deliberate: since we already report incremental
 * progress via processed_records after every batch, an all-or-nothing
 * transaction would contradict that - a partially processed import that
 * later fails (e.g. the database connection drops mid-way) keeps whatever
 * valid batches were already committed rather than silently rolling all
 * of them back. The import's `status` is set to 'failed' in that case so
 * the caller knows the import did not fully complete, but the customer
 * rows already inserted are NOT removed.
 * If "all rows or none" semantics are required instead, each processImport
 * call would need to run inside a single pg client transaction
 * (BEGIN / COMMIT / ROLLBACK) instead of using the shared pool directly.
 *
 * @param {string} filePath  Path to the file saved on disk by multer
 * @param {string} originalFileName
 * @returns {Promise<Object>} the final import record
 */
async function processImport(filePath, originalFileName) {
  // Declared outside the try block (but not populated by a call outside
  // it) so both the catch and finally blocks below can safely check
  // whether the `imports` row was ever created - including the case
  // where importRepository.create() itself is what throws.
  let importRecord;

  try {
    importRecord = await importRepository.create(originalFileName);

    await importRepository.updateStatus(importRecord.id, STATUS.PROCESSING);

    const rows = await parseCsvFile(filePath);
    const totalRecords = rows.length;

    await importRepository.updateCounts(importRecord.id, { totalRecords });

    const validCustomers = [];
    const failedRows = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 1; // 1-based, human friendly
      const { valid, errors } = validateRow(row);

      if (valid) {
        validCustomers.push({ name: row.name.trim(), email: row.email.trim(), phone: row.phone.trim() });
      } else {
        failedRows.push({ rowNumber, reason: errors.join(' '), rawData: row });
      }
    });

    // Insert in batches (also tracks progress as it goes)
    let processedRecords = 0;
    for (let i = 0; i < validCustomers.length; i += BATCH_SIZE) {
      const batch = validCustomers.slice(i, i + BATCH_SIZE);
      await customerRepository.insertMany(importRecord.id, batch);
      processedRecords += batch.length;
      await importRepository.updateCounts(importRecord.id, { processedRecords });
    }

    for (let i = 0; i < failedRows.length; i += BATCH_SIZE) {
      const batch = failedRows.slice(i, i + BATCH_SIZE);
      await importErrorRepository.insertMany(importRecord.id, batch);
      processedRecords += batch.length;
      await importRepository.updateCounts(importRecord.id, { processedRecords });
    }

    const finalRecord = await importRepository.updateCounts(importRecord.id, {
      successfulRecords: validCustomers.length,
      failedRecords: failedRows.length,
      processedRecords: totalRecords,
    });

    return await importRepository.updateStatus(finalRecord.id, STATUS.COMPLETED);
  } catch (err) {
    // If importRepository.create() is what failed, there is no row to
    // mark as failed - importRecord stays undefined and we just fall
    // through to rethrowing the original error.
    if (importRecord) {
      try {
        await importRepository.updateStatus(importRecord.id, STATUS.FAILED);
      } catch (updateErr) {
        // Marking the row as failed is best-effort cleanup. If it also
        // throws (e.g. the DB connection just dropped), we log it but
        // must NOT let it replace `err` below - the caller (and the
        // logs) need the original failure reason, not this secondary
        // one, otherwise the real cause of the import failing is lost.
        logger.error(
          `Failed to mark import ${importRecord.id} as failed after a processing error`,
          updateErr
        );
      }
    }
    throw err;
  } finally {
    // Clean up the temporary uploaded file regardless of outcome, including
    // when create() itself throws before an imports row exists. Awaiting the
    // cleanup also prevents the process from exiting with an orphaned file,
    // while removeUploadedFile guarantees cleanup cannot mask the original
    // error.
    await removeUploadedFile(filePath);
  }
}

async function getImportStatus(id) {
  return importRepository.findById(id);
}

async function listImports() {
  return importRepository.findAll();
}

async function getImportErrors(id) {
  return importErrorRepository.findByImportId(id);
}

module.exports = { processImport, getImportStatus, listImports, getImportErrors };
