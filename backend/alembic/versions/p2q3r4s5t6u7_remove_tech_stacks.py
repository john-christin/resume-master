"""remove tech stacks

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-07-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "p2q3r4s5t6u7"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Child tables first, then the tech_stacks table itself (FK order).
    op.drop_index("ix_applications_tech_stack_id", "applications")
    op.drop_column("applications", "tech_stack_name")
    op.drop_column("applications", "tech_stack_id")

    op.drop_index("ix_profiles_tech_stack_id", "profiles")
    op.drop_column("profiles", "tech_stack_id")

    op.drop_index("ix_knowledge_bases_tech_stack_id", "knowledge_bases")
    op.drop_column("knowledge_bases", "tech_stack_id")

    op.drop_index("ix_tech_stacks_is_active", "tech_stacks")
    op.drop_table("tech_stacks")


def downgrade() -> None:
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
