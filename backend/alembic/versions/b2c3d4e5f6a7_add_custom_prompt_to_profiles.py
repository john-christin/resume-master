"""add custom_prompt to profiles

Revision ID: a1b2c3d4e5f6
Revises: 33220a2d9123
Create Date: 2026-05-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = '33220a2d9123'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('profiles', sa.Column('custom_prompt', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('profiles', 'custom_prompt')
