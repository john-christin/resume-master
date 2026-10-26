from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models.sheet_sync import SheetSyncJob
from models.user import User
from routers.profile import _get_accessible_profile
from services import sheet_service, sheet_sync

router = APIRouter(prefix="/api/profiles/{profile_id}/job-sheet", tags=["job-sheet"])

_bidder_or_admin = require_role("admin", "bidder")


def _owned_profile(profile_id: str, user: User, db: Session):
    profile = _get_accessible_profile(profile_id, user, db)
    if profile.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the profile owner can manage its sheet")
    return profile


@router.get("")
def sheet_status(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    """Is syncing set up, and is anything stuck?"""
    profile = _get_accessible_profile(profile_id, current_user, db)
    client = sheet_service.get_client()

    counts = dict(
        db.execute(
            select(SheetSyncJob.status, func.count())
            .where(SheetSyncJob.profile_id == profile.id)
            .group_by(SheetSyncJob.status)
        ).all()
    )
    last_error = db.scalar(
        select(SheetSyncJob.last_error)
        .where(SheetSyncJob.profile_id == profile.id, SheetSyncJob.last_error.is_not(None))
        .order_by(SheetSyncJob.created_at.desc())
        .limit(1)
    )
    return {
        "sheet_url": profile.job_sheet_url,
        "configured": client is not None,
        "service_account_email": client.email if client else None,
        "pending": counts.get("pending", 0),
        "failed": counts.get("failed", 0),
        "last_error": last_error,
    }


@router.post("/test")
def test_sheet(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    """Check that the server can open the sheet and understand its columns."""
    profile = _owned_profile(profile_id, current_user, db)
    if not (profile.job_sheet_url or "").strip():
        raise HTTPException(status_code=400, detail="Save a sheet link on the profile first")
    client = sheet_service.get_client()
    if client is None:
        raise HTTPException(
            status_code=503, detail="Google access is not configured on the server yet"
        )
    try:
        return sheet_service.check_sheet(client, profile.job_sheet_url)
    except sheet_service.SheetError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/retry")
def retry_failed(
    profile_id: str,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    """Re-run sheet updates that gave up (after fixing permissions or the sheet)."""
    profile = _owned_profile(profile_id, current_user, db)
    return {"requeued": sheet_sync.retry_failed(db, profile.id)}
