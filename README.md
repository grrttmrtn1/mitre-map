# MitreMap

**Enterprise detection coverage platform for cyber defense teams.**

MitreMap maps your SIEM detections and security tooling against the full MITRE ATT&CK Enterprise framework, correlates them to MITRE D3FEND countermeasures and ATT&CK mitigations, scores your risk exposure against tracked threat groups, and surfaces prioritized gaps — all in a single dark-mode dashboard.

<img width="1429" height="785" alt="image" src="https://github.com/user-attachments/assets/3b31ae3f-79c0-4456-bd42-33bec5d97a39" />
<img width="1439" height="779" alt="image" src="https://github.com/user-attachments/assets/bbce9d1f-70fd-4f96-bf35-f893eacfa6de" />
<img width="1439" height="788" alt="image" src="https://github.com/user-attachments/assets/5721fd29-394d-42b1-bf21-de7931caa9bf" />
<img width="1431" height="787" alt="image" src="https://github.com/user-attachments/assets/f53c931f-c287-422b-bd7e-e23c2adb563b" />
<img width="1438" height="784" alt="image" src="https://github.com/user-attachments/assets/a4349704-6bed-419c-ac5a-8bc4607f8cdf" />
<img width="1433" height="785" alt="image" src="https://github.com/user-attachments/assets/0ddb2106-ecb6-4f84-a88d-64455728f9b6" />
<img width="1438" height="780" alt="image" src="https://github.com/user-attachments/assets/2bace4bc-3ad9-4407-9584-3def9d560afa" />
<img width="1440" height="783" alt="image" src="https://github.com/user-attachments/assets/67d01a20-c0d6-47c5-bc8c-9055d2dfd19f" />
<img width="1436" height="784" alt="image" src="https://github.com/user-attachments/assets/a71ec9dd-61ba-4c1e-84ef-7c76dec5ed4d" />
<img width="1435" height="780" alt="image" src="https://github.com/user-attachments/assets/8dce8524-3ecf-4f6f-87c0-d90d8380e28f" />











---

## Features

### Authentication & User Management
- **Login page** — email/password login with JWT access tokens (15-minute expiry) and 30-day httpOnly refresh cookies
- **Multi-user roles** — `admin` (full access), `analyst` (read/write), `readonly` (view only)
- **OIDC / SSO** — configurable OAuth2/OIDC providers; new users provisioned automatically as `analyst` on first login
- **Bootstrap mode** — no lockout: the app runs open until the first user or API key is created
- **Bootstrap admin** — set `ADMIN_EMAIL` + `ADMIN_PASSWORD` in `.env` to seed an initial admin on first run
- **User management** — full CRUD for users, password reset (invalidates all active sessions), and active/inactive toggling

### Coverage Intelligence
- **ATT&CK Matrix heatmap** — full 14-tactic matrix with parent techniques and subtechniques; per-cell status (`full` / `detected` / `mitigated` / `tuning` / `planned` / `gap`)
- **D3FEND mapping** — 68 countermeasures across Harden / Detect / Isolate / Deceive / Evict, mapped to ATT&CK techniques
- **Coverage snapshots** — point-in-time baselines; trend line shows coverage % over time
- **Gap analysis** — every undetected technique ranked by threat-group exposure, compliance impact, and existing mitigation

### Detection Management
- Full CRUD for SIEM detections with technique multi-select, severity, confidence, false-positive rate
- **Bulk operations** — multi-select rows, bulk status update or delete
- **CSV import** — paste or upload a CSV of detections with semicolon-separated technique IDs
- **SIGMA rule import** — paste YAML, preview extracted ATT&CK technique IDs, import as detection
- Filters by status, severity, and source platform
- **Effectiveness tracking** — log alert fires as `true_positive`, `false_positive`, or `suppressed`; counters feed the quality-score algorithm
- **Quality scores** — per-detection score (0–100, letter grade A–F) computed from severity, confidence, empirical FP rate, test results, and technique uniqueness; available as a bulk endpoint
- **Version history** — every create/update snapshots the detection; the history endpoint returns version-by-version diffs of changed fields

### Security Stack Management
- Tool inventory with vendor, category, and status tracking
- Per-tool D3FEND countermeasure and ATT&CK mitigation linkage
- Coverage contribution — each tool's contribution to the overall coverage matrix

### Threat Intelligence
- **18 tracked threat groups** — APT29, APT28, Lazarus, APT41, FIN7, Sandworm, Turla, Scattered Spider, Wizard Spider, and more
- **Full CRUD** — create, edit, and delete threat groups; assign any subset of ATT&CK techniques with an inline searchable picker
- **Procedures per TTP** — record specific observed behaviors for each technique a group uses: command lines, scripts, artifact paths, prose descriptions, or reference links. Each procedure is typed, color-coded, and editable inline within the detail pane.
- **Industry sector targeting** — tag each threat group with the industry sectors it targets (stored as a JSON array)
- **Campaign tracking** — record named campaigns per threat group with dates, source URL, description, and campaign-specific technique scope
- **Indicator tracking** — record IOCs (`ip`, `domain`, `hash`, `url`, `email`) per group or technique, set confidence, and export indicators as STIX 2.1
- Per-group detection coverage with technique-level status (detected / exposed)
- Exposure percentage and risk level per group
- Split-panel detail view with coverage, techniques, procedures, campaigns, and IOCs

