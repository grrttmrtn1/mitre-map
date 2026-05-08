# MitreMap

**Enterprise detection coverage platform for cyber defense teams.**

MitreMap maps your SIEM detections and security tooling against the full MITRE ATT&CK Enterprise framework, correlates them to MITRE D3FEND countermeasures and ATT&CK mitigations, scores your risk exposure against tracked threat groups, and surfaces prioritized gaps — all in a single dark-mode dashboard.

<img width="1493" height="812" alt="image" src="https://github.com/user-attachments/assets/99fe0db7-4def-4387-b6b1-c42074432ffd" />
<img width="1483" height="812" alt="image" src="https://github.com/user-attachments/assets/da7ec4a5-0860-44db-b541-09fdf487a0a4" />
<img width="1502" height="812" alt="image" src="https://github.com/user-attachments/assets/c760508a-624c-4114-8ffd-81e59d4fe14f" />

---

## Features

### Authentication & User Management
- **Login page** — email/password login with JWT access tokens (15-minute expiry) and 30-day httpOnly refresh cookies
- **Multi-user roles** — `admin` (full access), `analyst` (read/write), `readonly` (view only)
- **OIDC / SSO** — configurable OAuth2/OIDC providers; new users provisioned automatically as `analyst` on first login
- **Bootstrap mode** — no lockout: the app runs open until the first user or API key is created
- **User management** — full CRUD for users, password reset (invalidates all active sessions), and active/inactive toggling

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
- **Full CRUD** — create, edit, and delete threat groups; assign any subset of ATT&CK techniques with an inline searchable picker
- **Procedures per TTP** — record specific observed behaviors for each technique a group uses: command lines, scripts, artifact paths, prose descriptions, or reference links. Each procedure is typed, color-coded, and editable inline within the detail pane.
- Per-group detection coverage with technique-level status (detected / exposed)
- Exposure percentage and risk level per group
- Split-panel detail view with full technique and procedure breakdown

### Risk Scoring
- **Overall risk score (0–100)** — weighted by coverage gap, exposed threat groups, and high-group-overlap techniques
- Risk score by tactic — bar chart identifies highest-exposure kill-chain phases
- Risk score by technique — sortable table for heat-map prioritization

### Compliance Mapping
- **NIST CSF 2.0** — all 6 functions (GV / ID / PR / DE / RS / RC) with control-level coverage
- **CIS Controls v8** — 18 controls mapped to ATT&CK techniques
- Gap report per framework — shows which controls have no active detection coverage

### Reports & Exports

**Report Builder** — compose custom executive and operational reports from modular sections (coverage summary, risk score, gap table, threat landscape, tactic breakdown, compliance gaps) and export to PDF or copy as markdown.

| Export | Format | Endpoint |
|---|---|---|
| ATT&CK Navigator layer | JSON | `GET /api/exports/navigator` |
| Detections | CSV | `GET /api/exports/detections/csv` |
| Security tools | CSV | `GET /api/exports/tools/csv` |
| Coverage matrix | JSON | `GET /api/exports/coverage/json` |
| Executive summary | JSON API | `GET /api/reports/executive` |
| Threat landscape | JSON API | `GET /api/reports/threat-landscape` |
| Prioritized gaps | JSON API | `GET /api/reports/gaps` |

### Atomic Red Team Integration
- **Test library** — browse imported Atomic Red Team tests grouped by technique; each test shows name, GUID, platform, executor type, and the generated command
- **YAML import** — paste any `atomics/*.yaml` file from the Red Canary Atomic Red Team repository; duplicates are skipped by GUID
- **Test results** — record per-detection test outcomes (`untested` / `tested` / `validated` / `failed`) with notes and run attribution
- **Coverage stats** — technique-level count of how many ART tests exist per ATT&CK technique

### ATT&CK Data Sources
- **Source inventory** — track which log sources (Windows Event Logs, Sysmon, CloudTrail, etc.) your organization collects; categorized and searchable
- **Collection status** — `collecting` / `partial` / `not_collecting` with a free-text collection-method and notes field per source
- **Technique mapping** — link each data source to the ATT&CK techniques it enables detection for; detection coverage shown inline
- **Gap analysis** — identifies undetected techniques and classifies the gap: no data source known, has a collecting source but no rule, or unknown

