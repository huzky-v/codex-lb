"""widen request_logs api key time index

Revision ID: 20260517_000000_widen_request_logs_api_key_time_index
Revises: 20260515_000000_soft_delete_request_logs_on_account_delete
Create Date: 2026-05-17 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260517_000000_widen_request_logs_api_key_time_index"
down_revision = "20260515_000000_soft_delete_request_logs_on_account_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("request_logs")}
    if "idx_logs_api_key_time" in existing_indexes:
        op.drop_index("idx_logs_api_key_time", table_name="request_logs")
    op.create_index(
        "idx_logs_api_key_time",
        "request_logs",
        [
            "api_key_id",
            sa.text("requested_at DESC"),
            "account_id",
            "deleted_at",
            sa.text("id DESC"),
        ],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("request_logs")}
    if "idx_logs_api_key_time" in existing_indexes:
        op.drop_index("idx_logs_api_key_time", table_name="request_logs")
    op.create_index(
        "idx_logs_api_key_time",
        "request_logs",
        [
            "api_key_id",
            sa.text("requested_at DESC"),
            sa.text("id DESC"),
        ],
        unique=False,
    )
