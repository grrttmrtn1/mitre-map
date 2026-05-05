# MitreMap

**Enterprise detection coverage platform for cyber defense teams.**

MitreMap maps your SIEM detections and security tooling against the full MITRE ATT&CK Enterprise framework, correlates them to MITRE D3FEND countermeasures and ATT&CK mitigations, scores your risk exposure against tracked threat groups, and surfaces prioritized gaps — all in a single dark-mode dashboard.

---

## Features

### Coverage Intelligence
- **ATT&CK Matrix heatmap** — full 14-tactic × 180-technique matrix with per-cell status (`full` / `detected` / `mitigated` / `tuning` / `planned` / `gap`)
- **D3FEND mapping** — 68 countermeasures across Harden / Detect / Isolate / Deceive / Evict, mapped to ATT&CK techniques
- **Coverage snapshots** — point-in-time baselines; trend line shows coverage % over time
- **Gap analysis** — every undetected technique ranked by threat-group exposure, compliance impact, and existing mitigation

### Detection Management
- Full CRUD for SIEM detections with technique multi-select, severity, confidence, false-positive rate
- **Bulk operations** — multi-select rows, bulk status update or delete
- **CSV import** — paste or upload a CSV of detections with semicolon-separated technique IDs
- **SIGMA rule import** — paste YAML, preview extracted ATT&CK technique IDs, import as detection
- Filters by status, severity, and source platform

### Security Stack Management
- Tool inventory with vendor, category, and status tracking
- Per-tool D3FEND countermeasure and ATT&CK mitigation linkage
- Coverage contribution — each tool's contribution to the overall coverage matrix

### Threat Intelligence
- **18 tracked threat groups** — APT29, APT28, Lazarus, APT41, FIN7, Sandworm, Turla, Scattered Spider, Wizard Spider, and more
- Per-group detection coverage with technique-level status (detected / exposed)
- Exposure percentage and risk level per group
- Split-panel detail view with full technique breakdown

### Risk Scoring
- **Overall risk score (0–100)** — weighted by coverage gap, exposed threat groups, and high-group-overlap techniques
- Risk score by tactic — bar chart identifies highest-exposure kill-chain phases
- Risk score by technique — sortable table for heat-map prioritization

### Compliance Mapping
- **NIST CSF 2.0** — all 6 functions (GV / ID / PR / DE / RS / RC) with control-level coverage
- **CIS Controls v8** — 18 controls mapped to ATT&CK techniques
- Gap report per framework — shows which controls have no active detection coverage

### Reports & Exports
| Export | Format | Endpoint |
|---|---|---|
| ATT&CK Navigator layer | JSON | `GET /api/exports/navigator` |
| Detections | CSV | `GET /api/exports/detections/csv` |
| Security tools | CSV | `GET /api/exports/tools/csv` |
| Coverage matrix | JSON | `GET /api/exports/coverage/json` |
| Executive summary | JSON API | `GET /api/reports/executive` |
| Threat landscape | JSON API | `GET /api/reports/threat-landscape` |
| Prioritized gaps | JSON API | `GET /api/reports/gaps` |

