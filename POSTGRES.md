# PostgreSQL Production Guide

MitreMap defaults to SQLite for local development. Setting `DATABASE_URL` to a `postgres://` URL switches the backend entirely — no code changes required.

---

## Prerequisites

- PostgreSQL 14 or later
- The `pg` npm package is already a declared dependency (no extra install needed)

---

## 1. Create the database and role

```sql
CREATE USER mitremap WITH PASSWORD 'changeme';
CREATE DATABASE mitremap OWNER mitremap;
GRANT ALL PRIVILEGES ON DATABASE mitremap TO mitremap;
```

For a managed service (RDS, Cloud SQL, Supabase, etc.), create the database through the provider console and note the connection string.

---

## 2. Set environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes (PG) | — | `postgres://user:pass@host:5432/dbname` |
| `DB_POOL_MIN` | no | `2` | Minimum idle connections in pool |
| `DB_POOL_MAX` | no | `10` | Maximum connections in pool |
| `DB_POOL_IDLE_TIMEOUT` | no | `30000` | ms before an idle connection is released |
| `DB_POOL_ACQUIRE_TIMEOUT` | no | `30000` | ms to wait for a connection before erroring |

Connection URL formats:

```
# plain password
DATABASE_URL=postgres://mitremap:changeme@localhost:5432/mitremap

# with SSL (recommended for production)
DATABASE_URL=postgres://mitremap:changeme@db.example.com:5432/mitremap?sslmode=require

# connection pool sizing (tune to your Postgres max_connections)
DB_POOL_MIN=5
DB_POOL_MAX=20
```

Set `max` to no more than 80 % of your PostgreSQL `max_connections` divided by the number of app replicas.

---

## 3. Run migrations

The `migrate` commands run the schema-only, without starting the HTTP server. Use them during CI/CD and container init steps.

```bash
# Apply all pending migrations (idempotent)
cd server
DATABASE_URL=postgres://... npm run migrate

# Check current status
DATABASE_URL=postgres://... npm run migrate:status

# Roll back the last batch (dev/staging only)
DATABASE_URL=postgres://... npm run migrate:rollback
```

In production containers, prefer running migrations as a separate init step before the main process, or in an init container, rather than inside the server startup:

```dockerfile
# example entrypoint pattern
RUN npm run build
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/index.js"]
```

The built migrate script is at `dist/scripts/migrate.js` after `npm run build`.

---

## 4. Docker Compose with an external PostgreSQL service

Add a `postgres` service to `docker-compose.yml` or create an override file:

```yaml
# docker-compose.pg.yml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: mitremap
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: mitremap
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "mitremap"]
      interval: 5s
      retries: 5

  mitremap:
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://mitremap:changeme@postgres:5432/mitremap
      DB_POOL_MIN: "2"
      DB_POOL_MAX: "10"

volumes:
  pg-data:
```

