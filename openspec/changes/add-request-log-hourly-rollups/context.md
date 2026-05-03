## Purpose

This change adds hourly request-log rollups so that dashboard overview and usage summary endpoints avoid re-scanning the full `request_logs` table on every request. It is a read-path optimization only; public API response contracts remain unchanged.

## Key Decisions

- **Single rollup table** with composite PK `(bucket_hour, model, service_tier_key)` — `service_tier_key = coalesce(service_tier, '')` to handle NULLs in the unique constraint.
- **Watermark table** (`request_log_rollup_state`) with a singleton row tracking `rolled_through_hour` — readers check this to know which hours are safe to serve from rollups vs raw.
- **Split read path**: raw-head (partial leading hour) + rollup-middle (closed hours) + raw-tail (current in-progress hour). This ensures exact totals while avoiding redundant aggregation.
- **Scheduler interval**: 300s, hardcoded (not configurable). Uses existing leader-election patterns.
- **`replace_hour_rollup`** uses DELETE + INSERT (not upsert) for simplicity and to handle zero-traffic hours cleanly.
- **`topError` stays raw** in phase 1 because the rollup schema does not carry error-code breakdowns.

## Constraints

- All `bucket_hour` values are naive UTC (matching `utcnow()` convention).
- Rollups are authoritative only for fully closed hours strictly before the current hour.
- The scheduler must not interfere with the current in-progress hour.
- Migration must be idempotent under legacy Alembic auto-remap reruns.

## Failure Modes

- **Scheduler offline for extended period**: Readers fall back to raw `request_logs` for uncovered hours; no data loss. On recovery, the scheduler catches up all missed hours.
- **Stale watermark**: If the watermark lags significantly, more work falls to raw queries but results remain correct.
- **Migration rerun**: Idempotency guards skip table creation and backfill if already complete.

## Example

For a 7-day overview at `2026-05-03T09:37:00Z`:
- Raw head: `2026-04-26T00:00:00Z` (window start) to `2026-04-26T01:00:00Z` (next full hour)
- Rollup middle: `2026-04-26T01:00:00Z` to `2026-05-03T09:00:00Z` (closed hours from rollups)
- Raw tail: `2026-05-03T09:00:00Z` to now (current in-progress hour)
