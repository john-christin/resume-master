"""add is_closed to calls

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-06-05 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "i5j6k7l8m9n0"
down_revision = "h4i5j6k7l8m9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "calls",
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("calls", "is_closed")
