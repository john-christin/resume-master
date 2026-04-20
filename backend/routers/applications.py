import math
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from auth import get_approved_user
from config import settings
from database import get_db
from models.application import Application
from models.user import User
from schemas.application import (
    ApplicationDetail,
    ApplicationSummary,
    PaginatedApplications,
)

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _app_to_summary(app: Application, db: Session, include_cost: bool = True) -> dict:
    """Convert Application ORM to dict, adding user_email for cross-user views."""
    data = {
        "id": app.id,
        "job_title": app.job_title,
        "company": app.company,
        "job_url": app.job_url,
        "resume_type": app.resume_type,
        "resume_path": app.resume_path,
        "cover_letter_path": app.cover_letter_path,
        "profile_name": app.profile_name,
        "location": app.location,
        "created_at": app.created_at,
        "user_username": app.user.username if app.user else None,
    }
    if include_cost:
        data["prompt_tokens"] = app.prompt_tokens
        data["completion_tokens"] = app.completion_tokens
        data["total_cost"] = app.total_cost
    return data


@router.get("", response_model=PaginatedApplications)
def list_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    # Base query
    stmt = select(Application)
    count_stmt = select(func.count(Application.id))

    # Role-based filtering
    if current_user.role == "bidder":
        stmt = stmt.where(Application.user_id == current_user.id)
        count_stmt = count_stmt.where(Application.user_id == current_user.id)
    # caller and admin see all

    # Search filter
    if search:
        search_filter = or_(
            Application.job_title.ilike(f"%{search}%"),
            Application.company.ilike(f"%{search}%"),
            Application.job_url.ilike(f"%{search}%"),
            Application.profile_name.ilike(f"%{search}%"),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    # Count total
    total = db.scalar(count_stmt) or 0
    total_pages = max(1, math.ceil(total / page_size))

    # Sort
    allowed_sorts = {
        "created_at": Application.created_at,
        "job_title": Application.job_title,
        "company": Application.company,
        "total_cost": Application.total_cost,
    }
    sort_col = allowed_sorts.get(sort_by, Application.created_at)
    if sort_dir == "asc":
        stmt = stmt.order_by(sort_col.asc())
    else:
        stmt = stmt.order_by(sort_col.desc())

    # Paginate
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    apps = db.scalars(stmt).all()
    include_cost = current_user.role in ("admin", "caller")
    items = [_app_to_summary(a, db, include_cost=include_cost) for a in apps]

    return PaginatedApplications(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{app_id}", response_model=ApplicationDetail)
def get_application(
    app_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    application = db.get(Application, app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Bidders can only view their own
    if (
        current_user.role == "bidder"
        and application.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Application not found")

    return application


@router.delete("/{app_id}", status_code=204)
def delete_application(
    app_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    application = db.get(Application, app_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Callers cannot delete
    if current_user.role == "caller":
        raise HTTPException(
            status_code=403, detail="Callers cannot delete applications"
        )

    # Bidders can only delete their own
    if (
        current_user.role == "bidder"
        and application.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Application not found")

    uploads_dir = Path(settings.upload_dir)
    for suffix in [
        "_resume.docx",
        "_resume.pdf",
        "_cover_letter.docx",
        "_cover_letter.pdf",
    ]:
        file_path = uploads_dir / f"{app_id}{suffix}"
        file_path.unlink(missing_ok=True)

    db.delete(application)
    db.commit()
