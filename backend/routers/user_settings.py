from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_approved_user, hash_password, verify_password
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/user", tags=["user-settings"])


class UpdateUsernameRequest(BaseModel):
    new_username: str


class ResetPasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserSettingsResponse(BaseModel):
    username: str
    role: str
    status: str


@router.get("/settings", response_model=UserSettingsResponse)
def get_settings(current_user: User = Depends(get_approved_user)):
    return UserSettingsResponse(
        username=current_user.username,
        role=current_user.role,
        status=current_user.status,
    )


@router.put("/username")
def update_username(
    data: UpdateUsernameRequest,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    new_username = data.new_username.strip()
    if not new_username or len(new_username) < 2:
        raise HTTPException(
            status_code=400, detail="Username must be at least 2 characters"
        )
    if len(new_username) > 100:
        raise HTTPException(
            status_code=400, detail="Username must be at most 100 characters"
        )

    if new_username == current_user.username:
        return {"detail": "Username unchanged"}

    existing = db.scalars(
        select(User).where(User.username == new_username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    current_user.username = new_username
    db.commit()
    return {"detail": "Username updated", "username": new_username}


@router.put("/password")
def reset_password(
    data: ResetPasswordRequest,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400, detail="Current password is incorrect"
        )

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="New password must be at least 6 characters"
        )

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password updated"}