### Collaboration
- **Tags** — color-coded labels applied to any entity (detections, techniques, tools, gaps)
- **Comments** — threaded analyst notes on any entity
- **Assignments** — assign gaps or detections to analysts with priority, due date, and status tracking
- **Audit log** — every create / update / delete / import event logged with actor and change diff

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  React 18 · React Router · Recharts · Tailwind CSS  │
└──────────────┬──────────────────────────────────────┘
               │  /api/*  (same-origin in production)
               │  Vite proxy in development
┌──────────────▼──────────────────────────────────────┐
│  Express 4 · TypeScript · Node 20                   │
│                                                     │
│  Routes                                             │
│  ├── /api/attack         ATT&CK tactics/techniques  │
│  ├── /api/d3fend         D3FEND techniques          │
│  ├── /api/detections     SIEM detection CRUD        │
│  ├── /api/tools          Security tool CRUD         │
│  ├── /api/coverage       Matrix & stats             │
│  ├── /api/tags           Entity tagging             │
│  ├── /api/assignments    Analyst assignments        │
│  ├── /api/comments       Threaded comments          │
│  ├── /api/audit          Audit log                  │
│  ├── /api/snapshots      Coverage snapshots         │
│  ├── /api/threat-groups  APT / cybercrime groups    │
│  ├── /api/compliance     NIST CSF 2.0 · CIS v8      │
│  ├── /api/sigma          SIGMA rule import          │
│  ├── /api/exports        Navigator / CSV / JSON     │
│  ├── /api/reports        Pre-computed reports       │
│  └── /api/risk           Risk scoring               │
│                                                     │
│  better-sqlite3 (synchronous WAL-mode SQLite)       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  SQLite  ·  mitremap.db                             │
│                                                     │
│  attack_tactics · attack_techniques                 │
│  attack_mitigations · technique_mitigations         │
│  d3fend_techniques · attack_d3fend                  │
│  tools · tool_d3fend · tool_mitigations             │
│  detections · tags · entity_tags                    │
│  comments · assignments · audit_log                 │
│  coverage_snapshots · threat_groups                 │
│  compliance_frameworks · compliance_controls        │
│  technique_compliance · group_techniques            │
└─────────────────────────────────────────────────────┘
```

**Key design choices:**
- **SQLite + WAL mode** — zero-dependency persistence; WAL journal gives concurrent reads without blocking writes. Sufficient for a team of analysts; swap to Postgres if you need horizontal scale.
- **Polymorphic entity model** — `entity_tags`, `comments`, and `assignments` all use `(entity_type, entity_id)` keys so the same schema handles detections, techniques, tools, and gaps without separate junction tables.
- **Synchronous DB layer** — `better-sqlite3` is synchronous, eliminating async waterfall bugs on the server while keeping the API simple.
- **SIGMA parsing without a library** — a minimal line-by-line YAML parser extracts the handful of fields MitreMap needs (`title`, `id`, `level`, `tags`) without a full YAML dependency.

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 9

### Development

```bash
git clone <repo-url> mitremap
cd mitremap

# Install all workspace deps
npm install

# Start server (port 4000) + client dev server (port 3000) concurrently
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Vite dev server proxies all `/api` requests to Express on port 4000.

The database is created automatically at `server/data/mitremap.db` on first run and seeded with:
- Full MITRE ATT&CK Enterprise v14 (14 tactics, 180 techniques, 43 mitigations)
- 68 D3FEND countermeasures with ATT&CK mappings
- 18 major threat groups with technique associations
- NIST CSF 2.0 and CIS Controls v8 compliance mappings
- 30+ demo detections and 10 security tools
- 8 demo tags pre-applied to detections

---

## Docker

### Single command

```bash
docker compose up -d
```

The app is available at [http://localhost:8080](http://localhost:8080).

The SQLite database is persisted in a named Docker volume (`mitremap-data`).

### Custom port

```bash
MITREMAP_PORT=9000 docker compose up -d
```

### Build only (no compose)

```bash
docker build -t mitremap:latest .
docker run -d \
  -p 8080:4000 \
  -v mitremap-data:/app/server/data \
  --name mitremap \
  mitremap:latest
```

### Backup the database

```bash
docker exec mitremap \
  sqlite3 /app/server/data/mitremap.db ".backup '/app/server/data/backup.db'"

docker cp mitremap:/app/server/data/backup.db ./mitremap-backup-$(date +%Y%m%d).db
```

### Upgrade

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

The existing database volume is preserved across rebuilds; the schema is migrated automatically on startup.

---

## API Reference

All endpoints are under `/api`. Responses are JSON unless noted.

### Detections

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/detections` | List (filter: `status`, `severity`, `source`, `technique`) |
| `POST` | `/api/detections` | Create detection |
| `PUT` | `/api/detections/:id` | Update detection |
| `DELETE` | `/api/detections/:id` | Delete detection |
| `PATCH` | `/api/detections/bulk` | Bulk status update `{ ids, status }` |
| `DELETE` | `/api/detections/bulk` | Bulk delete `{ ids }` |
| `POST` | `/api/detections/import` | Import array of detections |

### SIGMA Import

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sigma/parse` | Parse SIGMA YAML, return preview `{ title, technique_ids, ... }` |
| `POST` | `/api/sigma/import` | Import array of SIGMA rule strings as detections |

### Coverage & Risk

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/coverage/stats` | KPIs and per-tactic breakdown |
| `GET` | `/api/coverage/matrix` | Full ATT&CK matrix with per-cell status |
| `GET` | `/api/coverage/gaps` | Gap techniques with D3FEND / mitigation recommendations |
| `GET` | `/api/risk/score` | Overall risk score with component breakdown |
| `GET` | `/api/risk/by-tactic` | Risk score per tactic |
| `GET` | `/api/risk/by-technique` | Risk score per technique |

### Threat Groups

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/threat-groups` | List all groups |
| `GET` | `/api/threat-groups/:id` | Detail with techniques and coverage |
| `GET` | `/api/threat-groups/:id/exposure` | Per-technique exposed/detected breakdown |

### Compliance

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/compliance/frameworks` | Frameworks with coverage % |
| `GET` | `/api/compliance/frameworks/:id` | Framework detail with per-control coverage |
| `GET` | `/api/compliance/gap?framework_id=` | Controls with no detection coverage |

### Collaboration

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/tags` | List / create tags |
| `PUT/DELETE` | `/api/tags/:id` | Update / delete tag |
| `GET/POST` | `/api/tags/:type/:id` | Get / add entity tags |
| `DELETE` | `/api/tags/:type/:id/:tagId` | Remove entity tag |
| `GET/POST` | `/api/comments/:type/:id` | List / add comments |
| `PUT/DELETE` | `/api/comments/:id` | Edit / delete comment |
| `GET/POST` | `/api/assignments` | List / create assignments |
| `PUT/DELETE` | `/api/assignments/:id` | Update / delete assignment |
| `GET` | `/api/audit` | Audit log (filter: `entity_type`, `entity_id`, `actor`, `action`) |

### Exports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/exports/navigator` | ATT&CK Navigator layer JSON (download) |
| `GET` | `/api/exports/detections/csv` | Detections CSV (download) |
| `GET` | `/api/exports/tools/csv` | Tools CSV (download) |
| `GET` | `/api/exports/coverage/json` | Coverage matrix JSON (download) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, React Router v6, Recharts, Tailwind CSS |
| Build tool | Vite 5 |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | SQLite via `better-sqlite3` (WAL mode, foreign keys) |
| Runtime tooling | `tsx` (TS dev runner), `concurrently` |
| Container | Docker (multi-stage Alpine build) |

---

## Development Notes

### Project structure

```
mitremap/
├── server/
│   └── src/
│       ├── index.ts            # Express app entry
│       ├── db/
│       │   ├── database.ts     # Schema init, getDb(), logAudit()
│       │   └── seed.ts         # Idempotent seeding
│       ├── data/
│       │   ├── attack.ts       # ATT&CK tactics, techniques, mitigations
│       │   ├── d3fend.ts       # D3FEND techniques + ATT&CK mappings
│       │   ├── threat-groups.ts
│       │   ├── compliance.ts   # NIST CSF 2.0, CIS Controls v8
│       │   └── demo.ts         # Demo tools and detections
│       └── routes/             # One file per resource
├── client/
│   └── src/
│       ├── api.ts              # Typed fetch wrappers for every endpoint
│       ├── types.ts            # Shared TypeScript interfaces
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── Modal.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── CoverageBar.tsx
│       │   ├── TagBadge.tsx
│       │   ├── CommentThread.tsx
│       │   └── AssignmentPanel.tsx
│       └── pages/
│           ├── Dashboard.tsx
│           ├── AttackMatrix.tsx
│           ├── Detections.tsx
│           ├── Tools.tsx
│           ├── DefenseMapping.tsx
│           ├── GapAnalysis.tsx
│           ├── ThreatGroups.tsx
│           ├── Reports.tsx
│           └── Settings.tsx
├── Dockerfile
├── docker-compose.yml
└── package.json                # npm workspaces root
```

### VS Code debugging

A compound launch config is included (`.vscode/launch.json`). Press `F5` with **Full Stack** selected to:
1. Kill any stale processes on ports 3000 / 4000
2. Start the Vite dev server
3. Attach the TypeScript debugger to the Express server
4. Open Chrome DevTools on the React app

---

## License

MIT
