"""add knowledge_bases table

Revision ID: a1c8d5f72b34
Revises: f7b1d3e52a90
Create Date: 2026-04-15 00:00:02.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a1c8d5f72b34"
down_revision = "f7b1d3e52a90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "knowledge_bases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade():
    op.drop_table("knowledge_bases")
