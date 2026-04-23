-- Demo patch v3 — project_type normalisation + warehouse health tables
-- Run in Supabase SQL Editor (after demo-schema-v2.sql)

-- ─── 1. Normalise existing project_type values to new UI keys ──────────────
-- UI filters expect: quick_win | yellow_belt | green_belt | black_belt | investigation

UPDATE demo.projects SET project_type = 'green_belt'  WHERE project_type = 'DMAIC';
UPDATE demo.projects SET project_type = 'yellow_belt' WHERE project_type = 'Kaizen';
UPDATE demo.projects SET project_type = 'quick_win'   WHERE project_type = 'Quick Win';

-- Add one investigation + one black belt so every filter has something to show
INSERT INTO demo.projects (title, stage, metric_id, baseline, target_value, problem_statement, notes, portfolio_id, project_type) VALUES
('Sorter #3 Downtime Spike Investigation', 'Define', 'uph', 268, 280,
 'Unplanned sorter #3 stoppages up 3x week-on-week. Need rapid RCA before escalating to Kaizen.',
 'Investigation opened after 2026-04-17 floor walk. Data collection underway.', 1, 'investigation'),
('End-to-End DPMO Reduction (Black Belt)', 'Analyse', 'dpmo', 22500, 15000,
 'Cross-functional programme to drive sustained DPMO below 15k across all zones.',
 'Multi-quarter initiative. Charter signed off by ACES lead.', 2, 'black_belt');

-- ─── 2. Warehouse Health Score tables in demo schema ───────────────────────

DROP TABLE IF EXISTS demo.section_health_scores CASCADE;
DROP TABLE IF EXISTS demo.metric_entries CASCADE;
DROP TABLE IF EXISTS demo.shifts CASCADE;
DROP TABLE IF EXISTS demo.section_metrics CASCADE;

CREATE TABLE demo.section_metrics (
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

CREATE TABLE demo.shifts (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'incomplete')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, shift_type)
);

CREATE TABLE demo.metric_entries (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES demo.shifts(id) ON DELETE CASCADE,
  metric_id INTEGER NOT NULL REFERENCES demo.section_metrics(id),
  actual_value DOUBLE PRECISION,
  metric_score DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shift_id, metric_id)
);

CREATE TABLE demo.section_health_scores (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES demo.shifts(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  score DOUBLE PRECISION,
  status TEXT DEFAULT 'incomplete' CHECK (status IN ('complete', 'incomplete')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shift_id, section_id)
);

-- ─── 3. Seed metrics for each of the 5 sections ────────────────────────────

INSERT INTO demo.section_metrics (section_id, name, metric_key, target, direction, severity_weight, unit) VALUES
-- Inbound
('inbound',  'Receive UPH',         'ib_uph',        140,   'higher', 8, 'uph'),
('inbound',  'Scan Rate',           'ib_scan',       99.0,  'higher', 9, '%'),
('inbound',  'Dock-to-Stow (mins)', 'ib_d2s',        45,    'lower',  6, 'min'),
-- ICQA
('icqa',     'Adjustment DPMO',     'icqa_dpmo',     20000, 'lower',  10,'dpmo'),
('icqa',     'Cycle Count Accuracy','icqa_cca',      99.5,  'higher', 8, '%'),
('icqa',     'IRDR',                'icqa_irdr',     10000, 'lower',  7, 'dpmo'),
-- Pick
('pick',     'Pick UPH',            'pick_uph',      280,   'higher', 9, 'uph'),
('pick',     'Pick Accuracy',       'pick_acc',      99.5,  'higher', 10,'%'),
('pick',     'Mispicks per 10k',    'pick_miss',     30,    'lower',  7, 'per10k'),
-- Pack
('pack',     'Pack UPH',            'pack_uph',      220,   'higher', 8, 'uph'),
('pack',     'Pack Quality',        'pack_q',        99.2,  'higher', 8, '%'),
('pack',     'Rework Rate',         'pack_rw',       1.0,   'lower',  6, '%'),
-- Outbound
('outbound', 'DTS',                 'ob_dts',        98,    'higher', 10,'%'),
('outbound', 'Trailer Fill Rate',   'ob_tfr',        92,    'higher', 6, '%'),
('outbound', 'Dispatch Delays',     'ob_delay',      2,     'lower',  7, 'count');

-- ─── 4. Seed shifts (last 7 days, day shift only) + latest scores ──────────

DO $$
DECLARE
  d DATE;
  shift_id INT;
BEGIN
  FOR d IN SELECT generate_series((DATE '2026-04-17'), (DATE '2026-04-23'), INTERVAL '1 day')::DATE LOOP
    INSERT INTO demo.shifts (date, shift_type, status)
    VALUES (d::TEXT, 'day', 'complete')
    RETURNING id INTO shift_id;
  END LOOP;
END $$;

-- Insert metric_entries + section_health_scores for the most recent shift (2026-04-23)
-- Scores are hand-crafted so each section lands in a distinct RAG band.

INSERT INTO demo.section_health_scores (shift_id, section_id, score, status)
SELECT s.id, v.section_id, v.score, 'complete'
FROM demo.shifts s
CROSS JOIN (VALUES
  ('inbound',  88.0),  -- green
  ('icqa',     72.5),  -- amber
  ('pick',     91.2),  -- green
  ('pack',     84.0),  -- green-ish
  ('outbound', 63.4)   -- red
) AS v(section_id, score)
WHERE s.date = '2026-04-23' AND s.shift_type = 'day';

-- Also seed a few historical scores so the "last shift" query has variety
INSERT INTO demo.section_health_scores (shift_id, section_id, score, status)
SELECT s.id, v.section_id, v.score, 'complete'
FROM demo.shifts s
CROSS JOIN (VALUES
  ('inbound',  85.0),
  ('icqa',     68.0),
  ('pick',     89.4),
  ('pack',     82.1),
  ('outbound', 70.2)
) AS v(section_id, score)
WHERE s.date = '2026-04-22' AND s.shift_type = 'day';
