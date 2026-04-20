"""add ai_model_configs table

Revision ID: b2d9e6f83c45
Revises: a1c8d5f72b34
Create Date: 2026-04-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b2d9e6f83c45"
down_revision = "a1c8d5f72b34"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_model_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("api_key", sa.Text, nullable=False),
        sa.Column("endpoint", sa.String(500), nullable=True),
        sa.Column("api_version", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade():
    op.drop_table("ai_model_configs")