### Risk Scoring
- **Overall risk score (0–100)** — weighted by coverage gap, exposed threat groups, and high-group-overlap techniques
- Risk score by tactic — bar chart identifies highest-exposure kill-chain phases
- Risk score by technique — sortable table for heat-map prioritization

### Priority Queue
- **Ranked detection backlog** — uncovered and mitigated-only techniques used by tracked threat groups are scored by industry targeting, total threat-group usage, data-source readiness, compliance impact, and gap severity
- **Operational actions** — assign a technique to yourself, open a prefilled detection form, create a Jira/ServiceNow ticket, or record accepted risk directly from a queue item
- **Data readiness context** — shows available and missing ATT&CK data sources for each queued technique so teams know whether to build a rule or fix collection first
- **Sector weighting** — set your organization sector to boost techniques used by threat groups targeting your vertical

### Compliance Mapping
- **NIST CSF 2.0** — all 6 functions (GV / ID / PR / DE / RS / RC) with control-level coverage
- **CIS Controls v8** — 18 controls mapped to ATT&CK techniques
- **Additional frameworks** — ISO 27001:2022, PCI DSS v4, and SOC 2 Trust Services Criteria mappings
- Gap report per framework — shows which controls have no active detection coverage
- **Compliance trends** — point-in-time snapshots track framework coverage over time
- **Auditor exports** — export per-framework gap CSVs with mapped ATT&CK techniques

### Reports & Exports

**Report Builder** — compose custom executive and operational reports from modular sections (coverage summary, risk score, gap table, threat landscape, tactic breakdown, compliance gaps) and export to PDF or copy as markdown.

**Scheduled delivery** — schedule executive, trend, threat, gap, or compliance reports by cron expression with recipient lists and last-run status tracking.

| Export | Format | Endpoint |
|---|---|---|
| ATT&CK Navigator layer | JSON | `GET /api/exports/navigator` |
| Detections | CSV | `GET /api/exports/detections/csv` |
| Security tools | CSV | `GET /api/exports/tools/csv` |
| Coverage matrix | JSON | `GET /api/exports/coverage/json` |
| Executive report deck | PPTX | `GET /api/exports/report/pptx` |
| Executive summary | JSON API | `GET /api/reports/executive` |
| Threat landscape | JSON API | `GET /api/reports/threat-landscape` |
| Prioritized gaps | JSON API | `GET /api/reports/gaps` |

### ATT&CK Live Updates
- **Version tracking** — the active ATT&CK version is stored in the database and shown in Settings
- **Update check** — admins can check GitHub for a newer ATT&CK release without leaving the app
- **One-click update** — fetches the latest enterprise STIX bundle from the official MITRE repo and upserts all tactics, techniques, mitigations, and relationships in a single transaction; optionally target a specific version
- **Deprecated technique tracking** — techniques removed or revoked by an update are recorded in `deprecated_techniques` with a superseded-by pointer when available
- **Migration scan** — scans all your detections for references to deprecated technique IDs and lists which detections need updating
- **Preview and approval queue** — preview added, removed, and renamed techniques before applying; scheduled update checks can stage batches for review or auto-apply
- **Detection migration** — admin-only migration updates detections from deprecated technique IDs to known superseding IDs and logs the bulk change

### Atomic Red Team & Custom Tests
- **ART test library** — browse imported Atomic Red Team tests grouped by technique; each test shows name, GUID, platform, executor type, and the generated command
- **Live ART seeding** — on first run the server fetches the full Atomic Red Team index from GitHub and seeds all tests automatically; falls back to a static baseline if the network is unavailable
- **YAML import** — paste any `atomics/*.yaml` file from the Red Canary Atomic Red Team repository; duplicates are skipped by GUID
- **Custom tests** — full CRUD for your own detection tests not sourced from ART; each test is marked `source: custom` and managed separately from imported ART tests
- **Test results** — record per-detection test outcomes (`untested` / `tested` / `validated` / `failed`) with notes and run attribution
- **Coverage stats** — technique-level count of how many tests (ART + custom) exist per ATT&CK technique

### Red Team / Purple Team Exercises
Formal exercise management that closes the loop between offensive testing and defensive coverage. A four-tab workflow per exercise:

- **Plan** — create an exercise (type: `red_team` / `purple_team` / `tabletop`), assign a target threat group, and define the technique scope. When a threat group is selected at creation time, all of its TTPs are auto-populated into the scope.
- **Execute** — for each in-scope technique, browse available ART tests, record outcomes (`detected` / `partial` / `not_detected` / `blocked` / `n/a`), and attach inline notes per test run.
- **Findings** — log structured findings (types: `gap` / `detection_validated` / `detection_failed` / `control_weakness` / `new_ttp`) with severity, related technique, description, and remediation recommendation.
- **Report** — auto-generated purple team report: executive summary KPIs (detection rate, techniques scoped, tests executed, findings), technique-by-technique coverage breakdown, findings grouped by severity, and a detection-gap list.
- **Exercise statuses** — `planning` / `active` / `completed` / `cancelled` with lead/operator, start/end dates, and scope/rules-of-engagement notes.

### ATT&CK Data Sources
- **Source inventory** — track which log sources (Windows Event Logs, Sysmon, CloudTrail, etc.) your organization collects; categorized and searchable
- **Collection status** — `collecting` / `partial` / `not_collecting` with a free-text collection-method and notes field per source
- **Technique mapping** — link each data source to the ATT&CK techniques it enables detection for; detection coverage shown inline
- **Gap analysis** — identifies undetected techniques and classifies the gap: no data source known, has a collecting source but no rule, or unknown

