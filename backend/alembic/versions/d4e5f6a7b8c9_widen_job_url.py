"""widen job_url to text

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('applications', 'job_url', type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column('applications', 'job_url', type_=sa.String(1000), existing_nullable=True)
