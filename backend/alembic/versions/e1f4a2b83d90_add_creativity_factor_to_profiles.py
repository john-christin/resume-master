"""add creativity_factor to profiles

Revision ID: e1f4a2b83d90
Revises: c3a1f8d92b47
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1f4a2b83d90"
down_revision: Union[str, None] = "cf72c4e16a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "creativity_factor",
            sa.Float(),
            nullable=False,
            server_default="0.3",
        ),
    )
    # Remove server default after backfill so new rows use Python-level random()
    op.alter_column("profiles", "creativity_factor", server_default=None)


def downgrade() -> None:
    op.drop_column("profiles", "creativity_factor")
