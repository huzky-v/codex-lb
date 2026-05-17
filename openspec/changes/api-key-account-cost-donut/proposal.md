## Why

The APIs tab shows a selected API key's 7-day totals and trend, but it does not show which routed accounts consumed that cost. Operators currently have to infer account skew from request logs, and the existing detail panel layout leaves no visual breakdown beside the trend.

## What Changes

- Add an API-key detail backend endpoint that returns a 7-day account cost breakdown for the selected API key.
- Render a dashboard-style donut on the APIs tab beside the existing usage trend.
- Show known routed accounts ordered by descending 7-day cost, collapse detached soft-deleted traffic into a trailing `Deleted Account` bucket, and hide blurred account labels when privacy mode is enabled.
- Add an index for the account-breakdown query path so the 7-day API-key aggregation does not degenerate into a full `request_logs` table scan.

## Impact

- Affected specs: `api-keys`
- Affected code:
  - `app/modules/api_keys/*`
  - `app/db/models.py`
  - `app/db/migrate.py`
  - `app/db/alembic/versions/*`
  - `frontend/src/features/apis/*`
  - targeted API-key trend/detail tests