### API Playground
- Interactive in-app API explorer — browse every endpoint grouped by resource, fill path/query/body params, and fire live requests authenticated with your stored API key. Responses are syntax-highlighted inline.

### Collaboration
- **Tags** — color-coded labels applied to any entity (detections, techniques, tools, gaps)
- **Comments** — threaded analyst notes on any entity
- **Assignments** — assign gaps or detections to analysts with priority, due date, and status tracking
- **Audit log** — every create / update / delete / import / purge event logged with actor (API key name for remote calls), source IP, and change diff

### Administration
- **API Keys** — create scoped API keys (`read` / `write` / `admin`) with optional expiry; keys are SHA-256 hashed at rest and shown only once at creation
- **API key enforcement** — once any key exists, all API traffic requires a valid `Authorization: Bearer <key>` header. A bootstrap bypass allows key creation when none exist yet, so you're never locked out.
- **Data Management** — per-dataset purge with live row counts (detections, tools, threat groups, tags, comments, assignments, snapshots, audit log); full wipe available in the Danger Zone

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
│  ├── /api/auth           Login · logout · OIDC SSO  │
│  ├── /api/users          User management            │
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
│  ├── /api/atomic         ART tests & results        │
│  ├── /api/data-sources   ATT&CK data source mgmt   │
│  ├── /api/exports        Navigator / CSV / JSON     │
│  ├── /api/reports        Pre-computed reports       │
│  ├── /api/risk           Risk scoring               │
│  ├── /api/api-keys       API key management         │
│  ├── /api/admin          Data purge / admin ops     │
│  ├── /api/motivations    Threat group motivations   │
│  └── /api/countries      Threat group countries     │
│                                                     │
│  Auth middleware: JWT Bearer · API key · bootstrap  │
│  Knex.js query builder · versioned migrations       │
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
│  group_techniques · group_technique_procedures      │
│  compliance_frameworks · compliance_controls        │
│  technique_compliance · api_keys                    │
│  users · refresh_tokens · oidc_providers            │
│  data_sources · technique_data_sources              │
│  org_data_sources · art_tests                       │
│  detection_art_results · attack_version_info        │
└─────────────────────────────────────────────────────┘
```

**Key design choices:**
- **SQLite + WAL mode** — zero-dependency persistence; WAL journal gives concurrent reads without blocking writes. Sufficient for a team of analysts; swap to Postgres if you need horizontal scale.
- **Polymorphic entity model** — `entity_tags`, `comments`, and `assignments` all use `(entity_type, entity_id)` keys so the same schema handles detections, techniques, tools, and gaps without separate junction tables.
- **Synchronous DB layer** — `better-sqlite3` is synchronous, eliminating async waterfall bugs on the server while keeping the API simple.
- **SIGMA parsing without a library** — a minimal line-by-line YAML parser extracts the handful of fields MitreMap needs (`title`, `id`, `level`, `tags`) without a full YAML dependency.
- **Bootstrap-safe authentication** — the auth middleware checks for any users or API keys at request time. Zero configured → open access (bootstrap mode). This prevents permanent lockout and means a fresh install works without pre-seeding credentials.
- **JWT + refresh-token session model** — short-lived JWTs (15 min) keep the server stateless; a 30-day httpOnly refresh cookie (SHA-256 hashed at rest) handles silent renewal without exposing long-lived credentials in JavaScript memory.
- **Knex.js migrations** — the database schema is version-controlled via numbered migration files (`001_core_schema.ts`, `002_new_features.ts`). Applied automatically on startup; safe to run repeatedly.

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

Once at least one API key has been created, every request must include:

```
Authorization: Bearer <raw-key>
```

### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login `{ email, password }` — returns JWT + sets refresh cookie |
| `POST` | `/api/auth/refresh` | Exchange refresh cookie for a new JWT |
| `POST` | `/api/auth/logout` | Invalidate refresh token and clear cookie |
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/oidc/providers` | List configured OIDC providers |
| `POST` | `/api/auth/oidc/providers` | Create OIDC provider `{ name, slug, issuer_url, client_id, client_secret }` |
| `PUT/DELETE` | `/api/auth/oidc/providers/:id` | Update / delete OIDC provider |
| `GET` | `/api/auth/oidc/:slug` | Initiate OIDC login flow (redirect) |
| `GET` | `/api/auth/oidc/:slug/callback` | OIDC callback handler (redirect to app) |

### Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List users (id, email, name, role, is_active) |
| `POST` | `/api/users` | Create user `{ email, name, password, role? }` — roles: `admin`, `analyst`, `readonly` |
| `PUT` | `/api/users/:id` | Update name / role / is_active |
| `DELETE` | `/api/users/:id` | Delete user and revoke all sessions |
| `POST` | `/api/users/:id/reset-password` | Reset password `{ password }` — invalidates all refresh tokens |

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
| `POST` | `/api/threat-groups` | Create group `{ id, name, aliases, country, motivation, url, description, technique_ids }` |
| `GET` | `/api/threat-groups/:id` | Detail with techniques and detection coverage |
| `PUT` | `/api/threat-groups/:id` | Update group fields and technique assignments |
| `DELETE` | `/api/threat-groups/:id` | Delete group and cascade associations |
| `POST` | `/api/threat-groups/:id/techniques` | Add techniques `{ technique_ids }` |
| `DELETE` | `/api/threat-groups/:id/techniques` | Remove techniques `{ technique_ids }` (empty = remove all) |
| `GET` | `/api/threat-groups/:id/exposure` | Per-technique exposed/detected/mitigated breakdown |
| `GET` | `/api/threat-groups/:id/procedures` | All procedures for this group across all techniques |
| `POST` | `/api/threat-groups/:id/techniques/:technique_id/procedures` | Add a procedure `{ type, content, source? }` |
| `PUT` | `/api/threat-groups/:id/procedures/:proc_id` | Update procedure fields |
| `DELETE` | `/api/threat-groups/:id/procedures/:proc_id` | Delete procedure |

**Procedure types:** `command` · `script` · `description` · `artifact` · `reference`

```json
{
  "type": "command",
  "content": "powershell.exe -nop -w hidden -enc JABjAGwAaQBlAG4AdA...",
  "source": "FireEye UNC2452 Report, Dec 2020"
}
```

### API Keys

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/api-keys` | List keys (masked — raw key never returned after creation) |
| `POST` | `/api/api-keys` | Create key `{ name, scopes, expires_at? }` — returns raw key once |
| `PATCH` | `/api/api-keys/:id` | Update name / scopes / expiry |
| `DELETE` | `/api/api-keys/:id` | Revoke key |

**Scopes:** `read`, `write`, `admin`. Admin scope is required for key mutations (create / update / revoke) and data purge operations; `read` scope is sufficient for listing keys and viewing purgeable datasets. Keys are SHA-256 hashed at rest; the `masked_key` field shows the first 8 and last 4 characters.

### Admin / Data Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/purgeable` | Live row counts per purgeable dataset (`read` scope) |
| `DELETE` | `/api/admin/purge/:dataset` | Purge one dataset: `detections`, `audit`, `snapshots`, `comments`, `assignments`, `threat_groups`, `tags`, `tools` (`admin` scope) |
| `DELETE` | `/api/admin/purge-all` | Wipe all mutable data (FK-safe ordering) (`admin` scope) |

### Motivations & Countries

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/motivations` | List / create threat group motivations |
| `PUT/DELETE` | `/api/motivations/:id` | Update / delete motivation |
| `GET/POST` | `/api/countries` | List / create threat group countries |
| `PUT/DELETE` | `/api/countries/:id` | Update / delete country |

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

### Atomic Red Team

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/atomic/tests` | List all imported ART tests |
| `GET` | `/api/atomic/tests/:technique_id` | Tests for a specific technique |
| `GET` | `/api/atomic/coverage` | Technique-level test count and overall coverage % |
| `POST` | `/api/atomic/import` | Import ART YAML `{ yaml }` — returns `{ imported, skipped, total }` |
| `POST` | `/api/atomic/results` | Record test result `{ detection_id, art_test_id, status, notes?, run_by? }` |
| `PUT` | `/api/atomic/results/:id` | Update result status / notes |
| `DELETE` | `/api/atomic/results/:id` | Delete result |

