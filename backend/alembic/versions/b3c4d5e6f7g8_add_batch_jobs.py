"""add batch_jobs table

Revision ID: b3c4d5e6f7g8
Revises: a2b3c4d5e6f7
Create Date: 2026-05-05

"""
import sqlalchemy as sa
from alembic import op

revision = "b3c4d5e6f7g8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "batch_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "profile_id",
            sa.String(36),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("profile_name", sa.String(200), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_jobs", sa.Integer(), nullable=False),
        sa.Column("completed_jobs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_jobs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("jobs_input", sa.Text(), nullable=False),
        sa.Column(
            "completed_job_indices", sa.Text(), nullable=False, server_default="[]"
        ),
        sa.Column("error_details", sa.Text(), nullable=True),
        sa.Column("total_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "total_prompt_tokens", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "total_completion_tokens",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_batch_jobs_user_id", "batch_jobs", ["user_id"])
    op.create_index("ix_batch_jobs_status", "batch_jobs", ["status"])
    op.create_index("ix_batch_jobs_created_at", "batch_jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_batch_jobs_created_at", "batch_jobs")
    op.drop_index("ix_batch_jobs_status", "batch_jobs")
    op.drop_index("ix_batch_jobs_user_id", "batch_jobs")
    op.drop_table("batch_jobs")
