-- CSV Data Import - Database Schema
-- Run this once against your PostgreSQL database before starting the app.

CREATE TABLE IF NOT EXISTS imports (
    id                  SERIAL PRIMARY KEY,
    file_name           VARCHAR(255) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
        CONSTRAINT chk_imports_status
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_records       INT NOT NULL DEFAULT 0 CHECK (total_records >= 0),
    processed_records   INT NOT NULL DEFAULT 0 CHECK (processed_records >= 0),
    successful_records  INT NOT NULL DEFAULT 0 CHECK (successful_records >= 0),
    failed_records      INT NOT NULL DEFAULT 0 CHECK (failed_records >= 0),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP,
    -- processed_records can never exceed total_records, and the
    -- successful+failed breakdown can never exceed what was processed.
    CONSTRAINT chk_imports_processed_le_total CHECK (processed_records <= total_records),
    CONSTRAINT chk_imports_success_fail_le_total CHECK (successful_records + failed_records <= total_records)
);

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    import_id   INT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    email       VARCHAR(255),
    phone       VARCHAR(50),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_errors (
    id          SERIAL PRIMARY KEY,
    import_id   INT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_number  INT NOT NULL,
    reason      TEXT NOT NULL,
    raw_data    JSONB,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_import_id ON customers(import_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON import_errors(import_id);
