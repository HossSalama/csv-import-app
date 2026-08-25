# CSV Data Import API

A Node.js + Express REST API implementing the **EPIC: CSV Data Import** requirements:
upload a CSV file of customer records, validate and import valid rows, and expose
the result of each import (total / successful / failed records).

## Tech Stack

- **Node.js** + **Express**
- **PostgreSQL** (raw SQL via the `pg` driver — no ORM)
- **Multer** for file uploads
- **csv-parser** for CSV parsing
- **Jest** + **Supertest** for unit and integration tests
- **Docker** + **docker-compose** (optional, bonus)

## Architecture

```
src/
├── config/         # database connection pool
├── routes/         # HTTP endpoints -> controllers
├── controllers/     # HTTP layer only (req/res), no business logic
├── services/        # business logic (upload -> parse -> validate -> insert -> track)
├── repositories/     # SQL data access layer (imports, customers, import_errors)
├── validators/       # file-level and row-level validation
├── middleware/       # multer upload config + centralized error handler
├── models/           # shape/documentation objects (no ORM)
├── utils/            # CSV parsing, logger, response helpers
└── app.js            # Express app configuration

server.js             # process entry point (starts the HTTP server)
database/schema.sql    # table definitions + constraints
tests/                 # unit tests, integration tests, and CSV fixtures
Dockerfile             # container image for the API
docker-compose.yml      # API + PostgreSQL, one command to run both
```

**Request flow:** `Route → Controller → Service → (Validators + CSV Parser) → Repositories → PostgreSQL`

### Why this architecture (Design Decisions)

- **Layered architecture (Route/Controller/Service/Repository)** instead of putting
  everything in the route handler: each layer has one job, so the SQL can change
  without touching validation logic, and the validation logic can be unit tested
  with zero database dependency (see `tests/row.validator.test.js` and
  `tests/file.validator.test.js`).
- **No ORM, raw SQL via `pg`**: this was a deliberate choice for full control over
  query shape (multi-row batch inserts, `COALESCE`-based partial updates) and to
  keep the dependency footprint small. The trade-off is more manual SQL to
  maintain and no automatic migrations.
- **PostgreSQL over a JSON-file store**: the data is inherently relational
  (`imports` 1-to-many `customers`/`import_errors`), counts need to stay
  consistent under concurrent writes, and CHECK constraints let the database
  itself enforce data integrity (see "Database Schema" below) rather than
  relying purely on application code.
- **Batch inserts (`BATCH_SIZE`, default 200, configurable via env var)** instead
  of one `INSERT` per row: one query per row does not scale to large files: each
  query is a network round-trip. A single giant `INSERT` for the whole file risks
  hitting statement/parameter limits and makes progress tracking impossible.
  Batching splits the difference and also lets us update `processed_records`
  incrementally (Task-008 "Track progress").
- **Synchronous processing** (the CSV is fully parsed, validated, and inserted
  within the same HTTP request/response cycle) instead of a background job queue:
  simpler to build, test, and reason about for the expected file sizes in this
  assessment. See "Production Improvements" below for what changes at larger scale.

## Database Schema

```
 imports                    customers                 import_errors
 ─────────────────          ─────────────────         ─────────────────
 id            PK    ┐      id            PK          id            PK
 file_name            │      import_id     FK ─┐        import_id     FK ─┐
 status               │      name                │        row_number       │
 total_records        │      email               │        reason           │
 processed_records    │      phone                │        raw_data (JSONB)│
 successful_records   │      created_at            │        created_at      │
 failed_records       │                            │                       │
 created_at           │                            │                       │
 completed_at        └──────────── 1-to-many ──────┴──────── 1-to-many ────┘
```

- `imports` — one row per CSV upload/processing job.
- `customers` — one row per CSV row that passed validation, linked back to its import.
- `import_errors` — one row per CSV row that failed validation, with the row
  number and human-readable reason, linked back to its import.

**Database-level constraints** (`database/schema.sql`), enforced by PostgreSQL
itself, not just application code:
- `status` can only ever be `pending`, `processing`, `completed`, or `failed`
  (`CHECK` constraint) — an invalid status value is rejected at the database
  layer even if application code has a bug.
- `processed_records <= total_records` — processed count can never exceed the
  file's total row count.
- `successful_records + failed_records <= total_records` — the success/failure
  breakdown can never logically exceed the total.

## Setup

### Option A — Docker (recommended, no local PostgreSQL install needed)

