"""add request log hourly rollups

Revision ID: 20260503_000000_add_request_log_hourly_rollups
Revises: 20260424_000000_merge_dashboard_session_ttl_and_request_log_heads
Create Date: 2026-05-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Connection

revision = "20260503_000000_add_request_log_hourly_rollups"
down_revision = "20260424_000000_merge_dashboard_session_ttl_and_request_log_heads"
branch_labels = None
depends_on = None


def _columns(connection: Connection, table_name: str) -> set[str]:
    inspector = sa.inspect(connection)
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _backfill_hourly_rollups(bind: Connection) -> None:
    rs = sa.table(
        "request_log_rollup_state",
        sa.column("id", sa.Integer()),
    )
    existing = bind.execute(sa.select(rs.c.id).where(rs.c.id == 1)).scalar()
    if existing is not None:
        return

    rl = sa.table(
        "request_logs",
        sa.column("requested_at", sa.DateTime()),
        sa.column("model", sa.String()),
        sa.column("service_tier", sa.String()),
        sa.column("status", sa.String()),
        sa.column("input_tokens", sa.Integer()),
        sa.column("output_tokens", sa.Integer()),
        sa.column("cached_input_tokens", sa.Integer()),
        sa.column("reasoning_tokens", sa.Integer()),
        sa.column("cost_usd", sa.Float()),
    )

    dialect = bind.dialect.name

    if dialect == "sqlite":
        current_hour_start = bind.execute(
            sa.select(
                sa.func.datetime(
                    (sa.cast(sa.func.strftime("%s", sa.func.now()), sa.Integer()) / 3600) * 3600,
                    "unixepoch",
                )
            )
        ).scalar()
    else:
        current_hour_start = bind.execute(
            sa.select(sa.func.date_trunc("hour", sa.func.now()))
        ).scalar()

    min_row = bind.execute(sa.select(sa.func.min(rl.c.requested_at))).scalar()
    if min_row is None:
        now_expr = "datetime('now')" if dialect == "sqlite" else "NOW()"
        bind.execute(
            sa.text(
                f"""
                INSERT INTO request_log_rollup_state (id, rolled_through_hour, updated_at)
                VALUES (1, :cutoff, {now_expr})
                """
            ),
            {"cutoff": current_hour_start},
        )
        return

    _ROLLUP_SELECT_SQL = """
        SELECT
            {hour_expr},
            model,
            COALESCE(service_tier, ''),
            service_tier,
            COUNT(*),
            COALESCE(SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(input_tokens), 0),
            COALESCE(SUM(output_tokens), 0),
            COALESCE(SUM(cached_input_tokens), 0),
            COALESCE(SUM(reasoning_tokens), 0),
            COALESCE(SUM(cost_usd), 0.0)
        FROM request_logs
        WHERE requested_at < :cutoff
        GROUP BY {hour_expr}, model, COALESCE(service_tier, '')
        """

    if dialect == "sqlite":
        hour_expr = "datetime((strftime('%s', requested_at) / 3600) * 3600, 'unixepoch')"
    else:
        hour_expr = "date_trunc('hour', requested_at)"

    bind.execute(
        sa.text(
            "INSERT INTO request_log_hourly_rollups ("
            "  bucket_hour, model, service_tier_key, service_tier,"
            "  request_count, error_count,"
            "  input_tokens, output_tokens, cached_input_tokens, reasoning_tokens,"
            "  cost_usd"
            f") {_ROLLUP_SELECT_SQL.format(hour_expr=hour_expr)}"
        ),
        {"cutoff": current_hour_start},
    )

    now_expr = "datetime('now')" if dialect == "sqlite" else "NOW()"
    bind.execute(
        sa.text(
            f"""
            INSERT INTO request_log_rollup_state (id, rolled_through_hour, updated_at)
            VALUES (1, :cutoff, {now_expr})
            ON CONFLICT (id) DO UPDATE SET rolled_through_hour = :cutoff, updated_at = {now_expr}
            """
        ),
        {"cutoff": current_hour_start},
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("request_log_hourly_rollups"):
        op.create_table(
            "request_log_hourly_rollups",
            sa.Column("bucket_hour", sa.DateTime(), nullable=False),
            sa.Column("model", sa.String(), nullable=False),
            sa.Column("service_tier_key", sa.String(), nullable=False),
            sa.Column("service_tier", sa.String(), nullable=True),
            sa.Column("request_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("error_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("input_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("output_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("cached_input_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("reasoning_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("cost_usd", sa.Float(), nullable=False, server_default=sa.text("0.0")),
            sa.PrimaryKeyConstraint("bucket_hour", "model", "service_tier_key"),
        )
        op.create_index(
            "idx_hourly_rollup_bucket_hour",
            "request_log_hourly_rollups",
            ["bucket_hour"],
        )

    if not inspector.has_table("request_log_rollup_state"):
        op.create_table(
            "request_log_rollup_state",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("rolled_through_hour", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    if _columns(bind, "request_logs"):
        _backfill_hourly_rollups(bind)


def downgrade() -> None:
    op.drop_table("request_log_rollup_state")
    op.drop_index("idx_hourly_rollup_bucket_hour", table_name="request_log_hourly_rollups")
    op.drop_table("request_log_hourly_rollups")
