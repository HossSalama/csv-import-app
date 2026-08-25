const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const ALLOWED_EXTENSION = '.csv';

/**
 * Validates the uploaded file itself (not its content row by row).
 * Returns { valid: boolean, errors: string[] }
 */
function validateFile(file) {
  const errors = [];

  if (!file) {
    return { valid: false, errors: ['No file was uploaded.'] };
  }

  const hasCsvExtension = file.originalname.toLowerCase().endsWith(ALLOWED_EXTENSION);
  const hasCsvMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype);

  if (!hasCsvExtension && !hasCsvMimeType) {
    errors.push('Only .csv files are allowed.');
  }

  if (file.size === 0) {
    errors.push('The uploaded file is empty.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateFile, MAX_FILE_SIZE_BYTES };
