# Continuum App — Full Context for New Chat Sessions

## Who Ryan Is
Ryan is a CI (Continuous Improvement) Specialist at an Amazon Fulfilment Centre operated by ID Logistics (IDL). He is newly started in the role. His manager is **Abhishek**. He built Continuum as his personal CI management tool to run his entire on-site CI programme.

---

## What Continuum Is
Continuum is a **React + Vite + Express** CI management web app running locally on Ryan's laptop. It is his primary tool for logging observations, managing projects, tracking KPIs, generating reports and mapping processes.

**Tech stack:**
- React 18 + Vite (port 3000)
- Express (port 3001)
- TailwindCSS
- better-sqlite3 (local SQLite database at `data/continuum.db`)
- @anthropic-ai/sdk (claude-sonnet-4-6, streams via SSE)
- ReactFlow (@xyflow/react) — process map builder
- recharts — KPI charts
- ExcelJS — Excel report export
- jsPDF, docx

**Start command:** `npm start` (runs both frontend and backend via concurrently)

**API key:** Set `ANTHROPIC_API_KEY` in `.env`

**npm install note:** Root-owned npm cache conflict on this machine. Uses `.npmrc` cache override at `/tmp/npm-cache-continuum`. Run `npm install` normally.

**Root path:** `/Users/RyanWork/Desktop/continuum-app/`

---

## Key File Locations

| File | Purpose |
|------|---------|
| `server/db.js` | SQLite setup, all CREATE TABLE statements |
| `server/routes/process-maps.js` | CRUD for process maps (fixed datetime bug) |
| `server/services/excel.js` | Full Excel report generator (ExcelJS) |
| `src/views/ProcessMapsView.jsx` | React Flow process map builder |
| `src/views/ProjectsView.jsx` | Projects list and management |
| `src/views/ProjectDetail.jsx` | Individual project with AgentPanel |
| `src/views/DataView.jsx` | KPI tracking and control charts |
| `src/views/ReportsView.jsx` | Excel export + report config |
| `src/lib/api.js` | All fetch helpers + SSE streaming |
| `src/lib/spc.js` | I-MR control chart calculations |

---

## Features Built

### 1. Floor Walk / Observations
- Structured daily floor walk logging across site areas
- Waste type tagging (TIMWOODS), urgency, area, description

### 2. Projects & Portfolio
- Full project lifecycle: Quick Win, Yellow Belt, Green Belt, Investigation
- DMAIC stage tracking with exit criteria
- Linked to portfolio/pipeline
- AI Agent embedded in ProjectDetail for analysis assistance

### 3. KPI Tracking
- KPI cards with targets, RAG status (>=100% Green, 95-99% Amber, <95% Red)
- I-MR control charts with SPC signal detection (Western Electric rules)
- DataView shows trends and statistical analysis

### 4. Excel Report Export (`server/services/excel.js`)
Seven tabs exported in this order:
1. **Overview** — headline summary, project counts, KPI snapshot, maturity score
2. **CI Impact** — cumulative value: time saved, cost avoided, defects eliminated
3. **KPIs** — each metric vs target, RAG coloured, 4-week weekly comparison
4. **Projects** — active projects, stage, owner, last updated date (no hyperlinks)
5. **Pipeline** — ideas and observations in queue
6. **Activity** — log of all CI activity
7. **Maturity** — scored assessment across 6 dimensions with "next steps to reach next level" column

Key decisions:
- No "Open in Continuum" hyperlinks anywhere (Ryan is the only user of the app)
- No "promotion" wording anywhere
- Last Updated column shows date, amber-highlighted if stalled >14 days
- Weekly KPI comparison section (4-week buckets) in the KPIs tab

