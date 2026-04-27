"""add ip_address to system_logs

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "system_logs",
        sa.Column("ip_address", sa.String(45), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("system_logs", "ip_address")
