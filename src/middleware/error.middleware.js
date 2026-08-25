const multer = require('multer');
const { failure } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Centralized error handler. Must be registered LAST in app.js
 * (after all routes) so Express treats it as an error-handling middleware.
 *
 * IMPORTANT: for unexpected (500) errors we log the full error server-side
 * but only ever send a generic message to the client. Returning
 * err.message directly to the client would leak internal implementation
 * details (e.g. raw PostgreSQL error text, file paths, query fragments).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    logger.error('Multer upload error', err);
    return failure(res, 400, 'File upload error.', [err.message]);
  }

  if (err.message === 'Only .csv files are allowed.') {
    logger.error('Rejected non-CSV upload', err);
    return failure(res, 400, 'Invalid file type.', [err.message]);
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  return failure(res, 500, 'Internal server error. Please try again later.');
}

function notFoundHandler(req, res) {
  return failure(res, 404, 'Route not found.');
}

module.exports = { errorHandler, notFoundHandler };
