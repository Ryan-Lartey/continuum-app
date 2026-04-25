-- Continuum CI — PostgreSQL schema for Supabase
-- Run this in the Supabase SQL Editor to create all tables

-- ─── Auto-update trigger for updated_at columns ───────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS kpi_data (
  id SERIAL PRIMARY KEY,
  metric_id TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  target DOUBLE PRECISION,
  date DATE NOT NULL,
  shift TEXT,
  signal INTEGER DEFAULT 0,
  annotation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observations (
  id SERIAL PRIMARY KEY,
  area TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  severity INTEGER DEFAULT 1,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  strategic_objective TEXT DEFAULT '',
  primary_kpi TEXT DEFAULT 'uph',
  impact_goal DOUBLE PRECISION DEFAULT 0,
  impact_unit TEXT DEFAULT 'UPH improvement',
  area_focus TEXT DEFAULT 'All',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  stage TEXT DEFAULT 'Identify',
  metric_id TEXT,
  baseline DOUBLE PRECISION,
  target_value DOUBLE PRECISION,
  problem_statement TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  charter JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  maps JSONB DEFAULT '[]',
  stage_checklist JSONB DEFAULT '{}',
  portfolio_id INTEGER REFERENCES portfolios(id),
  idea_id INTEGER,
  project_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ideas (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  area TEXT DEFAULT '',
  waste_type TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  pipeline_stage TEXT DEFAULT 'idea',
  eval_status TEXT DEFAULT 'pending',
  impact TEXT DEFAULT 'medium',
  difficulty TEXT DEFAULT 'standard',
  metric_id TEXT DEFAULT '',
  baseline DOUBLE PRECISION,
  target_value DOUBLE PRECISION,
  estimated_weeks INTEGER DEFAULT 4,
  project_id INTEGER REFERENCES projects(id),
  kpi_achieved DOUBLE PRECISION,
  date_finished DATE,
  notes TEXT DEFAULT '',
  project_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS flow_progress (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  steps JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS site_profile (
  id SERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'Amazon FC',
  gm_name TEXT DEFAULT '',
  zones JSONB DEFAULT '["Inbound","Stow","Pick","Pack","Dispatch","Yard","Admin"]',
  primary_kpis JSONB DEFAULT '["uph","accuracy","dpmo","dts"]',
  user_name TEXT DEFAULT 'Ryan',
  unit_value DOUBLE PRECISION DEFAULT 0,
  shift_pattern TEXT DEFAULT 'Day',
  kpi_targets JSONB DEFAULT '{"UPH":100,"Accuracy":99.5,"DPMO":500,"DTS":98}',
  site_notes TEXT DEFAULT '',
  excel_config JSONB,
  last_excel_sync TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tier2_notes (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  notes TEXT DEFAULT '',
  actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maturity_scores (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  five_s INTEGER DEFAULT 1,
  dmaic INTEGER DEFAULT 1,
  standard_work INTEGER DEFAULT 1,
  visual_mgmt INTEGER DEFAULT 1,
  problem_solving INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS briefs (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'morning',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS standalone_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  area TEXT DEFAULT '',
  map_type TEXT DEFAULT 'current',
  description TEXT DEFAULT '',
  data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER standalone_maps_updated_at
  BEFORE UPDATE ON standalone_maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS process_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER,
  portfolio_id INTEGER,
  swimlanes JSONB DEFAULT '[]',
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER process_maps_updated_at
  BEFORE UPDATE ON process_maps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed site profile if empty
INSERT INTO site_profile (site_name, user_name)
SELECT 'Amazon FC', 'Ryan'
WHERE NOT EXISTS (SELECT 1 FROM site_profile LIMIT 1);

-- ─── Warehouse Health Score System ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS section_metrics (
  id SERIAL PRIMARY KEY,
  section_id TEXT NOT NULL,
  name TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  target DOUBLE PRECISION NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('higher', 'lower')),
  severity_weight INTEGER NOT NULL DEFAULT 5 CHECK (severity_weight BETWEEN 1 AND 10),
  unit TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'incomplete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, shift_type)
);

CREATE TABLE IF NOT EXISTS metric_entries (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  metric_id INTEGER NOT NULL REFERENCES section_metrics(id),
  actual_value DOUBLE PRECISION,
  metric_score DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shift_id, metric_id)
);

CREATE TABLE IF NOT EXISTS section_health_scores (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  score DOUBLE PRECISION,
  status TEXT DEFAULT 'incomplete' CHECK (status IN ('complete', 'incomplete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, section_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
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
