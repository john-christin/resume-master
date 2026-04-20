"""add_database_indexes

Revision ID: cf72c4e16a11
Revises: d2069d4e17d5
Create Date: 2026-04-17 12:45:57.200034

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cf72c4e16a11'
down_revision: Union[str, None] = 'd2069d4e17d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add indexes for frequently queried columns."""
    # Users: filter by role and status (admin dashboard, auth)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_index(op.f('ix_users_status'), 'users', ['status'], unique=False)

    # Profiles: lookup by owner
    op.create_index(op.f('ix_profiles_owner_id'), 'profiles', ['owner_id'], unique=False)

    # Profile shares: lookup shared profiles for a user
    op.create_index(op.f('ix_profile_shares_user_id'), 'profile_shares', ['user_id'], unique=False)

    # Applications: FK lookups, search, sorting, duplicate detection
    op.create_index(op.f('ix_applications_user_id'), 'applications', ['user_id'], unique=False)
    op.create_index(op.f('ix_applications_profile_id'), 'applications', ['profile_id'], unique=False)
    op.create_index(op.f('ix_applications_company'), 'applications', ['company'], unique=False)
    op.create_index(op.f('ix_applications_created_at'), 'applications', ['created_at'], unique=False)
    op.create_index('ix_applications_user_profile', 'applications', ['user_id', 'profile_id'], unique=False)
    op.create_index('ix_applications_profile_company', 'applications', ['profile_id', 'company'], unique=False)

    # Educations / Experiences: FK lookup by profile
    op.create_index(op.f('ix_educations_profile_id'), 'educations', ['profile_id'], unique=False)
    op.create_index(op.f('ix_experiences_profile_id'), 'experiences', ['profile_id'], unique=False)

    # AI model configs: find active model by role
    op.create_index('ix_ai_model_configs_active_role', 'ai_model_configs', ['is_active', 'role'], unique=False)

    # Knowledge bases: filter active
    op.create_index(op.f('ix_knowledge_bases_is_active'), 'knowledge_bases', ['is_active'], unique=False)

    # Token pricing: order by effective date
    op.create_index(op.f('ix_token_pricing_effective_from'), 'token_pricing', ['effective_from'], unique=False)


def downgrade() -> None:
    """Remove all added indexes."""
    op.drop_index(op.f('ix_token_pricing_effective_from'), table_name='token_pricing')
    op.drop_index(op.f('ix_knowledge_bases_is_active'), table_name='knowledge_bases')
    op.drop_index('ix_ai_model_configs_active_role', table_name='ai_model_configs')
    op.drop_index(op.f('ix_experiences_profile_id'), table_name='experiences')
    op.drop_index(op.f('ix_educations_profile_id'), table_name='educations')
    op.drop_index('ix_applications_profile_company', table_name='applications')
    op.drop_index('ix_applications_user_profile', table_name='applications')
    op.drop_index(op.f('ix_applications_created_at'), table_name='applications')
    op.drop_index(op.f('ix_applications_company'), table_name='applications')
    op.drop_index(op.f('ix_applications_profile_id'), table_name='applications')
    op.drop_index(op.f('ix_applications_user_id'), table_name='applications')
    op.drop_index(op.f('ix_profile_shares_user_id'), table_name='profile_shares')
    op.drop_index(op.f('ix_profiles_owner_id'), table_name='profiles')
    op.drop_index(op.f('ix_users_status'), table_name='users')
    op.drop_index(op.f('ix_users_role'), table_name='users')