### TAXII Threat Intelligence Feeds
Ingest external threat intelligence from any TAXII 2.1 server directly into MitreMap — with analyst review before anything touches your data.

- **Server management** — register TAXII 2.1 servers by URL with `none`, `basic`, or `bearer` authentication; SSL verification toggle for internal/self-signed endpoints
- **Connection test** — list available collections from a server without committing to a full fetch
- **Scheduled jobs** — create cron-based ingest jobs (hourly, daily, weekly, or custom expression) that fetch automatically in the background
- **Manual fetch** — trigger an ad-hoc fetch from any configured server at any time
- **Analyst review queue** — ingested STIX objects (intrusion sets, attack patterns, relationships) are staged as pending items; analysts approve or reject each item individually or approve/reject an entire batch at once
- **Proposed actions** — each pending item is pre-classified: `create_group`, `update_group`, `create_technique`, or `link_technique`; approved items are applied atomically to the threat-group and technique tables
- **Batch history** — browse all past ingest batches grouped by server with pending/approved/rejected counts and timestamps
- **Fetch status** — each server shows last fetch status (`running` / `success` / `error`), item count, skipped-duplicate count, and error message on failure

### Webhook Alert Integration
- **Webhook configs** — register outbound HTTP endpoints with an optional HMAC secret for payload signing and arbitrary custom headers; test connectivity with a single click
- **Alert rules** — attach rules to webhook configs with three trigger types: `coverage_threshold` (fires when overall coverage drops below a set percentage), `detection_validation_failed`, and `new_uncovered_group_technique`
- Alerts fire automatically after detection changes, coverage recalculations, and exercise test runs

### Detection Engineering Integrations
- **SIEM connectors** — configure Microsoft Sentinel, Splunk, Elastic Security, CrowdStrike Falcon, IBM QRadar, or Google Chronicle with encrypted credentials
- **Rule push / pull** — push SIGMA-backed detections into SIEM platforms, pull rule status, test connections, and inspect recent sync logs
- **GitHub rule sync** — pull SIGMA/YAML rules from configured GitHub repositories and stage them for import
- **Ticketing** — configure Jira or ServiceNow and create tickets from detection gaps or Priority Queue items

### Application Settings
- Key-value settings store accessible via API (`GET/PUT/DELETE /api/settings/:key`)
- Sensitive keys (e.g. `github_token`) are masked in GET responses — only a `configured: true/false` flag is returned

### API Playground
- Interactive in-app API explorer — browse every endpoint grouped by resource, fill path/query/body params, and fire live requests authenticated with your stored API key. Responses are syntax-highlighted inline.

