/**
 * Minimal logging utility. Kept intentionally simple (no external
 * dependency like winston/pino) since the assessment does not require a
 * full observability stack - but centralizing it here means swapping to a
 * real logger later only touches this one file.
 */

function timestamp() {
  return new Date().toISOString();
}

function info(message, meta) {
  console.log(`[${timestamp()}] [INFO] ${message}`, meta || '');
}

function error(message, err) {
  console.error(`[${timestamp()}] [ERROR] ${message}`, err && err.stack ? err.stack : err || '');
}

module.exports = { info, error };
