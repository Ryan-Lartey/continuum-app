-- Continuum CI — PostgreSQL schema for Supabase
-- Run this in the Supabase SQL Editor to create all tables

CREATE TABLE IF NOT EXISTS kpi_data (
  id SERIAL PRIMARY KEY,
  metric_id TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  target DOUBLE PRECISION,
  date TEXT NOT NULL,
  shift TEXT,
  signal INTEGER DEFAULT 0,
  annotation TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observations (
  id SERIAL PRIMARY KEY,
  area TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  severity INTEGER DEFAULT 1,
  text TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  stage TEXT DEFAULT 'Identify',
  metric_id TEXT,
  baseline DOUBLE PRECISION,
  target_value DOUBLE PRECISION,
  problem_statement TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  charter TEXT DEFAULT '{}',
  actions TEXT DEFAULT '[]',
  maps TEXT DEFAULT '[]',
  stage_checklist TEXT DEFAULT '{}',
  portfolio_id INTEGER REFERENCES portfolios(id),
  idea_id INTEGER,
  project_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
  date_finished TEXT,
  notes TEXT DEFAULT '',
  project_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_progress (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  steps TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS site_profile (
  id SERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'Amazon FC',
  gm_name TEXT DEFAULT '',
  zones TEXT DEFAULT '["Inbound","Stow","Pick","Pack","Dispatch","Yard","Admin"]',
  primary_kpis TEXT DEFAULT '["uph","accuracy","dpmo","dts"]',
  user_name TEXT DEFAULT 'Ryan',
  unit_value DOUBLE PRECISION DEFAULT 0,
  shift_pattern TEXT DEFAULT 'Day',
  kpi_targets TEXT DEFAULT '{"UPH":100,"Accuracy":99.5,"DPMO":500,"DTS":98}',
  site_notes TEXT DEFAULT '',
  excel_config TEXT,
  last_excel_sync TEXT
);

CREATE TABLE IF NOT EXISTS tier2_notes (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  actions TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
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
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'morning',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS standalone_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  area TEXT DEFAULT '',
  map_type TEXT DEFAULT 'current',
  description TEXT DEFAULT '',
  data TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id INTEGER,
  portfolio_id INTEGER,
  swimlanes TEXT DEFAULT '[]',
  nodes TEXT DEFAULT '[]',
  edges TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed site profile if empty
INSERT INTO site_profile (site_name, user_name)
SELECT 'Amazon FC', 'Ryan'
WHERE NOT EXISTS (SELECT 1 FROM site_profile LIMIT 1);
