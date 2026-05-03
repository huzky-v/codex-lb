## MODIFIED Requirements

### Requirement: Dashboard and usage summary aggregates reuse closed-hour request-log rollups
Dashboard overview and usage summary aggregate reads MUST preserve their existing response contracts while preferring precomputed hourly request-log rollups for hours that are fully closed and marked complete in the rollup watermark.

#### Scenario: Mixed raw and rollup window stays exact
- **GIVEN** a requested window spans a partial leading hour, one or more fully closed hours, and the current in-progress hour
- **WHEN** dashboard overview trends or usage summary metrics/cost are computed
- **THEN** the system combines raw `request_logs` for uncovered edge ranges with hourly rollups for the covered middle range
- **AND** the returned totals match the authoritative raw-log totals for that same window

#### Scenario: Uncovered closed hours fall back to raw logs
- **GIVEN** the rollup watermark does not cover part of the requested closed-hour range
- **WHEN** an aggregate read executes
- **THEN** the system reads uncovered hours from raw `request_logs`
- **AND** it does not read stale or partial rollup rows

### Requirement: Current-hour traffic never uses rollups
Hourly request-log rollups MUST only cover fully closed hours. The current in-progress hour MUST always be served from raw `request_logs`.

#### Scenario: Current hour remains raw
- **WHEN** aggregate reads include the current in-progress hour
- **THEN** that hour is served from raw `request_logs`
- **AND** the rollup scheduler does not mark that hour complete

### Requirement: Rollup scheduler finalizes closed hours in the background
A leader-elected background scheduler MUST periodically finalize newly closed hours by aggregating raw `request_logs` into the hourly rollup table and advancing the rollup watermark. The scheduler MUST NOT interfere with the current in-progress hour.

#### Scenario: Scheduler catches up after downtime
- **GIVEN** the scheduler has been offline for several hours
- **WHEN** it resumes and acquires leadership
- **THEN** it backfills all missed closed hours between the current watermark and the current hour boundary
- **AND** the watermark advances to the most recently closed hour

### Requirement: Top error continues reading raw logs
The `topError` field MUST continue to be computed from raw `request_logs` because the hourly rollup schema does not carry error-code breakdowns in phase 1.

#### Scenario: Top error ignores rollup table
- **WHEN** dashboard overview computes the top error for the selected timeframe
- **THEN** it queries raw `request_logs` for the full window regardless of rollup coverage
