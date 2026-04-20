"""rename email to username on users table

Revision ID: d4b2e9f13c58
Revises: c3a1f8d92b47
Create Date: 2026-04-14 18:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4b2e9f13c58"
down_revision = "c3a1f8d92b47"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename column email -> username
    op.alter_column(
        "users",
        "email",
        new_column_name="username",
        existing_type=sa.String(200),
        type_=sa.String(100),
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "username",
        new_column_name="email",
        existing_type=sa.String(100),
        type_=sa.String(200),
    )
