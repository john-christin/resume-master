from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from config import settings
from database import get_db
from models.user import User
from schemas.auth import AuthResponse, LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _build_auth_response(user: User, token: str) -> AuthResponse:
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        role=user.role,
        status=user.status,
        profile_count=len(user.profiles),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalars(
        select(User).where(User.username == req.username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    # Determine if this is the bootstrap admin
    is_admin = (
        settings.default_admin_username
        and req.username.lower() == settings.default_admin_username.lower()
    )

    user = User(
        username=req.username,
        hashed_password=hash_password(req.password),
        role="admin" if is_admin else "bidder",
        status="approved" if is_admin else "pending",
        approved_at=datetime.now(timezone.utc) if is_admin else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return _build_auth_response(user, token)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalars(
        select(User).where(User.username == req.username)
    ).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=401, detail="Invalid username or password"
        )

    token = create_access_token(user.id)
    return _build_auth_response(user, token)


@router.get("/me", response_model=AuthResponse)
def get_me(current_user: User = Depends(get_current_user)):
    token = create_access_token(current_user.id)
    return _build_auth_response(current_user, token)
