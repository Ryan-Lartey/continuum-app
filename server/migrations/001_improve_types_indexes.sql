-- Migration 001: Improve column types and add indexes
-- Run this in the Supabase SQL Editor on your LIVE database.
-- Safe to run on existing data — all casts are compatible.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. updated_at trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. Date columns: TEXT → DATE ────────────────────────────────────────────
-- These casts work for ISO date strings (YYYY-MM-DD) already in the DB.
-- If any rows have non-ISO date strings this will error — check first with:
--   SELECT date FROM kpi_data WHERE date !~ '^\d{4}-\d{2}-\d{2}$' LIMIT 5;

ALTER TABLE kpi_data        ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE observations     ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE tier2_notes      ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE flow_progress    ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE shifts            ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE briefs            ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE ideas             ALTER COLUMN date_finished TYPE DATE USING date_finished::DATE;

-- ─── 3. Timestamp columns: TIMESTAMP → TIMESTAMPTZ ───────────────────────────
ALTER TABLE kpi_data         ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE observations      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE portfolios         ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE portfolios         ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE projects           ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE projects           ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE ideas              ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE ideas              ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE tier2_notes        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE briefs             ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE standalone_maps    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE standalone_maps    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE process_maps       ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE process_maps       ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ─── 4. JSON columns: TEXT → JSONB ───────────────────────────────────────────
-- Check for invalid JSON first if unsure:
--   SELECT id FROM projects WHERE charter !~ '^[\[{]' LIMIT 5;

ALTER TABLE projects        ALTER COLUMN charter        TYPE JSONB USING charter::JSONB;
ALTER TABLE projects        ALTER COLUMN actions        TYPE JSONB USING actions::JSONB;
ALTER TABLE projects        ALTER COLUMN maps           TYPE JSONB USING maps::JSONB;
ALTER TABLE projects        ALTER COLUMN stage_checklist TYPE JSONB USING stage_checklist::JSONB;
ALTER TABLE site_profile    ALTER COLUMN zones          TYPE JSONB USING zones::JSONB;
ALTER TABLE site_profile    ALTER COLUMN primary_kpis   TYPE JSONB USING primary_kpis::JSONB;
ALTER TABLE site_profile    ALTER COLUMN kpi_targets    TYPE JSONB USING kpi_targets::JSONB;
ALTER TABLE site_profile    ALTER COLUMN excel_config   TYPE JSONB USING NULLIF(excel_config,'')::JSONB;
ALTER TABLE tier2_notes     ALTER COLUMN actions        TYPE JSONB USING actions::JSONB;
ALTER TABLE flow_progress   ALTER COLUMN steps          TYPE JSONB USING steps::JSONB;
ALTER TABLE standalone_maps ALTER COLUMN data           TYPE JSONB USING data::JSONB;
ALTER TABLE process_maps    ALTER COLUMN swimlanes      TYPE JSONB USING swimlanes::JSONB;
ALTER TABLE process_maps    ALTER COLUMN nodes          TYPE JSONB USING nodes::JSONB;
ALTER TABLE process_maps    ALTER COLUMN edges          TYPE JSONB USING edges::JSONB;

-- ─── 5. Triggers for updated_at ──────────────────────────────────────────────
CREATE OR REPLACE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER standalone_maps_updated_at
  BEFORE UPDATE ON standalone_maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER process_maps_updated_at
  BEFORE UPDATE ON process_maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kpi_data_date        ON kpi_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_data_metric_id   ON kpi_data(metric_id);
CREATE INDEX IF NOT EXISTS idx_observations_date     ON observations(date DESC);
CREATE INDEX IF NOT EXISTS idx_observations_area     ON observations(area);
CREATE INDEX IF NOT EXISTS idx_projects_portfolio    ON projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage        ON projects(stage);
CREATE INDEX IF NOT EXISTS idx_ideas_portfolio       ON ideas(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_ideas_eval_status     ON ideas(eval_status);
CREATE INDEX IF NOT EXISTS idx_shifts_date           ON shifts(date DESC);
CREATE INDEX IF NOT EXISTS idx_metric_entries_shift  ON metric_entries(shift_id);
CREATE INDEX IF NOT EXISTS idx_tier2_notes_date      ON tier2_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_date           ON briefs(date DESC);
