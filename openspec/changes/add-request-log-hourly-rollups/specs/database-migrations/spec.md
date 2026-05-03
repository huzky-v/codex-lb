## MODIFIED Requirements

### Requirement: Derived request-log rollup schema upgrades safely
When introducing request-log hourly rollup tables, the migration MUST backfill only fully closed historical hours and MUST seed rollup state so post-upgrade readers know which hours are safe to serve from rollups.

#### Scenario: Empty database seeds rollup state
- **GIVEN** the database has no `request_logs` rows
- **WHEN** the rollup migration runs
- **THEN** it creates the rollup tables
- **AND** it seeds the rollup watermark to the current hour without failing on the empty dataset

#### Scenario: Existing request logs are backfilled into rollups
- **GIVEN** the database has `request_logs` rows spanning multiple historical hours
- **WHEN** the rollup migration runs
- **THEN** it aggregates all fully closed historical hours into `request_log_hourly_rollups`
- **AND** it sets the watermark to the current hour boundary

#### Scenario: Legacy remap rerun does not duplicate rollup state
- **GIVEN** a legacy Alembic revision remap causes upgrade logic to revisit the rollup migration path
- **WHEN** the upgrade runs again
- **THEN** existing rollup tables and state do not cause duplicate-key or already-exists failures
- **AND** the resulting schema still matches ORM metadata
