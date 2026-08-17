"""add microsoft foundry byok fields to profiles

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-07-19 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("foundry_endpoint", sa.String(500), nullable=True))
    op.add_column("profiles", sa.Column("foundry_api_key", sa.Text, nullable=True))
    op.add_column("profiles", sa.Column("foundry_model_id", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "foundry_model_id")
    op.drop_column("profiles", "foundry_api_key")
    op.drop_column("profiles", "foundry_endpoint")
