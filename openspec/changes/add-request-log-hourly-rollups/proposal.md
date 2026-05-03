## Why

Dashboard overview and usage summary endpoints aggregate over `request_logs` across multi-day windows. On SQLite-backed deployments with heavy traffic, these full-table aggregation queries repeat the same expensive scan on every request, causing slow page loads and high CPU spikes. Precomputing hourly rollups for closed hours eliminates redundant aggregation work while keeping the public API response contracts unchanged.

## What Changes

- Add `request_log_hourly_rollups` table (composite PK: `bucket_hour`, `model`, `service_tier_key`) and `request_log_rollup_state` watermark table.
- Alembic migration creates the tables, backfills all historical closed hours, and seeds a watermark so readers know which hours are safe to serve from rollups.
- Add a leader-elected background scheduler (300s interval) that finalizes newly closed hours after each hour boundary.
- Switch dashboard overview and usage summary read paths to a raw-head + rollup-middle + raw-tail split: partial leading hour and current in-progress hour stay raw, closed middle hours come from precomputed rollups.
- Keep `topError` reading from raw `request_logs` in phase 1 (rollup table does not carry error-code breakdown).

## Impact

- **Code**: `app/db/models.py`, `app/modules/request_logs/repository.py`, `app/modules/request_logs/rollup_scheduler.py` (new), `app/modules/dashboard/repository.py`, `app/modules/dashboard/service.py`, `app/modules/usage/service.py`, `app/modules/usage/builders.py`, `app/main.py`
- **DB**: New Alembic revision adding two tables and one performance index; backfill of historical closed hours
- **Behavior**: API response schemas unchanged; dashboard and usage summary reads become faster on databases with significant request-log volume
- **Tests**: Migration idempotence coverage for fresh DBs, legacy remap reruns, and schema drift assertions
- **Specs**: `query-caching`, `database-migrations`
