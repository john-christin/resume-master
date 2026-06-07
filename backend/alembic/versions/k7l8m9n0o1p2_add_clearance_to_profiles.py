"""add clearance fields to profiles

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-06-07 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "k7l8m9n0o1p2"
down_revision = "j6k7l8m9n0o1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "profiles",
        sa.Column("check_clearance", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.add_column(
        "profiles",
        sa.Column("security_clearance", sa.String(50), nullable=True),
    )


def downgrade():
    op.drop_column("profiles", "security_clearance")
    op.drop_column("profiles", "check_clearance")
