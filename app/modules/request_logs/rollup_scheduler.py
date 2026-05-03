from __future__ import annotations

import asyncio
import contextlib
import importlib
import logging
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Protocol, cast

from app.core.utils.time import utcnow
from app.db.session import get_background_session
from app.modules.request_logs.repository import RequestLogsRepository

logger = logging.getLogger(__name__)

_ROLLUP_INTERVAL_SECONDS = 300


def _floor_hour(dt: object) -> object:
    from datetime import datetime

    if isinstance(dt, datetime):
        return dt.replace(minute=0, second=0, microsecond=0)
    return dt


class _LeaderElectionLike(Protocol):
    async def try_acquire(self) -> bool: ...


def _get_leader_election() -> _LeaderElectionLike:
    module = importlib.import_module("app.core.scheduling.leader_election")
    return cast(_LeaderElectionLike, module.get_leader_election())


@dataclass(slots=True)
class RequestLogRollupScheduler:
    interval_seconds: int
    enabled: bool
    _task: asyncio.Task[None] | None = None
    _stop: asyncio.Event = field(default_factory=asyncio.Event)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def start(self) -> None:
        if not self.enabled:
            return
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if not self._task:
            return
        self._stop.set()
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            await self._rollup_once()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def _rollup_once(self) -> None:
        if not await _get_leader_election().try_acquire():
            return
        async with self._lock:
            try:
                async with get_background_session() as session:
                    repo = RequestLogsRepository(session)
                    current_hour_start = _floor_hour(utcnow())
                    watermark = await repo.get_rollup_watermark()
                    if watermark is None:
                        return
                    cursor = watermark
                    finalized = 0
                    while cursor < current_hour_start:
                        await repo.replace_hour_rollup(cursor)
                        cursor = cursor + timedelta(hours=1)
                        await repo.advance_rollup_watermark(cursor)
                        finalized += 1
                    if finalized > 0:
                        await session.commit()
                        logger.info(
                            "Finalized request-log hourly rollups count=%s through=%s",
                            finalized,
                            cursor.isoformat(),
                        )
            except Exception:
                logger.exception("Request log rollup loop failed")


def build_request_log_rollup_scheduler() -> RequestLogRollupScheduler:
    return RequestLogRollupScheduler(
        interval_seconds=_ROLLUP_INTERVAL_SECONDS,
        enabled=True,
    )