Requires only [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

This starts two containers:
- `db` — PostgreSQL 16, with `database/schema.sql` applied automatically on first run
- `app` — the Node.js API, listening on `http://localhost:3000`

`app` waits for `db`'s healthcheck (`pg_isready`) before starting, so it never
races the database on startup.

To stop: `docker compose down` (add `-v` to also wipe the database volume).

> **Verification note**: `docker-compose.yml` and `Dockerfile` were validated for
> correct syntax, and `docker build` was run against the `Dockerfile` directly in
> the development sandbox used for this submission — Docker parsed and accepted
> every build step correctly. The build only stopped at pulling the
> `node:18-alpine` base image, because that sandbox's network is restricted to a
> small allow-list of domains that does not include Docker Hub. This is an
> environment restriction, not a project issue — on a normal machine with regular
> internet access, `docker compose up --build` will pull the base images and run
> normally. Please run it once on your machine to confirm end-to-end; the manual
> setup path (Option B below) was fully tested end-to-end with a real PostgreSQL
> instance and is confirmed working.

### Option B — Manual (local Node.js + PostgreSQL)

#### 1. Prerequisites
- Node.js 18+
- A running PostgreSQL instance (local or Docker)

#### 2. Install dependencies
```bash
npm install
```

#### 3. Configure environment
```bash
cp .env.example .env
# then edit .env with your real PostgreSQL connection string
```

#### 4. Create the database schema
```bash
psql -U <user> -d <database> -f database/schema.sql
```

#### 5. Run the app
```bash
npm run dev     # development, auto-restart via nodemon
npm start        # production
```

The API will be available at `http://localhost:3000`.

#### 6. Run tests
```bash
npm test
```
This runs **both** the unit tests (`tests/row.validator.test.js`,
`tests/file.validator.test.js` — no database needed) and the integration tests
(`tests/integration/api.test.js` — exercises the real Express app against a real
PostgreSQL database, requires `DATABASE_URL` to point at a database with the
schema already applied).

## API Endpoints

| Method | Endpoint                  | Description                                   |
|--------|----------------------------|------------------------------------------------|
| GET    | `/health`                  | Health check                                   |
| POST   | `/api/imports`             | Upload a CSV file (form field: `file`) and process it |
| GET    | `/api/imports`             | List all imports                               |
| GET    | `/api/imports/:id`         | Get the status/summary of a single import      |
| GET    | `/api/imports/:id/errors`  | Get the list of rows that failed validation    |

### HTTP status codes used

| Code | When |
|------|------|
| 200  | Successful `GET` request |
| 201  | Successful `POST /api/imports` (a new import resource was created and processed) |
| 400  | No file attached, wrong file type/size/empty file, or malformed multipart request |
| 404  | `:id` does not correspond to an existing import |
| 500  | Unexpected server error (e.g. database unreachable) — the client only ever gets a generic message; full details are logged server-side (see "Error handling" below) |

### GET /health
```bash
curl http://localhost:3000/health
```
```json
{ "status": "ok" }
```

### POST /api/imports — upload and process a CSV file
```bash
curl -F "file=@tests/fixtures/valid-customers.csv" http://localhost:3000/api/imports
```
Success response (`201`):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "file_name": "valid-customers.csv",
    "status": "completed",
    "total_records": 3,
    "processed_records": 3,
    "successful_records": 3,
    "failed_records": 0,
    "created_at": "2026-08-25T10:00:00.000Z",
    "completed_at": "2026-08-25T10:00:01.000Z"
  }
}
```
Error response — no file attached or file rejected (`400`):
```json
{
  "success": false,
  "message": "File validation failed.",
  "errors": ["Only .csv files are allowed."]
}
```

### GET /api/imports — list all imports
```bash
curl http://localhost:3000/api/imports
```
```json
{ "success": true, "data": [ { "id": 2, "file_name": "...", "status": "completed", "...": "..." } ] }
```

### GET /api/imports/:id — status of a single import
```bash
curl http://localhost:3000/api/imports/1
```
Success (`200`): same shape as the upload response's `data` object.

Not found (`404`):
```json
{ "success": false, "message": "Import with id 999 was not found.", "errors": [] }
```

### GET /api/imports/:id/errors — failed rows for an import
```bash
curl http://localhost:3000/api/imports/2/errors
```
```json
{
  "success": true,
  "data": [
    { "id": 1, "import_id": 2, "row_number": 2, "reason": "\"email\" is not a valid email address.", "raw_data": { "name": "Mohamed Hassan", "email": "invalid-email", "phone": "01000000002" }, "created_at": "..." }
  ]
}
```
An import with no failed rows returns `"data": []` (not an error).

### Generic error response shape (500)
```json
{ "success": false, "message": "Internal server error. Please try again later.", "errors": [] }
```

## Error handling

Unexpected errors (e.g. the database is unreachable, a query fails for a reason
unrelated to user input) are caught by a centralized Express error-handling
middleware (`src/middleware/error.middleware.js`). The **full error, including
stack trace, is logged server-side** via `src/utils/logger.js`, but the client
only ever receives a generic `"Internal server error."` message. This is
deliberate: returning `err.message` directly to the client (an earlier version
of this project did this) can leak internal details — raw PostgreSQL error text,
query fragments, file system paths — that are useful to an attacker and are not
the client's business. Validation errors (400s), by contrast, *are* returned
with specific detail (e.g. "Only .csv files are allowed."), since those are
meant to help the caller fix their request.

## Validation Rules

**File-level** (`src/validators/file.validator.js`):
- Must be a `.csv` file
- Must not be empty (0 bytes)
- Must not exceed 5MB

**Row-level** (`src/validators/row.validator.js`):
- `name` — required
- `email` — required, must match a valid email format
- `phone` — required, must match a valid phone format

Rows that fail validation are **not** discarded silently — they are recorded in the
`import_errors` table with the row number and reason, retrievable via
`GET /api/imports/:id/errors`.

Note there are two separate CSV-type checks (Multer's `fileFilter` in
`upload.middleware.js`, and `file.validator.js`). This is intentional, not
accidental duplication: Multer's filter rejects an obviously-wrong file
*before* it's even written to disk (cheaper), while `file.validator.js` is the
single source of truth for *why* a file was rejected (empty, oversized, wrong
type) with consistent, testable error messages.

## Assumptions

The assessment resources (EPIC/User Stories/Tasks PDF) describe the workflow but do
**not** specify the actual CSV column schema. Every item below is a decision made
in the absence of that information, and is called out explicitly so a reviewer
can tell "chosen by me" apart from "given by the spec":

- **CSV schema**: assumed three columns — `name`, `email`, `phone`. Two sample
  fixtures are included under `tests/fixtures/` (one fully valid, one with
  intentionally invalid rows) for manual testing and the automated test suite.
- **Processing model**: synchronous within the request (see Design Decisions).
- **Duplicate imports**: uploading the same CSV file (same name, same content)
  twice is **not** deduplicated — each upload always creates a brand-new
  `imports` row and re-inserts the valid rows as new `customers` rows. There is
  no uniqueness check across imports. If the intended behavior is instead "skip
  or merge if this exact file was already imported," that would need an explicit
  dedup key (e.g. a hash of the file content) which the spec did not define.
- **Empty CSV (header row only, zero data rows)**: treated as a **valid**,
  successfully completed import with `total_records: 0`. This was chosen over
  treating it as an error because a header-only file is not malformed — it's a
  legitimate (if unusual) file describing zero customers.
- **Malformed CSV syntax** (e.g. broken quoting): the CSV parser does its best
  to parse what it can; whatever rows come out (even if garbled into fewer/more
  fields than expected) go through the normal row validator, which will
  typically reject them for missing required fields rather than causing a crash.
  There is no separate "the file itself is corrupt" error path distinct from
  "these rows failed validation."
- **Uploaded files are stored temporarily** in `uploads/` and deleted
  automatically once processing finishes — whether it completes, fails, or is
  rejected during file-level validation.

## Testing

- **Unit tests** (`tests/row.validator.test.js`, `tests/file.validator.test.js`):
  no database required, test the validators in isolation.
- **Integration tests** (`tests/integration/api.test.js`): use Supertest against
  the real Express app and a real PostgreSQL database (whatever `DATABASE_URL`
  points to). They cover: `/health`, uploading a valid CSV end-to-end, uploading
  a CSV with invalid rows, rejecting a non-CSV file, rejecting a request with no
  file, listing imports, fetching a single import's status, fetching an import's
  failed-row errors, and 404 handling for a non-existent import id.
- Run everything with one command: `npm test`.

## Production Improvements

Changes that would make sense at larger scale or in a real production
deployment, beyond what this submission implements:

- **Background job queue** (e.g. BullMQ + Redis, or a dedicated worker process)
  instead of synchronous in-request processing, so very large uploads don't tie
  up an HTTP request/response cycle or risk a client timeout.
- **True streaming validation/insertion**: currently the whole parsed CSV is
  held in memory as an array before any database writes happen (see the note in
  `src/utils/csv.parser.js`). At larger file sizes, validating and inserting
  rows in batches *as they stream in* (rather than after the whole file is
  parsed) would bound memory usage independent of file size.
  Object storage (e.g. S3) for uploaded files instead of local disk, so the API
  can run as multiple stateless replicas behind a load balancer.
- **Authentication/authorization**: the EPIC references "as an administrator"
  but no auth mechanism was specified; a real deployment would add this
  (e.g. JWT-based auth, role checks on the upload endpoint).
- **Structured logging** (e.g. `pino` or `winston`) with log levels and
  JSON output, instead of the minimal `console.log`-based logger used here,
  for easier ingestion into a log aggregation system.
- **Idempotency/deduplication** for repeated uploads of the same file (see
  "Assumptions" above), likely via a content hash unique constraint.
- **Rate limiting** on the upload endpoint to prevent abuse.

## Incomplete / Not Implemented

- **Authentication/authorization** — not implemented (see Assumptions/Production
  Improvements above); all endpoints are currently open.
- **Async/queued processing** for very large CSV files — not implemented, all
  processing is synchronous (see Design Decisions above).
- **True streaming validation** (validate+insert as rows arrive, without
  buffering the full parsed file in memory first) — not implemented; the current
  implementation buffers all parsed rows before inserting (see "Production
  Improvements").
- **Single-transaction ("all rows or nothing") import semantics** — not
  implemented by design; see the transaction-strategy note in
  `src/services/import.service.js`. Each batch commits independently, so a
  failure partway through an import leaves already-processed batches persisted
  rather than rolling the whole import back.
