"""add_chat_messages_table

Revision ID: 33220a2d9123
Revises: a1b2c3d4e5f6
Create Date: 2026-05-25 05:23:39.230609

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '33220a2d9123'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('application_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_chat_messages_application_id'),
        'chat_messages',
        ['application_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_chat_messages_application_id'), table_name='chat_messages')
    op.drop_table('chat_messages')
