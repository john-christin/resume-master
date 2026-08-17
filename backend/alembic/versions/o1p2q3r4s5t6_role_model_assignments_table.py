"""role_model_assignments table, drop role/is_active from ai_model_configs

Revision ID: o1p2q3r4s5t6
Revises: n0o1p2q3r4s5
Create Date: 2026-07-13 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "o1p2q3r4s5t6"
down_revision = "n0o1p2q3r4s5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "role_model_assignments",
        sa.Column("role", sa.String(20), primary_key=True),
        sa.Column(
            "ai_model_config_id",
            sa.String(36),
            sa.ForeignKey("ai_model_configs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.execute("""
        INSERT INTO role_model_assignments (role, ai_model_config_id, updated_at)
        SELECT role, id, CURRENT_TIMESTAMP
        FROM ai_model_configs
        WHERE is_active = true AND role IS NOT NULL
    """)

    op.drop_index("ix_ai_model_configs_active_role", table_name="ai_model_configs")
    op.drop_column("ai_model_configs", "role")
    op.drop_column("ai_model_configs", "is_active")


def downgrade():
    op.add_column(
        "ai_model_configs",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "ai_model_configs", sa.Column("role", sa.String(20), nullable=True)
    )
    op.create_index(
        "ix_ai_model_configs_active_role", "ai_model_configs", ["is_active", "role"]
    )

    # Portable correlated-subquery form (avoids Postgres-only DISTINCT ON) —
    # a model referenced by multiple roles just takes one arbitrarily here,
    # since downgrade is a best-effort escape hatch, not a supported state.
    op.execute("""
        UPDATE ai_model_configs
        SET is_active = true,
            role = (
                SELECT rma.role FROM role_model_assignments rma
                WHERE rma.ai_model_config_id = ai_model_configs.id
                ORDER BY rma.role
                LIMIT 1
            )
        WHERE id IN (SELECT ai_model_config_id FROM role_model_assignments)
    """)

    op.drop_table("role_model_assignments")