Run with both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.pg.yml up -d
```

---

## 5. Migrating an existing SQLite instance

There is no automated data migration tool included. For a new deployment, run migrations against PostgreSQL and re-seed via the normal server startup. If you need to carry over existing data, use a tool like [pgloader](https://pgloader.io/) or export/import via the MitreMap API export endpoints before switching databases.

---

## 6. Schema compatibility notes

- All migrations use the knex schema builder, so syntax differences between SQLite and PostgreSQL are handled automatically.
- Raw SQL in route handlers uses `?` parameter placeholders, which knex translates to `$1, $2, ...` for PostgreSQL at query time.
- `RETURNING id` clauses (used by `rawInsert`) work on PostgreSQL and SQLite ≥ 3.35. Both are supported.
- Boolean-like columns (`is_subtechnique`, `is_active`, etc.) are stored as integers (`0`/`1`) rather than native `BOOLEAN` — queries comparing against `0` and `1` work on both drivers.
- Migration `005_exercises_blocked` uses `t.boolean()` on PostgreSQL and a raw `INTEGER` column on SQLite for the `blocked` column; the application checks it with a truthy comparison (`if (run.blocked)`), which handles both `1` and `true`.

### TAXII tables (migration 006)

Three tables are added by `006_taxii.ts`:

| Table | Purpose |
|---|---|
| `taxii_servers` | Connection config for external TAXII 2.1 servers |
| `taxii_ingest_jobs` | Scheduled fetch jobs linked to a server |
| `taxii_pending_ingests` | Staging area for ingested STIX objects awaiting analyst review |

Compatibility notes specific to these tables:

- `taxii_servers.password` and `taxii_servers.token` are `TEXT` columns (not `VARCHAR(255)`) to accommodate long bearer tokens and hashed credentials.
- `taxii_servers.ssl_verify` and `taxii_ingest_jobs.enabled` are stored as `INTEGER` (`0`/`1`) on both drivers; application code reads them with `=== 1` comparisons.
- Indexes on `taxii_pending_ingests(batch_id)` and `taxii_pending_ingests(status)` are created by the migration to support the batch-review query patterns used by the TAXII routes.
- `ON CONFLICT DO NOTHING` clauses in the ingest apply path are supported by both SQLite and PostgreSQL.

### TAXII fetch status (migration 007)

Adds `last_fetch_at`, `last_fetch_status`, `last_fetch_count`, and `last_fetch_error` columns to `taxii_servers`. All are nullable; `last_fetch_status` is a `VARCHAR` enum (`running` / `success` / `error`).

### TAXII skipped count (migration 008)

Adds `last_fetch_skipped` (`INTEGER`, default `0`) to `taxii_servers`. Records how many STIX objects were deduplicated and skipped during a fetch.

### Detection effectiveness metrics (migration 009)

Adds five columns to `detections`:

| Column | Type | Purpose |
|---|---|---|
| `last_fired_at` | `TIMESTAMP` nullable | Timestamp of the most recent alert fire event |
| `true_positive_count` | `INTEGER` default `0` | Cumulative true-positive fire count |
| `false_positive_count` | `INTEGER` default `0` | Cumulative false-positive fire count |
| `suppressed_count` | `INTEGER` default `0` | Cumulative suppressed alert count |
| `last_reviewed_at` | `TIMESTAMP` nullable | Timestamp of the most recent analyst review |

These counters are incremented via `PATCH /api/detections/:id/fire` and are used by the quality-score algorithm to produce empirical false-positive rate estimates.

### Webhooks and alert rules (migration 010)

Creates two new tables:

**`webhook_configs`** — outbound webhook endpoints:

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | — |
| `name` | `VARCHAR` | Display name |
| `url` | `VARCHAR` | Target URL (validated on write) |
| `secret` | `TEXT` nullable | Shared HMAC secret for payload signing |
| `custom_headers` | `TEXT` nullable | JSON object of additional HTTP headers |
| `enabled` | `BOOLEAN` / `INTEGER` | `0`/`1` on SQLite; native `BOOLEAN` on PostgreSQL |
| `created_at` / `updated_at` | `TIMESTAMP` | — |

**`alert_rules`** — conditions that trigger a webhook:

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | — |
| `name` | `VARCHAR` | Display name |
| `type` | `VARCHAR` | `coverage_threshold` \| `detection_validation_failed` \| `new_uncovered_group_technique` |
| `threshold` | `FLOAT` nullable | Minimum coverage % (required for `coverage_threshold` type) |
| `webhook_config_id` | FK → `webhook_configs(id)` | Cascade deletes when the config is removed |
| `enabled` | `BOOLEAN` / `INTEGER` | — |
| `last_notified_at` | `TIMESTAMP` nullable | — |
| `created_at` / `updated_at` | `TIMESTAMP` | — |

Compatibility note: `enabled` is created with `t.boolean()` via knex, which maps to native `BOOLEAN` on PostgreSQL and `INTEGER` on SQLite. Application code reads it with a truthy comparison.

### Application settings store (migration 011)

Creates a `settings` table — a simple key-value store used for application-level configuration (e.g. the GitHub personal access token used for ATT&CK update checks):

| Column | Type | Notes |
|---|---|---|
| `key` | `VARCHAR` PK | Setting identifier |
| `value` | `TEXT` nullable | Stored value; sensitive keys are masked in API responses |
| `updated_at` | `TIMESTAMP` | — |

`ON CONFLICT(key) DO UPDATE` (upsert) is used for writes; this syntax is supported by both SQLite and PostgreSQL.

### TAXII auto-merge flag (migration 012)

Adds `auto_merge` (`INTEGER`, default `0`) to `taxii_servers`. When set to `1`, approved STIX items are applied automatically without analyst review.

### Detection version history and threat group sectors (migration 013)

**`detection_versions`** — full snapshot of detection fields at each create/update:

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | — |
| `detection_id` | `INTEGER` | References `detections(id)` (no FK constraint — soft reference) |
| `version_number` | `INTEGER` | Sequential per detection |
| `snapshot` | `TEXT` | JSON-serialized detection object at this point in time |
| `changed_by` | `VARCHAR` | Actor identifier (user email, API key name) |
| `changed_at` | `TIMESTAMP` | — |
| `change_summary` | `VARCHAR` nullable | Human-readable summary of changed fields |

An index on `detection_versions(detection_id)` is created explicitly for fast history lookups.

**`threat_groups.targeted_sectors`** — adds a `targeted_sectors` column (`TEXT`, default `'[]'`) to store a JSON array of industry sector strings per threat group. The migration uses a raw `ALTER TABLE` statement (not `t.text()`) for safe re-entrancy with the `IF NOT EXISTS` guard:

```sql
ALTER TABLE threat_groups ADD COLUMN targeted_sectors TEXT NOT NULL DEFAULT '[]'
```

This raw form is compatible with both SQLite and PostgreSQL. On PostgreSQL, if the migration is re-run, the `hasColumn` check prevents a duplicate-column error.
