# General-Purpose Data Monitoring & Observability Platform

A domain-agnostic data-reliability layer: ingest structured data, establish what healthy looks
like, compare new batches against configurable rules and a controlled baseline, detect anomalies
and drift, store evidence, notify by email, and let the user investigate everything in a web app.

**Current status: scaffold only.** The application boots and the module boundaries exist, but no
ingestion, profiling, detection, incident, alerting or UI logic is implemented yet.

## Repository layout

```
backend/
  app/
    main.py            FastAPI application factory, CORS, router mounting, /health
    core/config.py     Environment-driven settings (Pydantic Settings)
    db/                SQLAlchemy engine, session, declarative base
    models/            The ten platform entities (tables only, minimal columns)
    schemas/           Pydantic request/response models (empty)
    api/routes/        One router per functional area (no endpoints yet)
    ingestion/         CSV/Excel, PostgreSQL, REST API connectors (empty)
    processing/        Normalization, profiler, schema registry (empty)
    detection/         Rules, statistics, Isolation Forest, decision engine (empty)
  jobs/
    poll_postgres.py   Render Cron Job entrypoint for scheduled PostgreSQL monitoring
  tests/               pytest
frontend/
  src/
    pages/             One stub per product module
    components/        Layout, shared placeholder
    api/client.js      Fetch wrapper around the FastAPI backend
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy ..\.env.example .env       # then edit DATABASE_URL and SMTP_*
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Tests:

```bash
cd backend
pytest
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173
- `/api` is proxied to `http://localhost:8000` in development, so no CORS setup is needed locally.

For a deployment build, set `VITE_API_BASE_URL` to the deployed backend origin before
`npm run build`.

## Scheduled monitoring

PostgreSQL sources are polled by a Render Cron Job that runs `jobs/poll_postgres.py`
(not implemented yet). CSV/Excel and REST API sources are processed immediately on request.

## Frozen stack

React + Vite + Tailwind CSS (static site) · Python + FastAPI + Pydantic + SQLAlchemy + psycopg 3 ·
Pandas + NumPy + SciPy + scikit-learn (Isolation Forest) + joblib · PostgreSQL · Render Cron Jobs ·
SMTP email · pytest + Postman · Git + GitHub.

Deliberately excluded: Docker, Compose, Nginx, Redis, Celery, RabbitMQ, Kafka, APScheduler,
Polars, streaming infrastructure, microservices.
