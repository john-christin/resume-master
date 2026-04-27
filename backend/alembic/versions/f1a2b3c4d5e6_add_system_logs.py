"""add system_logs table

Revision ID: f1a2b3c4d5e6
Revises: e1f4a2b83d90
Create Date: 2026-04-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "e1f4a2b83d90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("endpoint", sa.String(200), nullable=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("error_type", sa.String(100), nullable=True),
        sa.Column("stack_trace", sa.Text, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_system_logs_level", "system_logs", ["level"])
    op.create_index("ix_system_logs_category", "system_logs", ["category"])
    op.create_index("ix_system_logs_user_id", "system_logs", ["user_id"])
    op.create_index("ix_system_logs_created_at", "system_logs", ["created_at"])


def downgrade():
    op.drop_index("ix_system_logs_created_at", "system_logs")
    op.drop_index("ix_system_logs_user_id", "system_logs")
    op.drop_index("ix_system_logs_category", "system_logs")
    op.drop_index("ix_system_logs_level", "system_logs")
    op.drop_table("system_logs")
