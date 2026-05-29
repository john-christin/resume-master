"""add salary_range and required_skills to applications

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('applications', sa.Column('salary_range', sa.String(200), nullable=True))
    op.add_column('applications', sa.Column('required_skills', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('applications', 'required_skills')
    op.drop_column('applications', 'salary_range')