### OpenAPI / Swagger Docs
- **Machine-readable spec** — full OpenAPI 3.0 spec served at `GET /api/openapi.json`
- **Swagger UI** — interactive documentation browser at `/api/docs`; no authentication required to browse

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
│  HTTPS in production (self-signed or custom cert)   │
│                                                     │
│  Routes                                             │
│  ├── /api/auth           Login · logout · OIDC SSO  │
│  ├── /api/users          User management            │
│  ├── /api/attack         ATT&CK tactics/techniques  │
│  │   ├── /check-updates  Compare DB vs latest STIX  │
│  │   ├── /apply-update   Live STIX upsert           │
│  │   ├── /version        Active ATT&CK version      │
│  │   ├── /deprecated     Deprecated techniques      │
│  │   └── /migration-scan Detection hygiene scan     │
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
│  ├── /api/atomic         ART tests, custom tests    │
│  │   └── /custom         Custom test CRUD           │
│  ├── /api/exercises      Exercise management        │
│  │   ├── /:id/techniques Technique scope CRUD       │
│  │   ├── /:id/tests      Test run CRUD              │
│  │   ├── /:id/findings   Finding CRUD               │
│  │   └── /:id/report     Purple team report         │
│  ├── /api/data-sources   ATT&CK data source mgmt   │
│  ├── /api/exports        Navigator / CSV / JSON     │
│  ├── /api/reports        Pre-computed reports       │
│  ├── /api/risk           Risk scoring               │
│  ├── /api/api-keys       API key management         │
│  ├── /api/admin          Data purge / admin ops     │
│  ├── /api/motivations    Threat group motivations   │
│  ├── /api/countries      Threat group countries     │
│  ├── /api/taxii          TAXII 2.1 feed management  │
│  │   ├── /servers        Server CRUD + test/fetch   │
│  │   ├── /jobs           Scheduled ingest jobs      │
│  │   ├── /batches        Ingest batch review        │
│  │   └── /pending        Per-item approve/reject    │
│  ├── /api/webhooks       Webhook configs + rules    │
│  │   ├── /configs        Endpoint CRUD + test       │
│  │   └── /rules          Alert rule CRUD            │
│  ├── /api/settings       Key-value app settings     │
│  ├── /api/openapi.json   OpenAPI 3.0 spec           │
│  └── /api/docs           Swagger UI                 │
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
│  attack_version_info · deprecated_techniques        │
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
│  org_data_sources · art_tests (source: atomic|custom)│
│  detection_art_results                              │
│  exercises · exercise_techniques                    │
│  exercise_test_runs · exercise_findings             │
│  taxii_servers · taxii_ingest_jobs                  │
│  taxii_pending_ingests                              │
│  webhook_configs · alert_rules                      │
│  settings · detection_versions                      │
└─────────────────────────────────────────────────────┘
```

**Key design choices:**
- **SQLite + WAL mode** — zero-dependency persistence; WAL journal gives concurrent reads without blocking writes. Sufficient for a team of analysts; swap to PostgreSQL if you need horizontal scale (see [POSTGRES.md](POSTGRES.md)).
- **HTTPS everywhere** — production always runs TLS. The server generates a `selfsigned` certificate automatically if no `SSL_CERT_PATH`/`SSL_KEY_PATH` are provided, so there's no plain-HTTP fallback.
- **Polymorphic entity model** — `entity_tags`, `comments`, and `assignments` all use `(entity_type, entity_id)` keys so the same schema handles detections, techniques, tools, and gaps without separate junction tables.
- **Synchronous DB layer** — `better-sqlite3` is synchronous, eliminating async waterfall bugs on the server while keeping the API simple.
- **SIGMA parsing without a library** — a minimal line-by-line YAML parser extracts the handful of fields MitreMap needs (`title`, `id`, `level`, `tags`) without a full YAML dependency.
- **Bootstrap-safe authentication** — the auth middleware checks for any users or API keys at request time. Zero configured → open access (bootstrap mode). This prevents permanent lockout and means a fresh install works without pre-seeding credentials.
- **JWT + refresh-token session model** — short-lived JWTs (15 min) keep the server stateless; a 30-day httpOnly refresh cookie (SHA-256 hashed at rest) handles silent renewal without exposing long-lived credentials in JavaScript memory.
- **Knex.js migrations** — the database schema is version-controlled via numbered migration files. Applied automatically on startup; safe to run repeatedly.
- **Live ATT&CK updates** — a dedicated STIX fetch module queries the official `mitre-attack/attack-stix-data` GitHub repo; updates run in a single DB transaction with upsert semantics so existing coverage data is preserved.
- **Non-root container** — Docker runs the server as a dedicated `mitremap` user (uid 1001); `gosu` handles the privilege drop from root in the entrypoint after installing any enterprise CA certificates.

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

> Development mode runs plain HTTP. HTTPS is only enabled when `NODE_ENV=production`.

The database is created automatically at `server/data/mitremap.db` on first run and seeded with:
- Full MITRE ATT&CK Enterprise (14 tactics, techniques + subtechniques, mitigations) — fetched live from GitHub on first run; falls back to a static v14.1 baseline if offline
- 68 D3FEND countermeasures with ATT&CK mappings
- 18 major threat groups with technique associations
- NIST CSF 2.0 and CIS Controls v8 compliance mappings
- ATT&CK data source catalogue with technique mappings
- Full Atomic Red Team test library — fetched live from GitHub on first run; falls back to a static baseline if offline
- 30+ demo detections and 10 security tools
- 8 demo tags pre-applied to detections

---

## Docker

### Setup

Copy `.env.example` to `.env` and fill in the required values before starting:

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD
```

```env
JWT_SECRET=replace-with-a-strong-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
```

### Single command

```bash
docker compose up -d
```

