-- Demo Schema v2 — correct column names matching public schema
-- Run this in Supabase SQL Editor

-- Drop old incorrectly-structured demo tables
DROP TABLE IF EXISTS demo.kpi_data CASCADE;
DROP TABLE IF EXISTS demo.observations CASCADE;
DROP TABLE IF EXISTS demo.portfolios CASCADE;
DROP TABLE IF EXISTS demo.projects CASCADE;
DROP TABLE IF EXISTS demo.ideas CASCADE;
DROP TABLE IF EXISTS demo.flow_progress CASCADE;
DROP TABLE IF EXISTS demo.site_profile CASCADE;
DROP TABLE IF EXISTS demo.tier2_notes CASCADE;
DROP TABLE IF EXISTS demo.maturity_scores CASCADE;
DROP TABLE IF EXISTS demo.briefs CASCADE;
DROP TABLE IF EXISTS demo.standalone_maps CASCADE;
DROP TABLE IF EXISTS demo.process_maps CASCADE;

-- Recreate with correct structure

CREATE TABLE demo.kpi_data (
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

CREATE TABLE demo.observations (
  id SERIAL PRIMARY KEY,
  area TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  severity INTEGER DEFAULT 1,
  text TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.portfolios (
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

CREATE TABLE demo.projects (
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
  portfolio_id INTEGER,
  idea_id INTEGER,
  project_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.ideas (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER,
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
  project_id INTEGER,
  kpi_achieved DOUBLE PRECISION,
  date_finished TEXT,
  notes TEXT DEFAULT '',
  project_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.flow_progress (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  steps TEXT DEFAULT '[]'
);

CREATE TABLE demo.site_profile (
  id SERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'Amazon FC',
  gm_name TEXT DEFAULT '',
  zones TEXT DEFAULT '["Inbound","Stow","Pick","Pack","Dispatch","Yard","Admin"]',
  primary_kpis TEXT DEFAULT '["uph","accuracy","dpmo","dts"]',
  user_name TEXT DEFAULT 'Ryan',
  unit_value DOUBLE PRECISION DEFAULT 0,
  shift_pattern TEXT DEFAULT 'Day',
  kpi_targets TEXT DEFAULT '{"UPH":280,"Accuracy":99.5,"DPMO":20000,"DTS":98}',
  site_notes TEXT DEFAULT '',
  excel_config TEXT,
  last_excel_sync TEXT
);

CREATE TABLE demo.tier2_notes (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  actions TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.maturity_scores (
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

CREATE TABLE demo.briefs (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'morning',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.standalone_maps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  area TEXT DEFAULT '',
  map_type TEXT DEFAULT 'current',
  description TEXT DEFAULT '',
  data TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo.process_maps (
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

-- ── Seed Data ─────────────────────────────────────────────────────────────────

INSERT INTO demo.site_profile (id, site_name, user_name, kpi_targets, shift_pattern)
VALUES (1, 'BHX4 (Demo)', 'Ryan', '{"UPH":280,"Accuracy":99.5,"DPMO":20000,"DTS":98}', 'Day');

-- KPI data: narrow format, one row per metric per day
-- UPH data (last 90 days)
INSERT INTO demo.kpi_data (metric_id, metric_label, value, target, date, shift, signal) VALUES
('uph','UPH',265,280,'2026-01-22','Day',0),
('uph','UPH',271,280,'2026-01-23','Day',0),
('uph','UPH',268,280,'2026-01-24','Day',0),
('uph','UPH',278,280,'2026-01-27','Day',0),
('uph','UPH',272,280,'2026-01-28','Day',0),
('uph','UPH',279,280,'2026-01-30','Day',0),
('uph','UPH',275,280,'2026-01-31','Day',0),
('uph','UPH',281,280,'2026-02-04','Day',0),
('uph','UPH',270,280,'2026-02-05','Day',0),
('uph','UPH',276,280,'2026-02-07','Day',0),
('uph','UPH',258,280,'2026-02-10','Day',1),
('uph','UPH',282,280,'2026-02-11','Day',0),
('uph','UPH',277,280,'2026-02-14','Day',0),
('uph','UPH',283,280,'2026-02-18','Day',0),
('uph','UPH',278,280,'2026-02-19','Day',0),
('uph','UPH',272,280,'2026-02-21','Day',0),
('uph','UPH',284,280,'2026-02-25','Day',0),
('uph','UPH',276,280,'2026-02-27','Day',0),
('uph','UPH',280,280,'2026-03-03','Day',0),
('uph','UPH',285,280,'2026-03-05','Day',0),
('uph','UPH',279,280,'2026-03-07','Day',0),
('uph','UPH',282,280,'2026-03-11','Day',0),
('uph','UPH',274,280,'2026-03-12','Day',0),
('uph','UPH',286,280,'2026-03-14','Day',0),
('uph','UPH',271,280,'2026-03-17','Day',0),
('uph','UPH',283,280,'2026-03-20','Day',0),
('uph','UPH',277,280,'2026-03-24','Day',0),
('uph','UPH',285,280,'2026-03-31','Day',0),
('uph','UPH',271,280,'2026-04-01','Day',0),
('uph','UPH',278,280,'2026-04-02','Day',0),
('uph','UPH',283,280,'2026-04-04','Day',0),
('uph','UPH',270,280,'2026-04-07','Day',0),
('uph','UPH',279,280,'2026-04-08','Day',0),
('uph','UPH',286,280,'2026-04-10','Day',0),
('uph','UPH',274,280,'2026-04-11','Day',0),
('uph','UPH',287,280,'2026-04-15','Day',0),
('uph','UPH',272,280,'2026-04-16','Day',0),
('uph','UPH',280,280,'2026-04-17','Day',0),
('uph','UPH',275,280,'2026-04-21','Day',0);

-- Accuracy
INSERT INTO demo.kpi_data (metric_id, metric_label, value, target, date, shift, signal) VALUES
('accuracy','Pick Accuracy',98.2,99.5,'2026-01-22','Day',0),
('accuracy','Pick Accuracy',98.5,99.5,'2026-01-27','Day',0),
('accuracy','Pick Accuracy',98.9,99.5,'2026-01-30','Day',0),
('accuracy','Pick Accuracy',99.1,99.5,'2026-02-04','Day',0),
('accuracy','Pick Accuracy',97.2,99.5,'2026-02-10','Day',1),
('accuracy','Pick Accuracy',99.2,99.5,'2026-02-11','Day',0),
('accuracy','Pick Accuracy',99.3,99.5,'2026-02-18','Day',0),
('accuracy','Pick Accuracy',98.8,99.5,'2026-02-21','Day',0),
('accuracy','Pick Accuracy',99.3,99.5,'2026-02-25','Day',0),
('accuracy','Pick Accuracy',99.0,99.5,'2026-03-03','Day',0),
('accuracy','Pick Accuracy',99.4,99.5,'2026-03-05','Day',0),
('accuracy','Pick Accuracy',99.1,99.5,'2026-03-11','Day',0),
('accuracy','Pick Accuracy',99.5,99.5,'2026-03-15','Day',0),
('accuracy','Pick Accuracy',99.2,99.5,'2026-03-20','Day',0),
('accuracy','Pick Accuracy',99.3,99.5,'2026-03-31','Day',0),
('accuracy','Pick Accuracy',99.4,99.5,'2026-04-04','Day',0),
('accuracy','Pick Accuracy',99.5,99.5,'2026-04-10','Day',0),
('accuracy','Pick Accuracy',99.5,99.5,'2026-04-15','Day',0),
('accuracy','Pick Accuracy',98.6,99.5,'2026-04-21','Day',0);

-- DPMO
INSERT INTO demo.kpi_data (metric_id, metric_label, value, target, date, shift, signal) VALUES
('dpmo','DPMO',24500,20000,'2026-01-22','Day',1),
('dpmo','DPMO',23100,20000,'2026-01-27','Day',1),
('dpmo','DPMO',21500,20000,'2026-01-30','Day',1),
('dpmo','DPMO',21200,20000,'2026-02-04','Day',1),
('dpmo','DPMO',27500,20000,'2026-02-10','Day',1),
('dpmo','DPMO',20900,20000,'2026-02-11','Day',1),
('dpmo','DPMO',20600,20000,'2026-02-18','Day',1),
('dpmo','DPMO',23600,20000,'2026-02-21','Day',1),
('dpmo','DPMO',20400,20000,'2026-02-25','Day',0),
('dpmo','DPMO',21400,20000,'2026-03-03','Day',1),
('dpmo','DPMO',20100,20000,'2026-03-05','Day',0),
('dpmo','DPMO',21000,20000,'2026-03-11','Day',1),
('dpmo','DPMO',19800,20000,'2026-03-14','Day',0),
('dpmo','DPMO',20800,20000,'2026-03-20','Day',1),
('dpmo','DPMO',20200,20000,'2026-03-31','Day',0),
('dpmo','DPMO',20900,20000,'2026-04-04','Day',1),
('dpmo','DPMO',19900,20000,'2026-04-10','Day',0),
('dpmo','DPMO',19600,20000,'2026-04-15','Day',0),
('dpmo','DPMO',22600,20000,'2026-04-21','Day',1);

-- DTS
INSERT INTO demo.kpi_data (metric_id, metric_label, value, target, date, shift, signal) VALUES
('dts','DTS',96.1,98,'2026-01-22','Day',0),
('dts','DTS',97.2,98,'2026-01-27','Day',0),
('dts','DTS',97.8,98,'2026-01-30','Day',0),
('dts','DTS',98.0,98,'2026-02-04','Day',0),
('dts','DTS',94.3,98,'2026-02-10','Day',1),
('dts','DTS',98.2,98,'2026-02-11','Day',0),
('dts','DTS',98.4,98,'2026-02-18','Day',0),
('dts','DTS',96.4,98,'2026-02-21','Day',0),
('dts','DTS',98.5,98,'2026-02-25','Day',0),
('dts','DTS',97.6,98,'2026-03-03','Day',0),
('dts','DTS',98.6,98,'2026-03-05','Day',0),
('dts','DTS',97.9,98,'2026-03-11','Day',0),
('dts','DTS',98.7,98,'2026-03-14','Day',0),
('dts','DTS',96.9,98,'2026-03-20','Day',0),
('dts','DTS',98.5,98,'2026-03-31','Day',0),
('dts','DTS',98.2,98,'2026-04-04','Day',0),
('dts','DTS',98.6,98,'2026-04-10','Day',0),
('dts','DTS',98.8,98,'2026-04-15','Day',0),
('dts','DTS',96.9,98,'2026-04-21','Day',0);

-- Portfolios
INSERT INTO demo.portfolios (id, name, strategic_objective, primary_kpi, impact_goal, impact_unit, area_focus, status) VALUES
(1, 'Q1 2026 CI Pipeline', 'Drive measurable improvement across all FC KPIs', 'uph', 15, 'UPH improvement', 'All', 'active'),
(2, 'ICQA Excellence', 'Reduce inventory defects to world-class DPMO', 'dpmo', 5000, 'DPMO reduction', 'ICQA', 'active');

-- Projects
INSERT INTO demo.projects (title, stage, metric_id, baseline, target_value, problem_statement, notes, portfolio_id, project_type) VALUES
('Reduce Gross Adjustment DPMO', 'Measure', 'dpmo', 24500, 20000, 'Gross adjustment DPMO running at 24,500 against target of 20,000. Root cause analysis in progress.', 'Week 4 of DMAIC. Measurement phase complete.', 2, 'DMAIC'),
('Outbound UPH Improvement', 'Improve', 'uph', 265, 280, 'OB UPH averaging 268 against target of 280. Primarily constrained by sort allocation and induction rate.', 'Kaizen event completed Feb 2026. Improvements sustaining.', 1, 'Kaizen'),
('Pick Station 5S Refresh', 'Control', 'uph', 271, 280, 'Pick stations showing inconsistent layouts causing productivity loss of ~5 UPH.', 'Shadow boards installed across all 48 stations. Audit schedule in place.', 1, 'Quick Win'),
('Inbound Scan Rate Uplift', 'Analyse', 'accuracy', 94.2, 99.5, 'Scan rate in IB averaging 94.2% against target of 98%. Associates bypassing scan on bulky items.', 'Cause and effect diagram completed. 3 root causes identified.', 1, 'DMAIC'),
('IRDR Reduction Programme', 'Define', 'dpmo', 12400, 10000, 'IRDR running at 12,400 DPMO against target of 10,000. Linked to receive process compliance.', 'Project charter approved. Team assembled.', 2, 'DMAIC');

-- Observations
INSERT INTO demo.observations (area, waste_type, severity, text, date, timestamp) VALUES
('Outbound', 'Safety', 3, 'Trailing cable near sorter station 3 — trip hazard identified during floor walk', '2026-04-18', '2026-04-18T09:15:00'),
('ICQA', 'Defects', 3, 'Adjustment count spike on Tuesday night shift — root cause investigation required', '2026-04-17', '2026-04-17T14:30:00'),
('Inbound', 'Non-Compliance', 2, 'Receive team bypassing scan step on bulky items — 3 associates observed', '2026-04-16', '2026-04-16T10:00:00'),
('Pick', 'Waiting', 2, 'Label printer P07 intermittently offline causing associate waiting and rework', '2026-04-14', '2026-04-14T11:45:00'),
('Stow', 'Motion', 1, 'Stow path routing inefficiency observed — associates travelling excess distance to zones 4-6', '2026-04-11', '2026-04-11T09:00:00');

-- Tier 2 notes
INSERT INTO demo.tier2_notes (date, notes, actions) VALUES
('2026-04-21', 'UPH 275. ACC 98.6%. DPMO trending down week on week. Pick exceeded UPH target for 3rd consecutive day. IB headcount short by 2 due to absence — managed via flex.', '["Chase ICQA on adjustment investigation by EOD","Book 5S audit for OB sorter area this week","Recognise pick team performance at next all-hands"]'),
('2026-04-18', 'UPH 271. DPMO spike on night shift reviewed with ICQA. Label printer P07 causing OB delays — IT ticket raised. Scan rate improving following retraining.', '["IT to fix P07 by Monday","ICQA to provide root cause analysis by Thursday","Follow up on 3 associates identified for scan bypass retraining"]'),
('2026-04-17', 'UPH 265. Adjustment DPMO at 24,500 — above target. Night shift coached on process compliance. IB scan rate improved to 97.1% following targeted coaching.', '["ICQA root cause analysis by EOW","Retrain 3 associates identified on scan bypass","Update Tier 1 board with new DPMO trend chart"]');

-- Maturity scores
INSERT INTO demo.maturity_scores (month, five_s, dmaic, standard_work, visual_mgmt, problem_solving, notes) VALUES
('2026-01', 3, 2, 3, 2, 3, 'Strong 5S baseline. DMAIC capability developing.'),
('2026-02', 3, 3, 3, 3, 3, 'Consistent across all areas. Visual management boards upgraded.'),
('2026-03', 4, 3, 4, 3, 4, 'Significant improvement in standard work compliance following audit.'),
('2026-04', 4, 4, 4, 4, 4, 'DMAIC projects driving measurable results. Problem solving embedded in Tier 2.');
