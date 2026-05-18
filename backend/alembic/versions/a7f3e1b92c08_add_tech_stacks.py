"""add tech stacks

Revision ID: a7f3e1b92c08
Revises: f7b1d3e52a90
Create Date: 2026-05-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "a7f3e1b92c08"
down_revision = "b3c4d5e6f7g8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tech_stacks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_tech_stacks_is_active", "tech_stacks", ["is_active"])

    op.add_column(
        "knowledge_bases",
        sa.Column("tech_stack_id", sa.String(36), sa.ForeignKey("tech_stacks.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_knowledge_bases_tech_stack_id", "knowledge_bases", ["tech_stack_id"])

    op.add_column(
        "profiles",
        sa.Column("tech_stack_id", sa.String(36), sa.ForeignKey("tech_stacks.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_profiles_tech_stack_id", "profiles", ["tech_stack_id"])

    op.add_column(
        "applications",
        sa.Column("tech_stack_id", sa.String(36), sa.ForeignKey("tech_stacks.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("tech_stack_name", sa.String(200), nullable=True),
    )
    op.create_index("ix_applications_tech_stack_id", "applications", ["tech_stack_id"])


def downgrade() -> None:
    op.drop_index("ix_applications_tech_stack_id", "applications")
    op.drop_column("applications", "tech_stack_name")
    op.drop_column("applications", "tech_stack_id")

    op.drop_index("ix_profiles_tech_stack_id", "profiles")
    op.drop_column("profiles", "tech_stack_id")

    op.drop_index("ix_knowledge_bases_tech_stack_id", "knowledge_bases")
    op.drop_column("knowledge_bases", "tech_stack_id")

    op.drop_index("ix_tech_stacks_is_active", "tech_stacks")
    op.drop_table("tech_stacks")
