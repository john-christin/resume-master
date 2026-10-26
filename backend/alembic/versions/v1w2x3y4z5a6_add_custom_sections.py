"""add custom_sections to profiles

Revision ID: v1w2x3y4z5a6
Revises: u7v8w9x0y1z2
Create Date: 2026-10-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1w2x3y4z5a6"
down_revision = "u7v8w9x0y1z2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "custom_sections",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "custom_sections")
