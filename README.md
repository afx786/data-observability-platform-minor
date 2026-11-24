# General-Purpose Data Monitoring & Observability Platform

A domain-agnostic data-reliability layer: ingest structured data, establish what healthy looks
like, compare new batches against configurable rules and a controlled baseline, detect anomalies
and drift with statistics and Isolation Forest, store evidence, notify by email, and investigate
everything in a React workspace.

**Status: complete MVP.** All product slices are implemented: CSV/Excel ingestion, profiling,
schema/rule checks, versioned baselines, severity and incident lifecycle, SMTP alerts, REST and
PostgreSQL pull connectors, Render Cron entrypoint, statistical drift detectors, Isolation
Forest, reports, and the full frontend workspace.

## Repository layout

```
backend/
  app/
    main.py            FastAPI app, CORS, lifespan, /health, router mounting
    api/routes/        Auth, sources, ingestion, profiling, monitoring, incidents,
                       baselines, rules, alerts, reports
    connectors/        REST and PostgreSQL pull connectors
    db/                SQLAlchemy engine, sessions, create_all initialisation
    detection/         Rules, severity/decision engine, statistics, Isolation Forest
    models/            Database entities
    processing/        Normalisation, profiler, schema registry
    schemas/           Pydantic contracts shared with the API/frontend
    services/          Monitoring orchestration, baselines, alerts, polling
  jobs/
    create_admin.py    First-admin bootstrap
    run_cron.py        Render Cron Job entrypoint (all pull-based sources)
    poll_postgres.py   Backward-compatible alias for run_cron
  tests/               pytest (API, contracts, pipeline, detectors, fault injection)
  postman/             Postman collection
frontend/
  src/pages/           Dashboard, Sources, Profiling, Schema & Rules, Monitoring,
                       Incidents, Baselines, Alert Policies, Reports, Users
  src/components/      Reusable workspace components and charts
  src/api/             Fetch wrapper and endpoint helpers
docs/
  DECISIONS.md         Authoritative decisions and stale-document reconciliation
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (SQLite works as a local fallback with `DATABASE_URL=sqlite:///./dev.db`)
- An SMTP account for real email delivery (Gmail App Password or any SMTP provider)

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy ..\.env.example .env       # then edit DATABASE_URL, SECRET_KEY and SMTP_*
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Create the first admin once the database is reachable:

```bash
cd backend
set BOOTSTRAP_ADMIN_EMAIL=admin@example.com
set BOOTSTRAP_ADMIN_PASSWORD=choose-a-password
python -m jobs.create_admin
```

Roles form a hierarchy: **Admin ⊃ Analyst ⊃ Viewer**. Login returns a JWT; send it as
`Authorization: Bearer <token>` on every other request. Viewer can read; Analyst can approve
baselines, change rules/status and save policies; Admin can also manage users.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Platform database (PostgreSQL in deployment, SQLite for local tests) |
| `SECRET_KEY` | JWT signing key — replace the development default before deployment |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | First admin credentials |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` | Email alerts |
| `MONITORED_DATABASE_URL` | Default DSN for monitored PostgreSQL sources |
| `ML_MODEL_DIR` | Where per-source Isolation Forest pipelines are stored (default `models/`) |
| `FRONTEND_ORIGIN` | Allowed browser origin for CORS |
| `VITE_API_BASE_URL` | Deployed backend origin; leave empty locally to use the Vite proxy |

## Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173
- `/api` is proxied to `http://localhost:8000` in development.
- For a deployment build, set `VITE_API_BASE_URL` before `npm run build`.

The workspace supports: file upload and source configuration (including all four source types),
manual polling, live profiling, schema/rule management, 1–24h anomaly-rate charts, an incident
investigation view with expected vs observed evidence and lifecycle controls, controlled baseline
approval, alert policies/history, and quality/system reports with CSV export.

## Scheduled monitoring

Render Cron Jobs run:

```bash
cd backend
python -m jobs.run_cron
```

One invocation checks every active PostgreSQL and REST source and polls the ones whose
`poll_interval_minutes` has elapsed. CSV/Excel files are processed immediately on upload; REST
sources are also pulled immediately when created. There is no in-process scheduler.

## API map

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/token`, `GET /api/auth/me`, admin user CRUD |
| Sources | `GET/POST /api/sources`, `GET /api/sources/{id}`, `POST /api/sources/{id}/poll` |
| Ingestion | `POST /api/ingestion/upload`, `GET /api/ingestion/batches` |
| Profiling | `GET /api/profiles` |
| Monitoring | `GET /api/monitoring/summary`, `GET /api/monitoring/anomaly-rate` |
| Incidents | `GET /api/incidents`, `GET /api/incidents/{id}`, `PATCH /api/incidents/{id}?status=` |
| Baselines | `GET/POST /api/baselines`, `GET /api/baselines/active` |
| Rules | `GET/POST /api/rules`, `PATCH/DELETE /api/rules/{id}`, `GET /api/rules/schemas` |
| Alerts | `GET /api/alerts`, `GET /api/alerts/policies`, `PUT /api/alerts/policies/{source_id}` |
| Reports | `GET /api/reports/quality`, `GET /api/reports/system-status` |

Import `backend/postman/Data_Observability.postman_collection.json` into Postman. Set
`baseUrl` (default `http://localhost:8000`) and run **Auth / Login** first — the collection
script stores the token automatically.

## Tests

```bash
cd backend
python -m pytest -q
```

The suite uses an in-memory SQLite database and temporary model directories, so no external
services are needed. It covers auth/RBAC, contracts, ingestion/profiling, baselines, severity,
incident deduplication, alert cooldown, connectors, windowed monitoring, reports, statistical
detectors, Isolation Forest, and fault-injected drift.

```bash
cd frontend
npm run build
```

## Settled design decisions

| Area | Decision |
|---|---|
| Raw data | Profiles only, plus a small evidence snapshot in each incident. No full row retention. |
| Batch | One time slice per poll/upload. Hourly slices are stored; a chosen 1–24h view aggregates them. |
| Viewing window | `window_hours` is 1–24 and changes only views/rolling comparisons — never a baseline or model. |
| Schema changes | `Base.metadata.create_all()`; no Alembic in the MVP. |
| Severity | Fixed table by detector; a large deviation or 3 consecutive occurrences bumps one level, capped at CRITICAL. |
| Isolation Forest | Row scores aggregate to `% flagged`; one model per source/baseline version; numeric non-ID features; retrained only on explicit baseline approval. |
| REST sources | Pull-based with URL, auth header, JSON path and pagination support. |
| Auth | JWT in the Authorization header; Admin ⊃ Analyst ⊃ Viewer; Excel sheets become separate sources. |
| Incidents | `OPEN → ACKNOWLEDGED → RESOLVED`; dedupe by source + column + detector while open; 60-minute alert cooldown. |
| Timestamps | UTC in the database, IST in the UI. |
| Deploy target | Render web service + Render Cron Job + static frontend; SMTP email. |

See `docs/DECISIONS.md` for the full list and reconciliation of stale report/PPT wording.

## Frozen stack

React + Vite + Tailwind CSS + Recharts · FastAPI + Pydantic + SQLAlchemy + psycopg 3 ·
Pandas + NumPy + SciPy + scikit-learn (Isolation Forest) + joblib · PostgreSQL · Render Cron Jobs ·
SMTP email · pytest + Postman · Git + GitHub.

Deliberately excluded: Docker, Compose, Nginx, Redis, Celery, RabbitMQ, Kafka, APScheduler,
Polars, PSI-based drift, streaming infrastructure, and unnecessary microservices.
