"""widen salary_range from varchar(200) to text

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'y4z5a6b7c8d9'
down_revision = 'x3y4z5a6b7c8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('applications', 'salary_range',
                    existing_type=sa.String(200),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    op.alter_column('applications', 'salary_range',
                    existing_type=sa.Text(),
                    type_=sa.String(200),
                    existing_nullable=True)
