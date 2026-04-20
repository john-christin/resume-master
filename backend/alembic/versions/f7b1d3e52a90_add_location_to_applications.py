"""add location to applications

Revision ID: f7b1d3e52a90
Revises: e5a3c7d41f20
Create Date: 2026-04-15 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "f7b1d3e52a90"
down_revision = "e5a3c7d41f20"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("applications", sa.Column("location", sa.String(300), nullable=True))


def downgrade():
    op.drop_column("applications", "location")
