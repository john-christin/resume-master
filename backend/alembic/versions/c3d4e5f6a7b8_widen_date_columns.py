"""widen start_date/end_date columns to varchar(50)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('experiences', 'start_date', type_=sa.String(50), existing_nullable=False)
    op.alter_column('experiences', 'end_date', type_=sa.String(50), existing_nullable=True)
    op.alter_column('educations', 'start_date', type_=sa.String(50), existing_nullable=False)
    op.alter_column('educations', 'end_date', type_=sa.String(50), existing_nullable=True)


def downgrade() -> None:
    op.alter_column('experiences', 'start_date', type_=sa.String(10), existing_nullable=False)
    op.alter_column('experiences', 'end_date', type_=sa.String(10), existing_nullable=True)
    op.alter_column('educations', 'start_date', type_=sa.String(10), existing_nullable=False)
    op.alter_column('educations', 'end_date', type_=sa.String(10), existing_nullable=True)
