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
