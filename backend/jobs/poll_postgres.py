"""Backward-compatible entrypoint for the Render Cron Job.

The cron now handles both PostgreSQL and REST pull sources. Use either
``python -m jobs.run_cron`` or ``python -m jobs.poll_postgres``.
"""

from jobs.run_cron import main


if __name__ == "__main__":
    main()
