"""add doc styles

Revision ID: b7d8e9f0a1b2
Revises: e5f6a7b8c9d0
Create Date: 2026-06-02 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "b7d8e9f0a1b2"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "doc_styles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("config", sa.Text, nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "doc_style_id",
            sa.String(36),
            sa.ForeignKey("doc_styles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("profiles", "doc_style_id")
    op.drop_table("doc_styles")
