# Authoritative decisions

This file is the single source of truth for the implemented MVP. The freshest team pitch and the
user-confirmed decisions in the project conversation take precedence over the older academic
report and slide deck, which contain wording from earlier iterations.

## Pipeline

`ingest → normalize → profile → schema check → rules/statistics/ML → decision/severity →
incident/evidence → email alert → web investigation`

Every detector emits one uniform `Finding` shape (detector, field, severity, observed, expected,
magnitude, message, evidence). The decision engine converts findings into evidence-backed
incidents. No detector persists data or decides notification policy itself.

## Sources and batching

- CSV and Excel are processed immediately. Each Excel sheet becomes its own source/table.
- REST APIs are pull-based: URL, method, headers, Authorization header, dot-path to the records
  array, and optional page-based pagination. They are pulled on creation and by the cron job.
- PostgreSQL is monitored by a Render Cron Job. A source may use a table or a single SELECT query;
  `database_url` overrides `MONITORED_DATABASE_URL`.
- One batch represents one time slice. The cron stores hourly slices; views aggregate them.
- Raw rows are never stored. Profiles are persisted; incidents carry a compact evidence snapshot.

## Window semantics

`window_hours` is constrained to 1–24. It selects how many recent hourly batches a view or a
rolling comparison considers. It **never** changes a baseline, a configured rule, or a fitted
model. This is enforced by API validation and by keeping baseline/model state separate from the
view parameter.

## Detection

| Detector | Method |
|---|---|
| Schema | Column presence, dtype and newly-nullable fields vs the active schema |
| Rules | Configurable null rate, duplicate rate, required columns and freshness |
| Baseline | NULL-rate and volume movement vs the approved reference profile |
| IQR | Per numeric non-ID column, 1.5×IQR bounds, outlier-rate threshold |
| Rolling z-score | Current batch mean vs the means of recent batches within the selected window |
| KS | Current numeric values vs a normal fit to the approved baseline |
| Chi-square | Current category frequencies vs approved baseline frequencies |
| Isolation Forest | Row-level scores aggregated into `% flagged` for the batch |

Numeric features exclude ID/key/uuid-like columns and can be overridden with `ml_features` or
`ml_exclude_columns`. One joblib pipeline exists per source and baseline version. A model is
trained only when a baseline is approved (or its feature set changes); the training batch is not
scored against itself. An approved baseline update resets the model version and triggers retraining.

## Severity, incidents and alerts

- Base severity by detector: schema/baseline/freshness = HIGH; rules/volume/statistics/ML = MEDIUM;
  IQR = LOW. A configured rule uses its own severity.
- A large deviation (`magnitude >= 5`) or three consecutive occurrences bumps severity by one
  level, capped at CRITICAL.
- Incidents deduplicate by source + column + detector while `OPEN` or `ACKNOWLEDGED`. Repeat
  detections increment `occurrences` and update evidence instead of creating noise.
- Lifecycle: `OPEN → ACKNOWLEDGED → RESOLVED`. Analysts and admins may change status.
- Email policy: per-source recipients, severity filter, enabled flag and 60-minute cooldown.
  Delivery status (`sent`, `failed`, `suppressed`) is recorded in alert history.

## Auth and roles

JWT is sent in the `Authorization` header. Roles are hierarchical: Admin ⊃ Analyst ⊃ Viewer.
Only admins manage users; analysts approve baselines, manage rules/policies and change incident
status; viewers have read-only access.

## Timestamps

All database timestamps are UTC. The React UI formats them in `Asia/Kolkata` (IST).

## Stale-document reconciliation

| Older report/PPT wording | Implemented decision |
|---|---|
| PSI-based drift | KS test for numeric drift, chi-square for categorical drift |
| Polars | Pandas |
| APScheduler | Render Cron Jobs calling `python -m jobs.run_cron` |
| Docker, Docker Compose, Nginx | Render web service + static frontend; no container layer in the MVP |
| Railway | Render only |
| Event streams / real-time streaming | Batch pull ingestion; no streaming infrastructure |
| Raw data retention | Profiles and evidence snapshots only |
| Automatic model retraining | Retrain only on explicit baseline approval |
