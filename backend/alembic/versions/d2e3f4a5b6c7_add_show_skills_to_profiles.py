"""add show_skills to profiles

Revision ID: d2e3f4a5b6c7
Revises: b7d8e9f0a1b2
Create Date: 2026-06-03 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "d2e3f4a5b6c7"
down_revision = "b7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "profiles",
        sa.Column(
            "show_skills",
            sa.Boolean,
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade():
    op.drop_column("profiles", "show_skills")
