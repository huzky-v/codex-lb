## Overview

Add a new selected-key detail endpoint, `GET /api/api-keys/{key_id}/account-usage-7d`, backed by `request_logs` over the last 7 days for that API key. The response feeds a new APIs-tab donut panel that matches the existing dashboard donut style while preserving the current trend chart.

## Backend

- Query `request_logs` scoped by `api_key_id` and the rolling 7-day window.
- Left join `accounts` so rows whose parent account was soft-deleted still remain visible.
- Group by `request_logs.account_id`, `request_logs.deleted_at`, and the joined account email label.
- Service shaping sorts known accounts by descending `total_cost_usd`, then appends any detached/deleted bucket last as `Deleted Account`.
- Add an index led by `api_key_id` and `requested_at` so the database can narrow to the selected key and recent window before aggregating by account.

## Frontend

- Keep the detail panel trend and donut in a `75:25` large-screen split with the donut on the left and the trend on the right.
- The trend panel keeps the accumulated toggle, moves the Tokens/Cost legend below that toggle, and reduces chart right padding from `48` to `8`.
- The donut uses the same chart behavior and active-state style as the dashboard donut, but centers the selected API key's 7-day cost and places the legend underneath the circle.
- The legend shows at most 4 items, each row using the account display label plus 7-day total cost.
- Privacy mode blurs email-derived legend labels in the same way as other account surfaces.
- The deleted-account slice uses the same neutral color as the dashboard donut's `Used` segment and always renders after sorted known accounts.

## Verification

- Backend integration coverage for 404s, sorting, deleted-account bucketing, and 7-day window bounds.
- Frontend component coverage for layout copy, privacy blur, legend cap, and distinct null-account slice identities.
- Migration/drift coverage for the new `request_logs` read index.
