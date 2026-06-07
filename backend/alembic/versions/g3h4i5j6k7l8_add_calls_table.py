"""add calls table

Revision ID: g3h4i5j6k7l8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "g3h4i5j6k7l8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "calls",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stage", sa.String(60), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("recording_link", sa.Text(), nullable=True),
        sa.Column("with_whom", sa.String(200), nullable=True),
        sa.Column("interviewer_role", sa.String(200), nullable=True),
        sa.Column("call_type", sa.String(20), nullable=True),
        sa.Column("call_link", sa.Text(), nullable=True),
        sa.Column("additional_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("application_id", name="uq_calls_application_id"),
    )
    op.create_index("ix_calls_application_id", "calls", ["application_id"])
    op.create_index("ix_calls_stage", "calls", ["stage"])


def downgrade():
    op.drop_index("ix_calls_stage", table_name="calls")
    op.drop_index("ix_calls_application_id", table_name="calls")
    op.drop_table("calls")
