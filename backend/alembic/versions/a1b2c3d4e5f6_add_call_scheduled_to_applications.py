"""add call_scheduled to applications

Revision ID: a1b2c3d4e5f6
Revises: f7b1d3e52a90
Create Date: 2026-05-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "a7f3e1b92c08"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "applications",
        sa.Column("call_scheduled", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("applications", "call_scheduled")
