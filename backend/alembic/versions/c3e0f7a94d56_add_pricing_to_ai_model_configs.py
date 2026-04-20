"""add pricing to ai_model_configs

Revision ID: c3e0f7a94d56
Revises: b2d9e6f83c45
Create Date: 2026-04-15 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c3e0f7a94d56"
down_revision = "b2d9e6f83c45"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "ai_model_configs",
        sa.Column("input_price_per_1k", sa.Float, nullable=False, server_default="0"),
    )
    op.add_column(
        "ai_model_configs",
        sa.Column("output_price_per_1k", sa.Float, nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("ai_model_configs", "output_price_per_1k")
    op.drop_column("ai_model_configs", "input_price_per_1k")
