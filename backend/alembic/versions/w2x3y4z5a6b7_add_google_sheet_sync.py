"""add google sheet sync (profile sheet url, applied flag, sync outbox)

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
Create Date: 2026-10-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("job_sheet_url", sa.String(500), nullable=True))
    op.add_column("queue_tasks", sa.Column("job_board", sa.String(100), nullable=True))
    op.add_column("queue_tasks", sa.Column("posted_text", sa.String(100), nullable=True))
    op.add_column(
        "applications",
        sa.Column("applied", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("applications", sa.Column("applied_at", sa.DateTime(), nullable=True))
    op.create_table(
        "sheet_sync_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id",
            sa.String(36),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("op", sa.String(20), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("done_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_sheet_sync_jobs_profile_id", "sheet_sync_jobs", ["profile_id"])
    op.create_index(
        "ix_sheet_sync_status_created", "sheet_sync_jobs", ["status", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_sheet_sync_status_created", table_name="sheet_sync_jobs")
    op.drop_index("ix_sheet_sync_jobs_profile_id", table_name="sheet_sync_jobs")
    op.drop_table("sheet_sync_jobs")
    op.drop_column("applications", "applied_at")
    op.drop_column("applications", "applied")
    op.drop_column("queue_tasks", "posted_text")
    op.drop_column("queue_tasks", "job_board")
    op.drop_column("profiles", "job_sheet_url")
