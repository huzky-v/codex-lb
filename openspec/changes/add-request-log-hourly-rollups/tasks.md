## 1. Spec

- [x] 1.1 Add `query-caching` requirements for closed-hour request-log rollups and split raw/rollup reads.
- [x] 1.2 Add `database-migrations` requirements for rollup backfill and safe watermark seeding.

## 2. Implementation

- [x] 2.1 Add `RequestLogHourlyRollup` and `RequestLogRollupState` ORM models to `app/db/models.py`.
- [x] 2.2 Create Alembic migration with table creation, idempotency guards, historical backfill of all closed hours, and watermark seeding for empty databases.
- [x] 2.3 Add rollup repository read methods (`aggregate_hourly_rollups_by_bucket`, `aggregate_rollup_activity`, `aggregate_rollup_cost_by_model`) and write methods (`replace_hour_rollup`, `advance_rollup_watermark`, `get_rollup_watermark`) to `app/modules/request_logs/repository.py`.
- [x] 2.4 Add `until` bounds to existing `aggregate_by_bucket`, `aggregate_activity_since`, `top_error_since`, and new `aggregate_cost_by_model` in `RequestLogsRepository`.
- [x] 2.5 Add leader-elected hourly rollup scheduler (`rollup_scheduler.py`, 300s interval) and wire it into `app/main.py` lifecycle.
- [x] 2.6 Route dashboard overview through raw-head + rollup-middle + raw-tail split reads in `app/modules/dashboard/service.py` and `repository.py`.
- [x] 2.7 Route usage summary through the same split read pattern in `app/modules/usage/service.py`, adding `build_cost_summary_from_aggregates` and `build_metrics_from_aggregate` helpers.

## 3. Validation

- [x] 3.1 Add or update migration/idempotence coverage for fresh DBs, legacy remap reruns, and schema drift assertions.
- [x] 3.2 Run `ruff check` and full `pytest`; only the pre-existing `tests/unit/test_request_locality.py` failures remain (3 tests, fail on `main` too).
- [ ] 3.3 Run `openspec validate --specs`.
