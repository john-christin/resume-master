"""add stage_statuses to calls

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-06-05 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("calls", sa.Column("stage_statuses", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("calls", "stage_statuses")
