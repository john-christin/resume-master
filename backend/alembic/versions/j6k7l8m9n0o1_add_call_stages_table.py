"""add call stages table

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-06-06 00:00:00.000000

"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "j6k7l8m9n0o1"
down_revision = "i5j6k7l8m9n0"
branch_labels = None
depends_on = None

_DEFAULT_STAGES = [
    ("phone_interview", "Phone Interview", 0),
    ("intro_interview", "Intro Interview", 1),
    ("hr_interview", "HR Interview", 2),
    ("technical_interview_1", "Technical Interview (1)", 3),
    ("technical_interview_2", "Technical Interview (2)", 4),
    ("final_interview", "Final Interview", 5),
]


def upgrade():
    call_stages = op.create_table(
        "call_stages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("value", sa.String(100), nullable=False, unique=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    now = datetime.utcnow()
    op.bulk_insert(
        call_stages,
        [
            {
                "id": str(uuid.uuid4()),
                "name": name,
                "value": value,
                "order": order,
                "created_at": now,
                "updated_at": now,
            }
            for value, name, order in _DEFAULT_STAGES
        ],
    )


def downgrade():
    op.drop_table("call_stages")
