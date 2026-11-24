"""Render Cron Job entrypoint.

Run with: python -m jobs.run_cron

A single invocation checks every active pull-based source and polls the ones
whose configured interval has elapsed. There is no in-process scheduler: Render
decides when the job runs.
"""

from datetime import datetime, timedelta, timezone

from app.db.init import init_db
from app.db.session import SessionLocal
from app.models.data_source import DataSource
from app.models.ingestion_batch import IngestionBatch
from app.schemas.enums import SourceType
from app.services.polling import POLLABLE, poll_source


def _as_utc(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def main() -> None:
    init_db()
    polled = 0
    skipped = 0
    failed = 0

    with SessionLocal() as db:
        sources = (
            db.query(DataSource)
            .filter(
                DataSource.status == "active",
                DataSource.source_type.in_(sorted(POLLABLE)),
            )
            .order_by(DataSource.id)
            .all()
        )

        for source in sources:
            config = source.config or {}
            minutes = int(config.get("poll_interval_minutes") or 60)
            latest = (
                db.query(IngestionBatch)
                .filter(
                    IngestionBatch.data_source_id == source.id,
                    IngestionBatch.status != "failed",
                )
                .order_by(IngestionBatch.received_at.desc())
                .first()
            )
            now = datetime.now(timezone.utc)
            if latest and latest.received_at:
                due_at = _as_utc(latest.received_at) + timedelta(minutes=minutes)
                if now < due_at:
                    skipped += 1
                    continue

            result = poll_source(db, source)
            if result.get("status") == "failed":
                failed += 1
                print(f"FAILED source={source.id} name={source.name} error={result.get('error')}")
            else:
                polled += 1
                print(
                    f"POLLED source={source.id} name={source.name} "
                    f"rows={result.get('row_count')} incidents={result.get('incidents')}"
                )

    print(f"cron complete: polled={polled} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
