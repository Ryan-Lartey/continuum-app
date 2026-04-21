-- Run this in Supabase SQL editor to create the demo schema with sample data

CREATE SCHEMA IF NOT EXISTS demo;

-- ── Tables (mirrors public schema) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS demo.site_profile (
  id SERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'BHX4',
  region TEXT DEFAULT 'EU',
  shift TEXT DEFAULT 'Day',
  target_uph INTEGER DEFAULT 280,
  excel_config TEXT,
  last_excel_sync TIMESTAMP,
  zone_area_map TEXT
);

INSERT INTO demo.site_profile (id, site_name, region, shift, target_uph)
VALUES (1, 'BHX4 (Demo)', 'EU', 'Day', 280)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS demo.kpi_data (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  shift TEXT,
  uph DOUBLE PRECISION,
  acc DOUBLE PRECISION,
  dpmo DOUBLE PRECISION,
  dts DOUBLE PRECISION,
  headcount_ib INTEGER,
  headcount_ob INTEGER,
  headcount_pick INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.observations (
  id SERIAL PRIMARY KEY,
  date TEXT,
  type TEXT,
  area TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'active',
  phase TEXT DEFAULT 'Define',
  area TEXT,
  owner TEXT,
  champion TEXT,
  start_date TEXT,
  target_date TEXT,
  description TEXT,
  problem_statement TEXT,
  goal TEXT,
  savings DOUBLE PRECISION,
  portfolio_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.ideas (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT,
  submitted_by TEXT,
  status TEXT DEFAULT 'pending',
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.flow_progress (
  id SERIAL PRIMARY KEY,
  project_id INTEGER,
  phase TEXT,
  step TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.tier2_notes (
  id SERIAL PRIMARY KEY,
  date TEXT,
  shift TEXT,
  notes TEXT,
  actions TEXT,
  attendees TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.maturity_scores (
  id SERIAL PRIMARY KEY,
  date TEXT,
  category TEXT,
  score INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.briefs (
  id SERIAL PRIMARY KEY,
  date TEXT,
  shift TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.standalone_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  nodes TEXT,
  edges TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo.process_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  process_type TEXT,
  nodes TEXT,
  edges TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Seed Data ─────────────────────────────────────────────────────────────────

-- KPI data: 90 days of sample data
INSERT INTO demo.kpi_data (date, shift, uph, acc, dpmo, dts, headcount_ib, headcount_ob, headcount_pick) VALUES
('2026-01-20','Day',265,98.2,24500,96.1,42,38,55),
('2026-01-21','Day',271,98.5,23100,96.8,44,40,57),
('2026-01-22','Day',268,97.9,25300,95.4,41,37,54),
('2026-01-23','Day',274,98.7,22800,97.2,45,41,58),
('2026-01-24','Day',260,97.5,26700,94.8,40,36,53),
('2026-01-27','Day',278,98.9,21900,97.5,46,42,59),
('2026-01-28','Day',272,98.3,23800,96.3,43,39,56),
('2026-01-29','Day',266,97.8,25700,95.1,41,37,54),
('2026-01-30','Day',279,99.0,21500,97.8,47,43,60),
('2026-01-31','Day',275,98.6,22600,96.9,45,41,58),
('2026-02-03','Day',263,97.6,26100,95.0,41,37,54),
('2026-02-04','Day',281,99.1,21200,98.0,48,44,61),
('2026-02-05','Day',270,98.4,23400,96.5,44,40,57),
('2026-02-06','Day',264,97.7,25900,95.2,41,37,54),
('2026-02-07','Day',276,98.8,22300,97.0,46,42,59),
('2026-02-10','Day',258,97.2,27500,94.3,39,35,52),
('2026-02-11','Day',282,99.2,20900,98.2,48,44,61),
('2026-02-12','Day',269,98.2,24100,96.2,43,39,56),
('2026-02-13','Day',277,98.7,22100,97.1,46,42,59),
('2026-02-14','Day',273,98.5,23000,96.7,45,41,58),
('2026-02-17','Day',261,97.4,26800,94.6,40,36,53),
('2026-02-18','Day',283,99.3,20600,98.4,49,45,62),
('2026-02-19','Day',268,98.0,24700,96.0,43,39,56),
('2026-02-20','Day',278,98.9,21700,97.4,47,43,60),
('2026-02-21','Day',272,98.4,23600,96.4,44,40,57),
('2026-02-24','Day',265,97.8,25400,95.3,42,38,55),
('2026-02-25','Day',284,99.3,20400,98.5,49,45,62),
('2026-02-26','Day',271,98.3,23300,96.6,44,40,57),
('2026-02-27','Day',276,98.7,22500,97.0,46,42,59),
('2026-02-28','Day',267,97.9,25000,95.5,42,38,55),
('2026-03-03','Day',280,99.0,21400,97.6,47,43,60),
('2026-03-04','Day',263,97.5,26300,94.9,41,37,54),
('2026-03-05','Day',285,99.4,20100,98.6,50,46,63),
('2026-03-06','Day',270,98.2,24000,96.1,44,40,57),
('2026-03-07','Day',279,98.8,21800,97.3,47,43,60),
('2026-03-10','Day',266,97.8,25600,95.2,42,38,55),
('2026-03-11','Day',282,99.1,21000,97.9,48,44,61),
('2026-03-12','Day',274,98.5,22900,96.8,45,41,58),
('2026-03-13','Day',261,97.3,27000,94.5,40,36,53),
('2026-03-14','Day',286,99.5,19800,98.7,50,46,63),
('2026-03-17','Day',271,98.3,23700,96.5,44,40,57),
('2026-03-18','Day',277,98.8,22200,97.1,46,42,59),
('2026-03-19','Day',264,97.6,26000,95.0,41,37,54),
('2026-03-20','Day',283,99.2,20800,98.3,49,45,62),
('2026-03-21','Day',275,98.6,22700,96.9,45,41,58);

-- Portfolio
INSERT INTO demo.portfolios (id, name, description, owner) VALUES
(1, 'Q1 2026 CI Pipeline', 'Continuous improvement projects for Q1', 'Ryan Lartey'),
(2, 'ICQA Excellence', 'Inventory accuracy and quality programmes', 'Ryan Lartey')
ON CONFLICT DO NOTHING;

-- Projects
INSERT INTO demo.projects (title, type, status, phase, area, owner, start_date, target_date, problem_statement, goal, savings, portfolio_id) VALUES
('Reduce Gross Adjustment DPMO', 'DMAIC', 'active', 'Measure', 'ICQA', 'Ryan Lartey', '2026-01-06', '2026-04-30', 'Gross adjustment DPMO running at 24,500 against target of 20,000', 'Reduce to below 20,000 DPMO by end of Q1', 45000, 2),
('Outbound UPH Improvement', 'Kaizen', 'active', 'Improve', 'Outbound', 'Ryan Lartey', '2026-02-01', '2026-03-31', 'OB UPH averaging 268 against target of 280', 'Sustain UPH above 280 across all shifts', 28000, 1),
('Pick Station 5S Refresh', 'Quick Win', 'completed', 'Control', 'Pick', 'Ryan Lartey', '2026-01-15', '2026-02-15', 'Pick stations showing inconsistent layouts causing productivity loss', 'Standardise all 48 pick stations to shadow-board layout', 12000, 1),
('Inbound Scan Rate Uplift', 'DMAIC', 'active', 'Analyse', 'Inbound', 'Ryan Lartey', '2026-02-10', '2026-05-31', 'Scan rate in IB averaging 94.2% against target of 98%', 'Achieve sustained 98%+ scan rate in IB', 33000, 1),
('IRDR Reduction Programme', 'DMAIC', 'active', 'Define', 'ICQA', 'Ryan Lartey', '2026-03-01', '2026-06-30', 'IRDR running at 12,400 DPMO against target of 10,000', 'Reduce IRDR to below 10,000 DPMO', 52000, 2);

-- Observations
INSERT INTO demo.observations (date, type, area, description, status, priority) VALUES
('2026-04-18', 'Safety', 'Outbound', 'Trailing cable near sorter station 3 — trip hazard', 'open', 'high'),
('2026-04-17', 'Quality', 'ICQA', 'Adjustment count spike on Tuesday night shift — investigate root cause', 'open', 'high'),
('2026-04-16', 'Process', 'Inbound', 'Receive team bypassing scan step on bulky items', 'in_progress', 'medium'),
('2026-04-15', 'Positive', 'Pick', 'Pick team exceeded UPH target for 3rd consecutive day — recognise at Tier 2', 'closed', 'low'),
('2026-04-14', 'Process', 'Outbound', 'Label printer P07 intermittently offline causing rework', 'in_progress', 'medium');

-- Tier 2 notes
INSERT INTO demo.tier2_notes (date, shift, notes, actions, attendees) VALUES
('2026-04-21', 'Day', 'UPH: 278. ACC: 98.6%. DPMO trending down week on week. Pick exceeded target 3 days running.', 'Chase ICQA on adjustment investigation. Book 5S audit for OB sorter area.', 'Ryan Lartey, James Haddy, OB AM, IB AM'),
('2026-04-18', 'Day', 'UPH: 271. DPMO spike on night shift reviewed. Label printer P07 causing OB delays.', 'IT to fix P07 by Monday. ICQA to deep-dive adjustment trend.', 'Ryan Lartey, James Haddy, OB AM'),
('2026-04-17', 'Day', 'UPH: 265. Adjustment DPMO at 24,500 — above target. Night shift coached on process compliance.', 'ICQA root cause analysis by EOW. Retrain 3 associates identified on scan bypass.', 'Ryan Lartey, James Haddy, IB AM, ICQA Lead');