The app is available at **[https://localhost:8443](https://localhost:8443)**.

A self-signed TLS certificate is generated automatically on first start. Accept the browser warning or provide your own certificate (see [Custom TLS Certificate](#custom-tls-certificate) below).

The SQLite database is persisted in a named Docker volume (`mitremap-data`).

### Custom port

```bash
MITREMAP_PORT=9443 docker compose up -d
```

### Custom TLS Certificate

Set `SSL_CERT_PATH` and `SSL_KEY_PATH` in `.env` to paths inside the container, then mount your cert directory:

```env
SSL_CERT_PATH=/app/certs/server.crt
SSL_KEY_PATH=/app/certs/server.key
```

Uncomment the certs volume in `docker-compose.yml`:

```yaml
volumes:
  - ./certs:/app/certs:ro
```

### Enterprise CA Certificates

Two options for trusting an internal/corporate CA:

**Option A — Runtime injection (no rebuild needed)**

Mount your CA cert and set `ENTERPRISE_CA_BUNDLE` in `.env`:

```env
ENTERPRISE_CA_BUNDLE=/app/certs/enterprise-root-ca.crt
```

Uncomment the certs volume in `docker-compose.yml`:

```yaml
volumes:
  - ./certs:/app/certs:ro
```

The entrypoint installs the cert into the OS trust store before starting the server.

**Option B — Baked into the image**

Drop any `*.crt` files into a `certs/` directory at the repo root before building. They are copied into the image and installed at build time.

```bash
mkdir -p certs
cp /path/to/enterprise-root-ca.crt certs/
docker compose build
```

### Build only (no compose)

```bash
docker build -t mitremap:latest .
docker run -d \
  -p 8443:4000 \
  -e JWT_SECRET=your-secret \
  -e NODE_ENV=production \
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

### PostgreSQL

MitreMap defaults to SQLite. Set `DATABASE_URL` to a `postgres://` connection string to switch to PostgreSQL — no code changes required. See [POSTGRES.md](POSTGRES.md) for full setup instructions, Docker Compose examples, and schema compatibility notes.

```env
DATABASE_URL=postgres://mitremap:changeme@localhost:5432/mitremap
```

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

### ATT&CK

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/attack/tactics` | List all tactics |
| `GET` | `/api/attack/techniques` | List techniques (query: `tactic`, `include_subtechniques=true`) |
| `GET` | `/api/attack/techniques/:id` | Technique detail with mitigations, D3FEND, and detections |
| `GET` | `/api/attack/mitigations` | List all mitigations |
| `GET` | `/api/attack/mitigations/:id` | Mitigation detail with techniques and covering tools |
| `GET` | `/api/attack/version` | Active ATT&CK version in the database |
| `GET` | `/api/attack/check-updates` | Compare DB version against latest GitHub release (admin) |
| `POST` | `/api/attack/apply-update` | Fetch and apply ATT&CK STIX update `{ version? }` (admin) |
| `GET` | `/api/attack/deprecated` | List deprecated / revoked techniques |
| `GET` | `/api/attack/migration-scan` | Detections referencing deprecated technique IDs |
| `GET` | `/api/attack/preview-update` | Preview added / removed / renamed techniques before applying an update |
| `POST` | `/api/attack/migrate-detections` | Auto-migrate deprecated detection technique IDs when a superseding ID exists |
| `GET/PUT` | `/api/attack/update-settings` | View / configure scheduled ATT&CK update checks |
| `POST` | `/api/attack/check-now` | Start an asynchronous update check |
| `GET` | `/api/attack/update-batches` | List staged ATT&CK update batches |
| `GET` | `/api/attack/update-batches/:batch_id` | Batch detail with item-level change data |
| `POST` | `/api/attack/update-batches/:batch_id/approve` | Approve an entire ATT&CK update batch |
| `POST` | `/api/attack/update-batches/:batch_id/reject` | Reject an entire ATT&CK update batch |

### Detections

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/detections` | List (filter: `status`, `severity`, `source`, `technique`) |
| `POST` | `/api/detections` | Create detection |
| `GET` | `/api/detections/:id` | Get detection |
| `PUT` | `/api/detections/:id` | Update detection |
| `DELETE` | `/api/detections/:id` | Delete detection |
| `PATCH` | `/api/detections/bulk` | Bulk status update `{ ids, status }` |
| `DELETE` | `/api/detections/bulk` | Bulk delete `{ ids }` |
| `POST` | `/api/detections/import` | Import array of detections |
| `GET` | `/api/detections/quality-scores` | Quality score (0–100, grade A–F) for all detections |
| `GET` | `/api/detections/:id/history` | Version history with per-version field diffs |
| `PATCH` | `/api/detections/:id/fire` | Log a fire event `{ outcome }` — increments TP/FP/suppressed counter |
| `PATCH` | `/api/detections/:id/review` | Stamp `last_reviewed_at` timestamp |

**Fire outcomes:** `true_positive` · `false_positive` · `suppressed`

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
| `GET` | `/api/coverage/covered` | Techniques covered by active detections or active-tool-backed mitigations |
| `GET` | `/api/coverage/attribution` | Coverage attribution log with filters and pagination |
| `GET` | `/api/prioritization/queue` | Ranked detection backlog with scoring components and recommended actions |
| `GET` | `/api/risk/score` | Overall risk score with component breakdown |
| `GET` | `/api/risk/by-tactic` | Risk score per tactic |
| `GET` | `/api/risk/by-technique` | Risk score per technique |

### Threat Groups

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/threat-groups` | List all groups |
| `POST` | `/api/threat-groups` | Create group `{ id, name, aliases, country, motivation, url, description, technique_ids, targeted_sectors? }` |
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
| `GET` | `/api/threat-groups/mitre-catalogue` | Searchable MITRE group catalogue for enrichment/import workflows |

**Procedure types:** `command` · `script` · `description` · `artifact` · `reference`

```json
{
  "type": "command",
  "content": "powershell.exe -nop -w hidden -enc JABjAGwAaQBlAG4AdA...",
  "source": "FireEye UNC2452 Report, Dec 2020"
}
```

### Campaigns & Indicators

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/campaigns?group_id=` | List campaigns for a threat group |
| `POST` | `/api/campaigns` | Create campaign `{ group_id, name, description?, start_date?, end_date?, source_url?, technique_ids? }` |
| `PUT/DELETE` | `/api/campaigns/:id` | Update / delete campaign |
| `GET` | `/api/indicators` | List indicators, filterable by `group_id` or `technique_id` |
| `POST` | `/api/indicators` | Create IOC `{ type, value, group_id?, technique_id?, confidence?, notes? }` |
| `PUT/DELETE` | `/api/indicators/:id` | Update / delete IOC |
| `GET` | `/api/indicators/export/stix` | Export indicators as STIX 2.1 JSON |

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
| `GET` | `/api/compliance/controls?framework_id=` | List controls, optionally filtered by framework |
| `GET` | `/api/compliance/gap?framework_id=` | Controls with no detection coverage |
| `GET` | `/api/compliance/snapshots?framework_id=` | Framework coverage snapshots |
| `GET` | `/api/compliance/export/:framework_id` | CSV export of controls with no detection coverage |

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
| `GET` | `/api/assignments/:type/:id` | Assignments for one entity |
| `PUT/DELETE` | `/api/assignments/:id` | Update / delete assignment |
| `GET` | `/api/audit` | Audit log (filter: `entity_type`, `entity_id`, `actor`, `action`) |
| `GET` | `/api/audit/:type/:id` | Audit log for one entity |

### Atomic Red Team & Custom Tests

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/atomic/tests` | List all tests (ART + custom) |
| `GET` | `/api/atomic/tests/:technique_id` | Tests for a specific technique |
| `GET` | `/api/atomic/coverage` | Technique-level test count and overall coverage % |
| `POST` | `/api/atomic/import` | Import ART YAML `{ yaml }` — returns `{ imported, skipped, total }` |
| `POST` | `/api/atomic/custom` | Create custom test `{ technique_id, name, description?, platform?, executor_type?, command? }` |
| `PUT` | `/api/atomic/custom/:id` | Update custom test fields |
| `DELETE` | `/api/atomic/custom/:id` | Delete custom test |
| `POST` | `/api/atomic/results` | Record test result `{ detection_id, art_test_id, status, notes?, run_by? }` |
| `PUT` | `/api/atomic/results/:id` | Update result status / notes |
| `DELETE` | `/api/atomic/results/:id` | Delete result |

**Test result statuses:** `untested` · `tested` · `validated` · `failed`

### Exercises

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/exercises` | List all exercises (with summary counts) |
| `POST` | `/api/exercises` | Create exercise `{ name, type?, status?, threat_group_id?, lead?, start_date?, end_date?, scope_notes?, description? }` — threat group techniques auto-populated |
| `GET` | `/api/exercises/:id` | Exercise detail with techniques, test runs, and findings |
| `PUT` | `/api/exercises/:id` | Update exercise fields |
| `DELETE` | `/api/exercises/:id` | Delete exercise and cascade |
| `POST` | `/api/exercises/:id/techniques` | Add techniques `{ technique_ids }` |
| `DELETE` | `/api/exercises/:id/techniques/:technique_id` | Remove technique from scope |
| `POST` | `/api/exercises/:id/tests` | Add test run `{ art_test_id, outcome?, notes?, ran_by? }` |
| `PUT` | `/api/exercises/:id/tests/:run_id` | Update test run outcome / notes |
| `DELETE` | `/api/exercises/:id/tests/:run_id` | Delete test run |
| `POST` | `/api/exercises/:id/findings` | Add finding `{ title, finding_type?, severity?, technique_id?, description?, recommendation? }` |
| `PUT` | `/api/exercises/:id/findings/:finding_id` | Update finding |
| `DELETE` | `/api/exercises/:id/findings/:finding_id` | Delete finding |
| `GET` | `/api/exercises/:id/report` | Purple team report — detection rate, technique breakdown, gaps, findings by severity |

**Exercise types:** `red_team` · `purple_team` · `tabletop`

**Exercise statuses:** `planning` · `active` · `completed` · `cancelled`

**Test run outcomes:** `pending` · `detected` · `partial` · `not_detected` · `blocked` · `n_a`

**Finding types:** `gap` · `detection_validated` · `detection_failed` · `control_weakness` · `new_ttp`

**Finding severities:** `critical` · `high` · `medium` · `low` · `informational`

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

### TAXII Feed Integration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/taxii/servers` | List all TAXII servers (credentials excluded) |
| `POST` | `/api/taxii/servers` | Register server `{ name, url, api_root?, collection_id?, auth_type?, username?, password?, token?, ssl_verify?, notes? }` |
| `PUT` | `/api/taxii/servers/:id` | Update server fields |
| `DELETE` | `/api/taxii/servers/:id` | Delete server and cascade jobs |
| `POST` | `/api/taxii/servers/:id/test` | Test connection — returns available collections |
| `POST` | `/api/taxii/servers/:id/fetch` | Trigger ad-hoc fetch (runs in background, returns immediately) |
| `GET` | `/api/taxii/batches` | List ingest batches with pending/approved/rejected counts |
| `GET` | `/api/taxii/batches/:batch_id/items` | Items in a batch with proposed data |
| `POST` | `/api/taxii/batches/:batch_id/approve` | Approve all pending items in batch |
| `POST` | `/api/taxii/batches/:batch_id/reject` | Reject all pending items in batch |
| `POST` | `/api/taxii/pending/:id/approve` | Approve single pending item |
| `POST` | `/api/taxii/pending/:id/reject` | Reject single pending item |
| `GET` | `/api/taxii/jobs` | List all scheduled ingest jobs |
| `POST` | `/api/taxii/jobs` | Create job `{ server_id, name, schedule }` — `schedule` is a cron expression |
| `PUT` | `/api/taxii/jobs/:id` | Update job name, schedule, or enabled flag |
| `DELETE` | `/api/taxii/jobs/:id` | Delete job and stop its schedule |
| `POST` | `/api/taxii/jobs/:id/run` | Manually trigger a scheduled job |

**Auth types:** `none` · `basic` · `bearer`

**Proposed actions:** `create_group` · `update_group` · `create_technique` · `link_technique`

**Pending item statuses:** `pending` · `approved` · `rejected`

### Webhooks & Alert Rules

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/webhooks/configs` | List webhook endpoint configurations |
| `POST` | `/api/webhooks/configs` | Create webhook config `{ name, url, secret?, custom_headers?, enabled? }` |
| `PUT` | `/api/webhooks/configs/:id` | Update webhook config fields |
| `DELETE` | `/api/webhooks/configs/:id` | Delete webhook config (cascades alert rules) |
| `POST` | `/api/webhooks/configs/:id/test` | Send a test payload to the webhook endpoint |
| `GET` | `/api/webhooks/rules` | List alert rules (joined with webhook config name/URL) |
| `POST` | `/api/webhooks/rules` | Create alert rule `{ name, type, webhook_config_id, threshold?, enabled? }` |
| `PUT` | `/api/webhooks/rules/:id` | Update alert rule fields |
| `DELETE` | `/api/webhooks/rules/:id` | Delete alert rule |

**Alert rule types:** `coverage_threshold` · `detection_validation_failed` · `new_uncovered_group_technique`

`threshold` (float, 0–100) is required when `type` is `coverage_threshold` and specifies the minimum coverage percentage below which the webhook fires.

### Detection Engineering Integrations

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/integrations/siem` | List / create SIEM integrations (`sentinel`, `splunk`, `elastic`, `crowdstrike`, `qradar`, `chronicle`) |
| `GET/PUT/DELETE` | `/api/integrations/siem/:id` | View / update / delete a SIEM integration |
| `POST` | `/api/integrations/siem/:id/test` | Test SIEM connection |
| `POST` | `/api/integrations/siem/:id/push` | Push one or more SIGMA-backed detections to the SIEM |
| `POST` | `/api/integrations/siem/:id/pull` | Pull rule statuses from the SIEM |
| `GET` | `/api/integrations/siem/:id/log` | Recent SIEM sync log entries |
| `GET/POST` | `/api/integrations/github-sync` | List / create GitHub rule sync configs |
| `GET/PUT/DELETE` | `/api/integrations/github-sync/:id` | View / update / delete GitHub sync config |
| `POST` | `/api/integrations/github-sync/:id/run` | Run GitHub rule sync now |
| `GET/POST` | `/api/integrations/ticketing` | List / create Jira or ServiceNow ticketing configs |
| `GET/PUT/DELETE` | `/api/integrations/ticketing/:id` | View / update / delete ticketing config |
| `POST` | `/api/integrations/ticketing/:id/create-ticket` | Create a ticket `{ summary, description, priority? }` |

### Report Schedules

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/report-schedules` | List / create scheduled report delivery |
| `PUT/DELETE` | `/api/report-schedules/:id` | Update / delete scheduled report |

### Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings/:key` | Get a setting value (sensitive keys return `{ configured: bool }` only) |
| `PUT` | `/api/settings/:key` | Upsert a setting `{ value }` |
| `DELETE` | `/api/settings/:key` | Clear a setting |

Known setting keys:

| Key | Sensitive | Purpose |
|---|---|---|
| `github_token` | yes | GitHub PAT used by ATT&CK update check to avoid rate limits |

### Exports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/exports/navigator` | ATT&CK Navigator layer JSON (download) |
| `GET` | `/api/exports/detections/csv` | Detections CSV (download) |
| `GET` | `/api/exports/tools/csv` | Tools CSV (download) |
| `GET` | `/api/exports/coverage/json` | Coverage matrix JSON (download) |
| `GET` | `/api/exports/report/pptx` | Executive report PowerPoint deck (download) |

### API Documentation

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/openapi.json` | OpenAPI 3.0 spec (machine-readable, no auth required) |
| `GET` | `/api/docs` | Swagger UI (interactive browser, no auth required) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, React Router v6, Recharts, Tailwind CSS |
| Build tool | Vite 5 |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | SQLite via `better-sqlite3` (WAL mode) or PostgreSQL 14+ via `pg` — set `DATABASE_URL` |
| Schema migrations | Knex.js (versioned migration files, run on startup or via `npm run migrate`) |
| Authentication | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), OIDC (Authorization Code flow) |
| TAXII | TAXII 2.1 client (native `http`/`https`); `node-cron` for scheduled ingest jobs |
| API docs | OpenAPI 3.0 spec + Swagger UI (`swagger-ui-express`) |
| Testing | Vitest (unit + integration tests, in-memory SQLite harness) |
| TLS | `selfsigned` (auto self-signed cert) or BYO cert via `SSL_CERT_PATH`/`SSL_KEY_PATH` |
| Runtime tooling | `tsx` (TS dev runner), `concurrently` |
| Container | Docker (multi-stage Alpine build, non-root `mitremap` user, `gosu` privilege drop) |

---

## Project Structure

```
mitremap/
├── server/
│   └── src/
│       ├── index.ts            # Express app entry (HTTP dev / HTTPS prod)
│       ├── middleware/
│       │   └── auth.ts         # requireApiKey — Bearer token + SHA-256 validation
│       ├── db/
│       │   ├── database.ts     # getKnex(), logAudit(), raw* helpers
│       │   ├── knex.ts         # Knex connection + migration runner
│       │   ├── seed.ts         # Idempotent seeding
│       │   └── migrations/
│       │       ├── 001_core_schema.ts               # Base schema
│       │       ├── 002_new_features.ts              # Auth, ART, data sources, ATT&CK versioning
│       │       ├── 003_custom_tests.ts              # source column on art_tests
│       │       ├── 004_exercises.ts                 # Exercises, test runs, findings
│       │       ├── 005_exercises_blocked.ts         # blocked column on exercise_test_runs
│       │       ├── 006_taxii.ts                     # TAXII servers, jobs, pending ingests
│       │       ├── 007_taxii_fetch_status.ts        # last_fetch_* columns on taxii_servers
│       │       ├── 008_taxii_skipped.ts             # last_fetch_skipped column
│       │       ├── 009_detection_effectiveness.ts   # TP/FP/suppressed counters + review timestamp
│       │       ├── 010_webhooks.ts                  # webhook_configs + alert_rules tables
│       │       ├── 011_settings.ts                  # key-value app settings table
│       │       ├── 012_taxii_auto_merge.ts          # auto_merge flag on taxii_servers
│       │       ├── 013_prioritization_and_versions.ts # detection_versions + targeted_sectors
│       │       ├── 014_coverage_attribution.ts      # coverage attribution log
│       │       ├── 015_attack_update_queue.ts       # staged ATT&CK update batches
│       │       ├── 016_notifications.ts             # user notifications
│       │       ├── 017_compliance_snapshots.ts      # compliance trend snapshots
│       │       ├── 018_siem_integrations.ts         # SIEM, GitHub sync, ticketing configs
│       │       ├── 019_intelligence.ts              # campaigns, indicators, CVEs
│       │       └── 020_report_schedules.ts          # scheduled report delivery
│       ├── data/
│       │   ├── attack.ts           # ATT&CK tactics, techniques, mitigations
│       │   ├── d3fend.ts           # D3FEND techniques + ATT&CK mappings
│       │   ├── stix-fetch.ts       # Live ATT&CK STIX fetcher (GitHub)
│       │   ├── threat-groups.ts
│       │   ├── compliance.ts       # NIST CSF 2.0, CIS v8, ISO 27001, PCI DSS, SOC 2
│       │   ├── atomic-tests.ts     # Live ART fetch + static baseline
│       │   ├── data-sources.ts     # Seed ATT&CK data sources
│       │   └── demo.ts             # Demo tools and detections
│       ├── taxii/
│       │   ├── client.ts           # TAXII 2.1 HTTP client (basic + bearer auth)
│       │   ├── parser.ts           # STIX bundle → proposed-action records
│       │   ├── ingest.ts           # runFetch(), applyPendingItem(), rejectPendingItem()
│       │   └── scheduler.ts        # node-cron job lifecycle
│       ├── scripts/
│       │   └── migrate.ts          # Standalone migration runner (dist/scripts/migrate.js)
│       ├── openapi.ts              # OpenAPI 3.0 spec definition
│       ├── __tests__/              # Vitest unit/integration tests
│       │   ├── auth.test.ts
│       │   ├── coverage.test.ts
│       │   ├── database.test.ts
│       │   ├── detections.test.ts
│       │   ├── risk.test.ts
│       │   └── helpers/testDb.ts   # In-memory SQLite test harness
│       └── routes/                 # One file per resource group
│           ├── attack.ts             # Tactics, techniques, live updates, versioning
│           ├── auth.ts               # Login, refresh, logout, OIDC
│           ├── users.ts              # User CRUD + password reset
│           ├── atomic.ts             # ART import, custom tests, coverage, results
│           ├── data-sources.ts       # ATT&CK data source management
│           ├── exercises.ts          # Exercise / purple team workflow
│           ├── taxii.ts              # TAXII servers, jobs, pending-item review
│           ├── threat-groups.ts      # CRUD + technique assignment + procedures
│           ├── prioritization.ts     # Ranked detection backlog
│           ├── notifications.ts      # Notification center data
│           ├── integrations.ts       # SIEM, GitHub sync, ticketing
│           ├── campaigns.ts          # Threat-group campaign tracking
│           ├── indicators.ts         # IOC CRUD + STIX export
│           ├── cves.ts               # CVE tracking + ATT&CK mapping
│           ├── report-schedules.ts   # Scheduled report delivery
│           ├── api-keys.ts           # API key lifecycle (hash, mask, revoke)
│           ├── webhooks.ts           # Webhook config + alert rule CRUD
│           ├── settings.ts           # Key-value settings store
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
│           ├── AttackMatrix.tsx    # Heatmap with subtechnique support
│           ├── Detections.tsx
│           ├── Tools.tsx
│           ├── DefenseMapping.tsx
│           ├── GapAnalysis.tsx
│           ├── ThreatGroups.tsx    # Per-TTP procedure editor
│           ├── AtomicTests.tsx     # ART + custom test browser/editor
│           ├── DataSources.tsx     # ATT&CK data source management
│           ├── Exercises.tsx       # Red/purple team exercise workflow
│           ├── TaxiiIngest.tsx     # TAXII feed management + review queue
│           ├── Prioritization.tsx    # Ranked detection backlog and actions
│           ├── Compliance.tsx        # Framework coverage, trends, exports
│           ├── SigmaLibrary.tsx      # SIGMA library search/import
│           ├── Integrations.tsx      # SIEM, GitHub sync, ticketing
│           ├── Reports.tsx           # Reports, exports, scheduled delivery
│           ├── ApiPlayground.tsx   # Interactive API explorer
│           └── Settings.tsx        # API keys · users · ATT&CK updates · data mgmt
├── certs/                      # Optional: TLS / enterprise CA certs (not committed)
├── entrypoint.sh               # Docker entrypoint: CA injection → gosu privilege drop
├── Dockerfile
├── docker-compose.yml
├── .env.example                # Copy to .env before running docker compose
├── POSTGRES.md                 # PostgreSQL setup and compatibility guide
└── package.json                # npm workspaces root
```

---

## License

MIT
