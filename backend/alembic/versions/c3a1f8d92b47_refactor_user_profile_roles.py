"""refactor user profile roles

Revision ID: c3a1f8d92b47
Revises: 297e9fb09086
Create Date: 2026-04-14 12:00:00.000000

"""

import uuid
from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3a1f8d92b47"
down_revision: Union[str, None] = "297e9fb09086"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Create new tables ---
    op.create_table(
        "profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "owner_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("linkedin", sa.String(500), nullable=True),
        sa.Column("summary", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime, default=datetime.utcnow),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "profile_shares",
        sa.Column(
            "profile_id",
            sa.String(36),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("shared_at", sa.DateTime, default=datetime.utcnow),
    )

    op.create_table(
        "token_pricing",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("input_price_per_1k", sa.Float, nullable=False, server_default="0"),
        sa.Column("output_price_per_1k", sa.Float, nullable=False, server_default="0"),
        sa.Column("effective_from", sa.DateTime),
        sa.Column(
            "created_by",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    # --- 2. Add new columns to users ---
    op.add_column("users", sa.Column("role", sa.String(20), server_default="bidder"))
    op.add_column("users", sa.Column("status", sa.String(20), server_default="pending"))
    op.add_column("users", sa.Column("approved_at", sa.DateTime, nullable=True))
    op.add_column("users", sa.Column("approved_by", sa.String(36), nullable=True))

    # --- 3. Add profile_id to educations and experiences ---
    op.add_column(
        "educations", sa.Column("profile_id", sa.String(36), nullable=True)
    )
    op.add_column(
        "experiences", sa.Column("profile_id", sa.String(36), nullable=True)
    )

    # --- 4. Add new columns to applications ---
    op.add_column(
        "applications", sa.Column("profile_id", sa.String(36), nullable=True)
    )
    op.add_column(
        "applications", sa.Column("profile_name", sa.String(200), nullable=True)
    )
    op.add_column(
        "applications",
        sa.Column("prompt_tokens", sa.Integer, server_default="0"),
    )
    op.add_column(
        "applications",
        sa.Column("completion_tokens", sa.Integer, server_default="0"),
    )
    op.add_column(
        "applications",
        sa.Column("total_cost", sa.Float, server_default="0"),
    )

    # --- 5. Data migration: move user profile data into profiles table ---
    conn = op.get_bind()

    # Set all existing users as approved bidders
    conn.execute(
        sa.text("UPDATE users SET role = 'bidder', status = 'approved'")
    )

    # For each user, create a profile and migrate educations/experiences
    users = conn.execute(
        sa.text("SELECT id, name, phone, linkedin, summary, email FROM users")
    ).fetchall()

    for user in users:
        profile_id = str(uuid.uuid4())
        user_id = user[0]
        name = user[1] or "Unnamed Profile"
        phone = user[2]
        linkedin = user[3]
        summary = user[4]
        email = user[5]

        # Create profile
        conn.execute(
            sa.text(
                "INSERT INTO profiles (id, owner_id, name, phone, email, linkedin, summary, created_at) "
                "VALUES (:id, :owner_id, :name, :phone, :email, :linkedin, :summary, :created_at)"
            ),
            {
                "id": profile_id,
                "owner_id": user_id,
                "name": name,
                "phone": phone,
                "email": email,
                "linkedin": linkedin,
                "summary": summary,
                "created_at": datetime.utcnow(),
            },
        )

        # Update educations to point to new profile
        conn.execute(
            sa.text(
                "UPDATE educations SET profile_id = :profile_id WHERE user_id = :user_id"
            ),
            {"profile_id": profile_id, "user_id": user_id},
        )

        # Update experiences to point to new profile
        conn.execute(
            sa.text(
                "UPDATE experiences SET profile_id = :profile_id WHERE user_id = :user_id"
            ),
            {"profile_id": profile_id, "user_id": user_id},
        )

        # Update applications to reference the profile
        conn.execute(
            sa.text(
                "UPDATE applications SET profile_id = :profile_id, profile_name = :name "
                "WHERE user_id = :user_id"
            ),
            {"profile_id": profile_id, "name": name, "user_id": user_id},
        )

    # --- 6. Now make profile_id NOT NULL on educations/experiences and add FK ---
    # First set any remaining NULLs (shouldn't be any, but safety)
    conn.execute(
        sa.text("DELETE FROM educations WHERE profile_id IS NULL")
    )
    conn.execute(
        sa.text("DELETE FROM experiences WHERE profile_id IS NULL")
    )

    # Make company nullable in applications
    op.alter_column(
        "applications",
        "company",
        existing_type=sa.String(300),
        nullable=True,
    )

    # Add FK constraints for profile_id
    op.create_foreign_key(
        "fk_educations_profile_id",
        "educations",
        "profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_experiences_profile_id",
        "experiences",
        "profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_applications_profile_id",
        "applications",
        "profiles",
        ["profile_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Make profile_id NOT NULL on educations/experiences
    op.alter_column(
        "educations",
        "profile_id",
        existing_type=sa.String(36),
        nullable=False,
    )
    op.alter_column(
        "experiences",
        "profile_id",
        existing_type=sa.String(36),
        nullable=False,
    )

    # --- 7. Drop old columns ---
    # Drop old FK constraints first
    op.drop_constraint("educations_ibfk_1", "educations", type_="foreignkey")
    op.drop_constraint("experiences_ibfk_1", "experiences", type_="foreignkey")

    op.drop_column("educations", "user_id")
    op.drop_column("experiences", "user_id")
    op.drop_column("users", "name")
    op.drop_column("users", "phone")
    op.drop_column("users", "linkedin")
    op.drop_column("users", "summary")


def downgrade() -> None:
    # Add back columns to users
    op.add_column("users", sa.Column("name", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("linkedin", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("summary", sa.String(2000), nullable=True))

    # Add back user_id to educations/experiences
    op.add_column("educations", sa.Column("user_id", sa.String(36), nullable=True))
    op.add_column("experiences", sa.Column("user_id", sa.String(36), nullable=True))

    # Reverse data migration would be complex; skip for safety
    # Drop new columns
    op.drop_column("applications", "total_cost")
    op.drop_column("applications", "completion_tokens")
    op.drop_column("applications", "prompt_tokens")
    op.drop_column("applications", "profile_name")
    op.drop_column("applications", "profile_id")
    op.drop_column("users", "approved_by")
    op.drop_column("users", "approved_at")
    op.drop_column("users", "status")
    op.drop_column("users", "role")

    op.drop_table("token_pricing")
    op.drop_table("profile_shares")
    op.drop_table("profiles")
