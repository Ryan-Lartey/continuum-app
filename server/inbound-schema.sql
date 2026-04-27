-- Inbound Operations Module — run in Supabase SQL Editor (public schema)

CREATE TABLE IF NOT EXISTS inbound_entries (
  id                   SERIAL PRIMARY KEY,
  entry_date           TEXT NOT NULL,
  shift                TEXT NOT NULL CHECK(shift IN ('day','night')),
  week_number          INTEGER NOT NULL,
  year                 INTEGER NOT NULL,
  parcel_units         INTEGER DEFAULT 0,
  parcel_hours         DOUBLE PRECISION DEFAULT 0,
  vendor_units         INTEGER DEFAULT 0,
  vendor_hours         DOUBLE PRECISION DEFAULT 0,
  transfer_units       INTEGER DEFAULT 0,
  transfer_hours       DOUBLE PRECISION DEFAULT 0,
  stow_units           INTEGER DEFAULT 0,
  stow_hours           DOUBLE PRECISION DEFAULT 0,
  backlog_rcv_total    INTEGER DEFAULT 0,
  notes                TEXT DEFAULT '',
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);

CREATE TABLE IF NOT EXISTS inbound_targets (
  id           SERIAL PRIMARY KEY,
  metric_key   TEXT UNIQUE NOT NULL,
  target_value DOUBLE PRECISION NOT NULL,
  updated_at   TIMESTAMP DEFAULT NOW()
);

INSERT INTO inbound_targets (metric_key, target_value) VALUES
  ('parcel_uph',   100),
  ('vendor_uph',   250),
  ('transfer_uph', 100),
  ('rcv_uph',      150),
  ('stow_uph',     150)
ON CONFLICT (metric_key) DO NOTHING;
