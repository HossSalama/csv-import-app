const request = require('supertest');
const path = require('path');
const pool = require('../../src/config/database');
const app = require('../../src/app');

/**
 * INTEGRATION TESTS - these hit the real Express app AND a real PostgreSQL
 * database (whatever DATABASE_URL in your environment points to). They are
 * intentionally separate from the pure unit tests in row.validator.test.js
 * / file.validator.test.js, which need no database at all.
 *
 * Requirements to run this file:
 *   1. A PostgreSQL database reachable via DATABASE_URL (see .env)
 *   2. database/schema.sql already applied to it
 *
 * Each test cleans the tables it touches so the suite can be re-run
 * repeatedly without manual cleanup.
 */

const VALID_CSV = path.join(__dirname, '..', 'fixtures', 'valid-customers.csv');
const INVALID_ROWS_CSV = path.join(__dirname, '..', 'fixtures', 'invalid-customers.csv');
const BAD_EXTENSION_FILE = path.join(__dirname, '..', 'fixtures', 'not-a-csv.txt');

beforeAll(async () => {
  await pool.query('TRUNCATE imports, customers, import_errors RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('GET /health', () => {
  test('responds with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/imports', () => {
  test('rejects a request with no file attached', async () => {
    const res = await request(app).post('/api/imports');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects a non-csv file', async () => {
    const res = await request(app).post('/api/imports').attach('file', BAD_EXTENSION_FILE);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('uploads and fully processes a valid CSV file end-to-end', async () => {
    const res = await request(app).post('/api/imports').attach('file', VALID_CSV);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      file_name: 'valid-customers.csv',
      status: 'completed',
      total_records: 3,
      processed_records: 3,
      successful_records: 3,
      failed_records: 0,
    });
    expect(res.body.data.id).toEqual(expect.any(Number));
  });

  test('uploads a CSV with invalid rows and records them as failures, not a crash', async () => {
    const res = await request(app).post('/api/imports').attach('file', INVALID_ROWS_CSV);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.total_records).toBe(4);
    expect(res.body.data.successful_records).toBe(1);
    expect(res.body.data.failed_records).toBe(3);
  });
});

describe('GET /api/imports', () => {
  test('lists all imports, most recent first', async () => {
    const res = await request(app).get('/api/imports');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/imports/:id', () => {
  test.each(['0', 'abc', '1e10', '2147483648'])('returns 400 for invalid id "%s"', async (id) => {
    const res = await request(app).get(`/api/imports/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns the summary for an existing import', async () => {
    const uploadRes = await request(app).post('/api/imports').attach('file', VALID_CSV);
    const importId = uploadRes.body.data.id;

    const res = await request(app).get(`/api/imports/${importId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(importId);
    expect(res.body.data.status).toBe('completed');
  });

  test('returns 404 for an import id that does not exist', async () => {
    const res = await request(app).get('/api/imports/999999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/imports/:id/errors', () => {
  test('returns 400 for a non-positive id', async () => {
    const res = await request(app).get('/api/imports/0/errors');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns the failed rows with reasons for an import that had failures', async () => {
    const uploadRes = await request(app).post('/api/imports').attach('file', INVALID_ROWS_CSV);
    const importId = uploadRes.body.data.id;

    const res = await request(app).get(`/api/imports/${importId}/errors`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toHaveProperty('row_number');
    expect(res.body.data[0]).toHaveProperty('reason');
  });

  test('returns an empty array for an import that had no failures', async () => {
    const uploadRes = await request(app).post('/api/imports').attach('file', VALID_CSV);
    const importId = uploadRes.body.data.id;

    const res = await request(app).get(`/api/imports/${importId}/errors`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('returns 404 for an import id that does not exist', async () => {
    const res = await request(app).get('/api/imports/999999/errors');
    expect(res.status).toBe(404);
  });
});
