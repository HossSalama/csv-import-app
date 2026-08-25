const fs = require('fs');
const importService = require('../services/import.service');
const { validateFile } = require('../validators/file.validator');
const { validateId } = require('../validators/id.validator');
const { success, failure } = require('../utils/response');

async function removeRejectedUpload(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (cleanupError) {
    // A validation response must remain a 400 even if cleanup fails.
    if (cleanupError.code !== 'ENOENT') {
      console.error(`Failed to remove rejected upload ${filePath}`, cleanupError);
    }
  }
}

/**
 * POST /api/imports
 * Accepts a single CSV file (field name: "file") and runs the full
 * upload -> parse -> validate -> insert pipeline synchronously, then
 * returns the completed import summary.
 */
async function uploadImport(req, res, next) {
  try {
    const { valid, errors } = validateFile(req.file);

    if (!valid) {
      // Multer already wrote the file to disk before we got here - clean it
      // up even on a rejected upload, otherwise rejected files pile up in
      // uploads/ forever.
      if (req.file) {
        await removeRejectedUpload(req.file.path);
      }
      return failure(res, 400, 'File validation failed.', errors);
    }

    const result = await importService.processImport(req.file.path, req.file.originalname);
    return success(res, 201, result);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/imports/:id
 * Returns the current status/counters for a single import.
 */
async function getImportStatus(req, res, next) {
  try {
    const { valid, errors } = validateId(req.params.id);
    if (!valid) {
      return failure(res, 400, 'Invalid import id.', errors);
    }

    const importRecord = await importService.getImportStatus(req.params.id);

    if (!importRecord) {
      return failure(res, 404, `Import with id ${req.params.id} was not found.`);
    }

    return success(res, 200, importRecord);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/imports
 * Lists all imports, most recent first.
 */
async function listImports(req, res, next) {
  try {
    const imports = await importService.listImports();
    return success(res, 200, imports);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/imports/:id/errors
 * Returns the list of rows that failed validation for a given import.
 */
async function getImportErrors(req, res, next) {
  try {
    const { valid, errors } = validateId(req.params.id);
    if (!valid) {
      return failure(res, 400, 'Invalid import id.', errors);
    }

    const importRecord = await importService.getImportStatus(req.params.id);

    if (!importRecord) {
      return failure(res, 404, `Import with id ${req.params.id} was not found.`);
    }

    const importErrors = await importService.getImportErrors(req.params.id);
    return success(res, 200, importErrors);
  } catch (err) {
    return next(err);
  }
}

module.exports = { uploadImport, getImportStatus, listImports, getImportErrors };
