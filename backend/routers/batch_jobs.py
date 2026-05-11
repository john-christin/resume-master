import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_approved_user, require_role
from database import get_db
from models.batch_job import BatchJob
from models.profile import Profile
from models.profile_share import profile_shares
from models.user import User
from schemas.generate import BatchGenerateRequest

router = APIRouter(tags=["batch-jobs"])

_bidder_or_admin = require_role("admin", "bidder")


def _get_accessible_profile(profile_id: str, user: User, db: Session) -> Profile:
    profile = db.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.owner_id == user.id:
        return profile
    shared = db.execute(
        select(profile_shares).where(
            profile_shares.c.profile_id == profile_id,
            profile_shares.c.user_id == user.id,
        )
    ).first()
    if shared:
        return profile
    raise HTTPException(status_code=404, detail="Profile not found")


def _serialize_batch(b: BatchJob) -> dict:
    return {
        "id": b.id,
        "status": b.status,
        "profile_name": b.profile_name,
        "total_jobs": b.total_jobs,
        "completed_jobs": b.completed_jobs,
        "failed_jobs": b.failed_jobs,
        "total_cost": b.total_cost,
        "total_prompt_tokens": b.total_prompt_tokens,
        "total_completion_tokens": b.total_completion_tokens,
        "error_details": json.loads(b.error_details or "[]"),
        "created_at": b.created_at.isoformat(),
        "started_at": b.started_at.isoformat() if b.started_at else None,
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
    }


@router.post("/api/batch-jobs", status_code=202)
def submit_batch_job(
    req: BatchGenerateRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    """Submit a batch generation job. Returns immediately with job_id."""
    profile = _get_accessible_profile(req.profile_id, current_user, db)

    jobs_data = [
        {
            "job_title": j.job_title,
            "company": j.company,
            "job_url": j.job_url,
            "job_description": j.job_description,
            "resume_type": j.resume_type,
            "skip_duplicate_check": j.skip_duplicate_check,
        }
        for j in req.jobs
    ]

    batch = BatchJob(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        profile_id=profile.id,
        profile_name=profile.name,
        status="pending",
        total_jobs=len(req.jobs),
        jobs_input=json.dumps(jobs_data),
        completed_job_indices="[]",
        created_at=datetime.utcnow(),
    )
    db.add(batch)
    db.commit()

    return {
        "job_id": batch.id,
        "status": "pending",
        "total_jobs": batch.total_jobs,
    }


@router.get("/api/batch-jobs")
def list_batch_jobs(
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    """List recent batch jobs. Admins see all users; others see only their own."""
    if current_user.role == "admin":
        query = select(BatchJob).order_by(BatchJob.created_at.desc()).limit(50)
    else:
        query = (
            select(BatchJob)
            .where(BatchJob.user_id == current_user.id)
            .order_by(BatchJob.created_at.desc())
            .limit(20)
        )
    batches = db.scalars(query).all()
    return [_serialize_batch(b) for b in batches]


@router.get("/api/batch-jobs/{job_id}")
def get_batch_job(
    job_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    """Get status and progress for a specific batch job."""
    batch = db.get(BatchJob, job_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch job not found")
    if batch.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return _serialize_batch(batch)
