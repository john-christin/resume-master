"""add certifications table

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-10-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "u7v8w9x0y1z2"
down_revision = "t6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "certifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "profile_id",
            sa.String(36),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("issuer", sa.String(300), nullable=True),
        sa.Column("issue_date", sa.String(50), nullable=True),
        sa.Column("expiry_date", sa.String(50), nullable=True),
    )
    op.create_index("ix_certifications_profile_id", "certifications", ["profile_id"])


def downgrade() -> None:
    op.drop_index("ix_certifications_profile_id", table_name="certifications")
    op.drop_table("certifications")
