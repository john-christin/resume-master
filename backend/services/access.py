"""Who may see an application: its generator, plus anyone who has access to its profile."""
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models.application import Application
from models.profile import Profile
from models.profile_share import profile_shares
from models.user import User


def _profile_ids_of(user: User):
    owned = select(Profile.id).where(Profile.owner_id == user.id)
    shared = select(profile_shares.c.profile_id).where(profile_shares.c.user_id == user.id)
    return owned, shared


def visible_applications_clause(user: User):
    """SQL filter for the applications a bidder can see: their own, and every
    application made on a profile they own or that is shared with them."""
    owned, shared = _profile_ids_of(user)
    return or_(
        Application.user_id == user.id,
        Application.profile_id.in_(owned),
        Application.profile_id.in_(shared),
    )


def can_access_application(user: User, application: Application, db: Session) -> bool:
    if application.user_id == user.id:
        return True
    return db.scalar(
        select(Application.id).where(
            Application.id == application.id, visible_applications_clause(user)
        )
    ) is not None
