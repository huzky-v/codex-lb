from __future__ import annotations

from datetime import datetime, timedelta

from app.core import usage as usage_core
from app.core.usage.types import UsageWindowRow
from app.core.utils.time import utcnow
from app.modules.accounts.repository import AccountsRepository
from app.modules.request_logs.repository import RequestLogsRepository
from app.modules.usage.builders import (
    build_cost_summary_from_aggregates,
    build_metrics_from_aggregate,
    build_usage_history_response,
    build_usage_summary_response,
    build_usage_window_response,
)
from app.modules.usage.repository import UsageRepository
from app.modules.usage.schemas import (
    UsageHistoryResponse,
    UsageSummaryResponse,
    UsageWindowResponse,
)


def _floor_hour(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0)


def _ceil_hour(dt: datetime) -> datetime:
    floored = _floor_hour(dt)
    return floored if floored == dt else floored + timedelta(hours=1)


def _add_activity(a: object, b: object) -> object:
    from app.core.usage.types import RequestActivityAggregate

    if not isinstance(a, RequestActivityAggregate) or not isinstance(b, RequestActivityAggregate):
        return b or a
    if a.request_count == 0:
        return b
    if b.request_count == 0:
        return a
    return RequestActivityAggregate(
        request_count=a.request_count + b.request_count,
        error_count=a.error_count + b.error_count,
        input_tokens=a.input_tokens + b.input_tokens,
        output_tokens=a.output_tokens + b.output_tokens,
        cached_input_tokens=a.cached_input_tokens + b.cached_input_tokens,
        cost_usd=a.cost_usd + b.cost_usd,
    )


def _merge_cost_by_model(a: list[object], b: list[object]) -> list[object]:
    from app.core.usage.types import UsageCostByModel

    merged: dict[str, float] = {}
    for item in a:
        if isinstance(item, UsageCostByModel):
            merged[item.model] = merged.get(item.model, 0.0) + item.usd
    for item in b:
        if isinstance(item, UsageCostByModel):
            merged[item.model] = merged.get(item.model, 0.0) + item.usd
    return [UsageCostByModel(model=m, usd=round(c, 6)) for m, c in sorted(merged.items())]


class UsageService:
    def __init__(
        self,
        usage_repo: UsageRepository,
        logs_repo: RequestLogsRepository,
        accounts_repo: AccountsRepository,
    ) -> None:
        self._usage_repo = usage_repo
        self._logs_repo = logs_repo
        self._accounts_repo = accounts_repo

    async def get_usage_summary(self) -> UsageSummaryResponse:
        now = utcnow()
        accounts = await self._accounts_repo.list_accounts()

        primary_rows_raw = await self._latest_usage_rows("primary")
        secondary_rows_raw = await self._latest_usage_rows("secondary")
        primary_rows, secondary_rows = usage_core.normalize_weekly_only_rows(
            primary_rows_raw,
            secondary_rows_raw,
        )

        secondary_minutes = usage_core.resolve_window_minutes("secondary", secondary_rows)
        if not secondary_minutes:
            return build_usage_summary_response(
                accounts=accounts,
                primary_rows=primary_rows,
                secondary_rows=secondary_rows,
                logs_secondary=[],
            )

        since = now - timedelta(minutes=secondary_minutes)
        current_hour_start = _floor_hour(now)
        watermark = await self._logs_repo.get_rollup_watermark()
        has_rollups = watermark is not None and watermark > since

        if has_rollups and watermark is not None:
            next_hour_after_since = _ceil_hour(since)
            rollup_end = min(watermark, current_hour_start)
            if rollup_end <= next_hour_after_since:
                has_rollups = False

        if has_rollups and watermark is not None:
            raw_head_activity = await self._logs_repo.aggregate_activity_since(
                since,
                until=next_hour_after_since,
            )
            rollup_activity = await self._logs_repo.aggregate_rollup_activity(
                next_hour_after_since,
                rollup_end,
            )
            raw_tail_activity = await self._logs_repo.aggregate_activity_since(
                current_hour_start,
            )
            activity_aggregate = _add_activity(
                _add_activity(raw_head_activity, rollup_activity),
                raw_tail_activity,
            )

            raw_head_cost = await self._logs_repo.aggregate_cost_by_model(
                since,
                until=next_hour_after_since,
            )
            rollup_cost = await self._logs_repo.aggregate_rollup_cost_by_model(
                next_hour_after_since,
                rollup_end,
            )
            raw_tail_cost = await self._logs_repo.aggregate_cost_by_model(
                current_hour_start,
            )
            cost_by_model = _merge_cost_by_model(
                _merge_cost_by_model(raw_head_cost, rollup_cost),
                raw_tail_cost,
            )

            top_error = await self._logs_repo.top_error_since(since)

            cost = build_cost_summary_from_aggregates(cost_by_model)
            metrics = build_metrics_from_aggregate(activity_aggregate, top_error=top_error)
            return build_usage_summary_response(
                accounts=accounts,
                primary_rows=primary_rows,
                secondary_rows=secondary_rows,
                logs_secondary=[],
                metrics_override=metrics,
                cost_override=cost,
            )

        logs_secondary = await self._logs_repo.list_since(since)
        return build_usage_summary_response(
            accounts=accounts,
            primary_rows=primary_rows,
            secondary_rows=secondary_rows,
            logs_secondary=logs_secondary,
        )

    async def get_usage_history(self, hours: int) -> UsageHistoryResponse:
        now = utcnow()
        since = now - timedelta(hours=hours)
        accounts = await self._accounts_repo.list_accounts()
        usage_rows = [row.to_window_row() for row in await self._usage_repo.aggregate_since(since, window="primary")]

        return build_usage_history_response(
            hours=hours,
            usage_rows=usage_rows,
            accounts=accounts,
            window="primary",
        )

    async def get_usage_window(self, window: str) -> UsageWindowResponse:
        window_key = (window or "").lower()
        if window_key not in {"primary", "secondary"}:
            raise ValueError("window must be 'primary' or 'secondary'")
        accounts = await self._accounts_repo.list_accounts()
        primary_rows_raw = await self._latest_usage_rows("primary")
        secondary_rows_raw = await self._latest_usage_rows("secondary")
        primary_rows, secondary_rows = usage_core.normalize_weekly_only_rows(
            primary_rows_raw,
            secondary_rows_raw,
        )
        usage_rows = primary_rows if window_key == "primary" else secondary_rows
        window_minutes = usage_core.resolve_window_minutes(window_key, usage_rows)
        return build_usage_window_response(
            window_key=window_key,
            window_minutes=window_minutes,
            usage_rows=usage_rows,
            accounts=accounts,
        )

    async def _latest_usage_rows(self, window: str) -> list[UsageWindowRow]:
        latest = await self._usage_repo.latest_by_account(window=window)
        return [
            UsageWindowRow(
                account_id=entry.account_id,
                used_percent=entry.used_percent,
                reset_at=entry.reset_at,
                window_minutes=entry.window_minutes,
                recorded_at=entry.recorded_at,
            )
            for entry in latest.values()
        ]
