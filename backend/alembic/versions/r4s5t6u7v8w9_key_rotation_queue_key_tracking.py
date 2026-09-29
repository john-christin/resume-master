"""key rotation index, queue key tracking, drop foundry fields

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-09-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "r4s5t6u7v8w9"
down_revision = "1d6d57d01fe7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Round-robin index on model configs
    op.add_column(
        "ai_model_configs",
        sa.Column("key_rotation_index", sa.BigInteger, nullable=False, server_default="0"),
    )

    # Track which pool key was used for each queue task
    op.add_column(
        "queue_tasks",
        sa.Column(
            "used_api_key_pool_id",
            sa.String(36),
            sa.ForeignKey("api_key_pool.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "queue_tasks",
        sa.Column("used_key_label", sa.String(100), nullable=True),
    )

    # Remove per-profile Foundry BYOK fields
    op.drop_column("profiles", "foundry_model_id")
    op.drop_column("profiles", "foundry_api_key")
    op.drop_column("profiles", "foundry_endpoint")


def downgrade() -> None:
    op.add_column("profiles", sa.Column("foundry_endpoint", sa.String(500), nullable=True))
    op.add_column("profiles", sa.Column("foundry_api_key", sa.Text, nullable=True))
    op.add_column("profiles", sa.Column("foundry_model_id", sa.String(200), nullable=True))

    op.drop_column("queue_tasks", "used_key_label")
    op.drop_column("queue_tasks", "used_api_key_pool_id")
    op.drop_column("ai_model_configs", "key_rotation_index")
