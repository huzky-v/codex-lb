## ADDED Requirements

### Requirement: API key detail exposes 7-day routed-account cost breakdown

The system SHALL expose `GET /api/api-keys/{id}/account-usage-7d` for dashboard-authenticated API-key detail pages. The response MUST contain the selected API key's rolling 7-day routed-account cost breakdown derived from `request_logs`.

#### Scenario: Breakdown returns known accounts in descending cost order

- **WHEN** the selected API key has 7-day request logs for multiple existing accounts
- **THEN** the response includes one entry per routed account
- **AND** entries with non-null account ids are sorted by descending `totalCostUsd`
- **AND** each entry includes the routed account id, a human-readable display label, total request count, and total 7-day cost

#### Scenario: Detached soft-deleted request logs collapse into Deleted Account

- **WHEN** 7-day request logs for the selected API key still exist after the parent account was deleted
- **THEN** the response includes a trailing `Deleted Account` entry for that detached traffic
- **AND** that entry uses `accountId = null`
- **AND** it remains distinct from known-account entries even if multiple detached rows exist in storage

### Requirement: APIs tab shows account-cost donut beside usage trend

The APIs tab SHALL render a dashboard-style donut for the selected API key's routed-account cost breakdown beside the existing usage trend.

#### Scenario: APIs tab uses fixed detail layout and captions

- **WHEN** an API key detail page has both trend data and 7-day account breakdown data
- **THEN** the donut panel renders on the left and the trend panel renders on the right in a `25:75` large-screen split
- **AND** both panels show captions describing their 7-day scope
- **AND** the trend chart uses reduced right padding relative to the previous detail layout

#### Scenario: Donut center, legend, and privacy match dashboard behavior

- **WHEN** the APIs tab renders the account-cost donut
- **THEN** the donut center shows the selected API key's total 7-day cost
- **AND** the legend renders underneath the circle with at most 4 visible items before truncation/scrolling
- **AND** legend hover and slice hover stay linked using the same active-state behavior as the dashboard donut
- **AND** account labels that are email-derived respect the shared hide-account-info privacy mode

#### Scenario: Deleted-account slice remains last and neutral

- **WHEN** the account breakdown includes detached deleted-account traffic
- **THEN** the `Deleted Account` legend item and donut slice render after the sorted known accounts
- **AND** the deleted-account slice uses the same neutral fill treatment as the dashboard donut's `Used` segment
