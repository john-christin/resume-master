from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models.education import Education
from models.experience import Experience
from models.profile import Profile
from models.profile_share import profile_shares
from models.user import User
from schemas.profile import (
    ProfileCreate,
    ProfileResponse,
    ProfileShareRequest,
    ProfileShareUser,
    UserSearchResult,
)

router = APIRouter(tags=["profiles"])

_bidder_or_admin = require_role("admin", "bidder")


def _profile_to_response(profile: Profile, current_user_id: str) -> dict:
    """Convert a Profile ORM object to a response dict with ownership flags."""
    data = {
        "id": profile.id,
        "owner_id": profile.owner_id,
        "name": profile.name,
        "location": profile.location,
        "phone": profile.phone,
        "email": profile.email,
        "linkedin": profile.linkedin,
        "summary": profile.summary,
        "educations": profile.educations,
        "experiences": profile.experiences,
        "is_owner": profile.owner_id == current_user_id,
        "is_shared": profile.owner_id != current_user_id,
        "owner_username": profile.owner.username if profile.owner else None,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }
    return data


def _get_accessible_profile(
    profile_id: str, user: User, db: Session
) -> Profile:
    """Get a profile if the user owns it, has it shared, or is admin."""
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Admin can access any profile
    if user.role == "admin":
        return profile

    if profile.owner_id == user.id:
        return profile

    # Check if shared with this user
    shared = db.execute(
        select(profile_shares).where(
            profile_shares.c.profile_id == profile_id,
            profile_shares.c.user_id == user.id,
        )
    ).first()
    if shared:
        return profile

    raise HTTPException(status_code=404, detail="Profile not found")


@router.get("/api/profiles", response_model=list[ProfileResponse])
def list_profiles(
    accessible_only: bool = False,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    # Admin sees all profiles unless restricted to only accessible ones
    if current_user.role == "admin" and not accessible_only:
        all_profiles = db.scalars(select(Profile)).all()
        return [
            _profile_to_response(p, current_user.id) for p in all_profiles
        ]

    # Own profiles
    own = db.scalars(
        select(Profile).where(Profile.owner_id == current_user.id)
    ).all()

    # Shared profiles
    shared_ids = db.scalars(
        select(profile_shares.c.profile_id).where(
            profile_shares.c.user_id == current_user.id
        )
    ).all()
    shared = (
        db.scalars(select(Profile).where(Profile.id.in_(shared_ids))).all()
        if shared_ids
        else []
    )

    results = []
    for p in own:
        results.append(_profile_to_response(p, current_user.id))
    for p in shared:
        results.append(_profile_to_response(p, current_user.id))
    return results


@router.post(
    "/api/profiles", response_model=ProfileResponse, status_code=201
)
def create_profile(
    data: ProfileCreate,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = Profile(
        owner_id=current_user.id,
        name=data.name,
        location=data.location,
        phone=data.phone,
        email=data.email,
        linkedin=data.linkedin,
        summary=data.summary,
    )

    for edu in data.educations:
        profile.educations.append(Education(**edu.model_dump(exclude={"id"})))
    for exp in data.experiences:
        profile.experiences.append(
            Experience(**exp.model_dump(exclude={"id"}))
        )

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile, current_user.id)


@router.get("/api/profiles/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(profile_id, current_user, db)
    return _profile_to_response(profile, current_user.id)


@router.put("/api/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: str,
    data: ProfileCreate,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(profile_id, current_user, db)
    if profile.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Cannot edit a shared profile"
        )

    profile.name = data.name
    profile.location = data.location
    profile.phone = data.phone
    profile.email = data.email
    profile.linkedin = data.linkedin
    profile.summary = data.summary

    profile.educations.clear()
    for edu in data.educations:
        profile.educations.append(Education(**edu.model_dump(exclude={"id"})))

    profile.experiences.clear()
    for exp in data.experiences:
        profile.experiences.append(
            Experience(**exp.model_dump(exclude={"id"}))
        )

    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile, current_user.id)


@router.delete("/api/profiles/{profile_id}", status_code=204)
def delete_profile(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()


# --- Sharing endpoints ---


@router.post("/api/profiles/{profile_id}/share", status_code=200)
def share_profile(
    profile_id: str,
    data: ProfileShareRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Profile not found")

    # Validate target users exist and are approved
    for uid in data.user_ids:
        if uid == current_user.id:
            continue  # Skip self
        target = db.get(User, uid)
        if not target or target.status != "approved":
            raise HTTPException(
                status_code=400,
                detail=f"User {uid} not found or not approved",
            )
        # Check if already shared
        existing = db.execute(
            select(profile_shares).where(
                profile_shares.c.profile_id == profile_id,
                profile_shares.c.user_id == uid,
            )
        ).first()
        if not existing:
            db.execute(
                profile_shares.insert().values(
                    profile_id=profile_id,
                    user_id=uid,
                    shared_at=datetime.now(timezone.utc),
                )
            )

    db.commit()
    return {"detail": "Profile shared successfully"}


@router.delete(
    "/api/profiles/{profile_id}/share/{user_id}", status_code=204
)
def unshare_profile(
    profile_id: str,
    user_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Profile not found")

    db.execute(
        profile_shares.delete().where(
            profile_shares.c.profile_id == profile_id,
            profile_shares.c.user_id == user_id,
        )
    )
    db.commit()


@router.get(
    "/api/profiles/{profile_id}/shares",
    response_model=list[ProfileShareUser],
)
def list_shares(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Profile not found")

    rows = db.execute(
        select(
            profile_shares.c.user_id,
            User.username,
            profile_shares.c.shared_at,
        )
        .join(User, User.id == profile_shares.c.user_id)
        .where(profile_shares.c.profile_id == profile_id)
    ).all()

    return [
        ProfileShareUser(user_id=r[0], username=r[1], shared_at=r[2])
        for r in rows
    ]


# --- User search for sharing UI ---


@router.get("/api/users/search", response_model=list[UserSearchResult])
def search_users(
    q: str = "",
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    if not q or len(q) < 2:
        return []

    results = db.scalars(
        select(User)
        .where(
            User.status == "approved",
            User.id != current_user.id,
            User.username.ilike(f"%{q}%"),
        )
        .limit(20)
    ).all()

    return [UserSearchResult(id=u.id, username=u.username) for u in results]