**Test result statuses:** `untested` · `tested` · `validated` · `failed`

### ATT&CK Data Sources

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/data-sources` | List all data sources with org collection status and technique count |
| `POST` | `/api/data-sources` | Create data source `{ name, category, description? }` |
| `PUT` | `/api/data-sources/:id` | Update data source fields |
| `DELETE` | `/api/data-sources/:id` | Delete data source and all associations |
| `GET` | `/api/data-sources/:id/techniques` | Techniques mapped to this source (includes `has_detection` flag) |
| `POST` | `/api/data-sources/:id/techniques` | Add technique mapping `{ technique_id }` |
| `DELETE` | `/api/data-sources/:id/techniques/:technique_id` | Remove technique mapping |
| `PUT` | `/api/data-sources/:id/status` | Set org collection status `{ status, collection_method?, notes? }` |
| `GET` | `/api/data-sources/technique/:technique_id` | Data sources mapped to a specific technique |
| `GET` | `/api/data-sources/analysis` | Gap analysis: undetected techniques classified by data-source availability |

**Collection statuses:** `collecting` · `partial` · `not_collecting`

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
| Schema migrations | Knex.js (versioned migration files, run on startup) |
| Authentication | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), OIDC (Authorization Code flow) |
| Runtime tooling | `tsx` (TS dev runner), `concurrently` |
| Container | Docker (multi-stage Alpine build) |

---

## Project Structure

```
mitremap/
├── server/
│   └── src/
│       ├── index.ts            # Express app entry
│       ├── middleware/
│       │   └── auth.ts         # requireApiKey — Bearer token + SHA-256 validation
│       ├── db/
│       │   ├── database.ts     # Schema init, getDb(), logAudit()
│       │   └── seed.ts         # Idempotent seeding
│       ├── db/
│       │   ├── database.ts     # getKnex(), logAudit(), raw* helpers
│       │   ├── knex.ts         # Knex connection + migration runner
│       │   ├── seed.ts         # Idempotent seeding
│       │   └── migrations/
│       │       ├── 001_core_schema.ts   # Base schema
│       │       └── 002_new_features.ts  # Auth, ART, data sources
│       ├── data/
│       │   ├── attack.ts           # ATT&CK tactics, techniques, mitigations
│       │   ├── d3fend.ts           # D3FEND techniques + ATT&CK mappings
│       │   ├── threat-groups.ts
│       │   ├── compliance.ts       # NIST CSF 2.0, CIS Controls v8
│       │   ├── atomic-tests.ts     # Seed ART test data
│       │   ├── data-sources.ts     # Seed ATT&CK data sources
│       │   └── demo.ts             # Demo tools and detections
│       └── routes/                 # One file per resource group
│           ├── auth.ts               # Login, refresh, logout, OIDC
│           ├── users.ts              # User CRUD + password reset
│           ├── atomic.ts             # ART tests, coverage, results, import
│           ├── data-sources.ts       # ATT&CK data source management
│           ├── threat-groups.ts      # CRUD + technique assignment + procedures
│           ├── api-keys.ts           # API key lifecycle (hash, mask, revoke)
│           └── admin.ts              # Data purge endpoints
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
│       │   ├── AssignmentPanel.tsx
│       │   └── ReportBuilder.tsx   # Modular report composer
│       ├── context/
│       │   └── AuthContext.tsx     # JWT auth state, OIDC, role helpers
│       └── pages/
│           ├── LoginPage.tsx       # Email/password + OIDC login
│           ├── Dashboard.tsx
│           ├── AttackMatrix.tsx
│           ├── Detections.tsx
│           ├── Tools.tsx
│           ├── DefenseMapping.tsx
│           ├── GapAnalysis.tsx
│           ├── ThreatGroups.tsx    # Includes per-TTP procedure editor
│           ├── AtomicTests.tsx     # ART test browser + import
│           ├── DataSources.tsx     # ATT&CK data source management
│           ├── Reports.tsx
│           ├── ApiPlayground.tsx   # Interactive API explorer
│           └── Settings.tsx        # API keys + users + data management
├── Dockerfile
├── docker-compose.yml
└── package.json                # npm workspaces root
```

---

## License

MIT
