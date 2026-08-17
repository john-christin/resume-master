"""add ai_usage_events table, rename primary role to resume, drop dead system_settings

Revision ID: n0o1p2q3r4s5
Revises: m9n0o1p2q3r4
Create Date: 2026-07-13 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "n0o1p2q3r4s5"
down_revision = "m9n0o1p2q3r4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_usage_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("part", sa.String(50), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column(
            "ai_model_config_id",
            sa.String(36),
            sa.ForeignKey("ai_model_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_price_per_1k", sa.Float(), nullable=False, server_default="0"),
        sa.Column("output_price_per_1k", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_ai_usage_events_application_id", "ai_usage_events", ["application_id"]
    )
    op.create_index("ix_ai_usage_events_user_id", "ai_usage_events", ["user_id"])
    op.create_index("ix_ai_usage_events_created_at", "ai_usage_events", ["created_at"])
    op.create_index(
        "ix_ai_usage_events_role_created", "ai_usage_events", ["role", "created_at"]
    )

    # "primary" role is renamed to "resume" — same model, clearer name
    op.execute("UPDATE ai_model_configs SET role = 'resume' WHERE role = 'primary'")

    # system_settings only ever stored default_chat_model_id /
    # default_resume_model_id, and nothing in the backend ever read them —
    # dead feature, superseded by per-role AIModelConfig activation.
    op.drop_table("system_settings")


def downgrade():
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.execute("UPDATE ai_model_configs SET role = 'primary' WHERE role = 'resume'")
    op.drop_index("ix_ai_usage_events_role_created", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_created_at", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_user_id", table_name="ai_usage_events")
    op.drop_index("ix_ai_usage_events_application_id", table_name="ai_usage_events")
    op.drop_table("ai_usage_events")
