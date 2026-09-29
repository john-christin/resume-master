"""add use_global_kb to profiles

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-09-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "t6u7v8w9x0y1"
down_revision = "s5t6u7v8w9x0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "use_global_kb",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "use_global_kb")
