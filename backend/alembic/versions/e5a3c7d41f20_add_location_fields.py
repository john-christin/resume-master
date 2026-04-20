"""add location fields to profiles and experiences

Revision ID: e5a3c7d41f20
Revises: d4b2e9f13c58
Create Date: 2026-04-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "e5a3c7d41f20"
down_revision = "d4b2e9f13c58"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("profiles", sa.Column("location", sa.String(200), nullable=True))
    op.add_column("experiences", sa.Column("location", sa.String(200), nullable=True))


def downgrade():
    op.drop_column("experiences", "location")
    op.drop_column("profiles", "location")
