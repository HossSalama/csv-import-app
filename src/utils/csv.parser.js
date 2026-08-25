const fs = require('fs');
const csv = require('csv-parser');

/**
 * Streams a CSV file from disk and resolves with an array of row objects.
 * Kept separate from business logic (import.service.js) so it can be
 * swapped out or unit tested independently.
 *
 * MEMORY NOTE: the file is read from disk as a stream (so we never hold
 * the raw file bytes in memory), but every parsed row is still collected
 * into a single `rows` array before being returned. For very large CSV
 * files this means peak memory usage scales with the number of rows, not
 * just the file size. This was an accepted trade-off for this submission
 * (see README -> "Production Improvements" for the streaming-batch
 * alternative: validating and inserting rows as they arrive, in batches,
 * instead of buffering the whole parsed file first).
 *
 * @param {string} filePath
 * @returns {Promise<Array<Object>>}
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

module.exports = { parseCsvFile };
