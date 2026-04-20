"""add_role_to_ai_model_configs

Revision ID: d2069d4e17d5
Revises: c3e0f7a94d56
Create Date: 2026-04-17 03:01:50.723428

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd2069d4e17d5'
down_revision: Union[str, None] = 'c3e0f7a94d56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ai_model_configs', sa.Column('role', sa.String(length=20), nullable=True))
    # Migrate: set role='primary' on the currently active model
    op.execute("UPDATE ai_model_configs SET role = 'primary' WHERE is_active = 1")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('ai_model_configs', 'role')