### 5. Process Maps (`src/views/ProcessMapsView.jsx`)
Full swimlane process flow diagram builder using React Flow:
- Custom node types: Start, End, Process, Decision
- Handles on all four sides of every node (source + target)
- YES/NO branch auto-labelling on Decision nodes
- Auto-layout button (Kahn's BFS topological sort, left-to-right, centred in swimlane)
- Save/load to SQLite via `/api/process-maps`
- Edge deletion via Backspace/Delete key + red Delete button
- No minimap

**Critical bug fixed:** `datetime("now")` in SQL caused 500 errors on save. Fixed to `datetime('now')` with single quotes.

**Save works by:** Stripping React Flow internal fields (positionAbsolute, dragging, selected) before serialising to JSON for database.

---

## Supporting Documents Created

### `ci-ops-manager-procedure.html`
Located at: `/Users/RyanWork/Desktop/continuum-app/ci-ops-manager-procedure.html`

4-page A4 HTML/PDF for Ops Managers covering:
- Page 1: CI Life Cycle at a Glance (6 stages, table with roles)
- Page 2: Observation Pipeline (QR form + CI direct floor walk)
- Page 3: From Observation to Active Project (project types, DMAIC table)
- Page 4: Reporting, Excel Report breakdown (all 7 tabs explained), RAG explainer, expectations, escalation, key principles

Print to PDF via Cmd+P in browser.

Style: Continuum brand colours (navy #0F172A, orange #F97316), A4 @page CSS, no em dashes, no en dashes used as separators.

### `ci-workflow-guide.html`
Located at: `/Users/RyanWork/Desktop/continuum-app/ci-workflow-guide.html`

9-section comprehensive CI workflow guide covering the full methodology from observation to reporting. Generic (no site-specific KPI names). A4 print-ready.

---

## Observation Pipeline (Google Forms)
Ryan set up a Google Form for floor-level observation submissions. QR code generated and ready to post on site.

Flow: QR scan → Google Form → Google Sheet → Ryan reviews manually → logs in Continuum

This is intentionally NOT feeding directly into Continuum (Continuum is still local). Management can access the Google Sheet. Ryan logs observations into Continuum himself.

---

## Site Context — ICQA KPIs (from James Haddy via Lewis Bower)

Lewis Bower = on-site ICQA Manager (still onboarding)
James Haddy = ICQA Manager at a different site

KPIs Amazon measure on ICQA (using DPMO — Defects per Million Opportunities):

| KPI | Definition | % Threshold | DPMO Threshold |
|-----|-----------|-------------|----------------|
| Gross Adjustments | Units lost (deleted) or found (added) in the system | 2% of throughput | 20,000 DPMO |
| IRDR (Inventory Record Defect Rate) | Audited count performed weekly | 1% of records counted | 10,000 DPMO |
| DIOT (Dwelling Inventory Over Threshold) | Inventory not processed within 5 days | 0.1% of weekly throughput | 1,000 DPMO |

Still outstanding:
- Confirm if these KPIs are transferable to Ryan's site
- Establish IB (Inbound) vs OB (Outbound) split
- How they will be measured in practice
- Where they will be reported (likely a WMS Amazon provides)
- Abhishek also flagged DPMO as a key KPI to follow up on generally

---

## Other Site Documents Ryan Is Working Through
- **Labour Ramp Up** — Ryan's headcount planning tool based on Amazon forecast volumes and RFQ target values. Updates dynamically as volumes change.
- **RFQ Excel** — Amazon/IDL contractual agreement. Sets target performance per process path, translates to financial (£) obligations.
- **ICQA Masterclass PDF** — provided by Lewis Bower, covers the ICQA process in detail

---

## Cloud Migration Plan (Phase 2 — Not Started)
When Ryan says "do the migration":
- SQLite → Supabase (PostgreSQL, free tier)
- Express backend → Railway (gets public URL)
- React frontend → Vercel (optional)
- Update `server/db.js`: better-sqlite3 → pg library
- Update `src/lib/api.js`: point to Railway URL

Why: Enables n8n + Whisper voice note pipeline for remote observation logging. Also enables GM read-only view and mobile access on warehouse floor.

Do NOT start migration until Continuum is fully built and tailored to all on-site operations.

---

## Pending / Outstanding Items
- Site-specific zone/area names — Ryan to send actual names once on site so Google Form dropdown and Continuum Floor Walk areas can be updated
- Azure credentials (Tenant ID, Client ID, Client Secret) for OneDrive sync — go in Reports > Configure panel
- ICQA KPI confirmation from James Haddy (via Lewis)
- IB/OB split for ICQA KPIs
- Mobile UI improvements (Continuum is currently laptop-only)
- Cloud migration (Phase 2)
- Voice note pipeline via n8n + Whisper (requires cloud migration first)

---

## Ryan's Preferences / Style Notes
- No em dashes (—) or en dashes (–) used as separators in any documents
- No "promotion" wording in any output
- No hyperlinks to Continuum in Excel exports (Ryan is the only user)
- Plain English, acronyms explained inline
- Professional but clear, not overly formal
- No bullet points starting with em dashes
