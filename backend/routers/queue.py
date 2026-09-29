import json
import math
from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_approved_user
from database import get_db
from models.application import Application
from models.profile import Profile
from models.queue import QueueTask
from models.user import User

router = APIRouter(prefix="/api/queue", tags=["queue"])

# ── Extension helper: AI-powered job data extraction ─────────────────────────

ext_router = APIRouter(prefix="/api/ext", tags=["extension"])


@ext_router.post("/extract")
def extract_job_data(
    url: str = Body(...),
    text: str = Body(...),
    current_user: User = Depends(get_approved_user),
):
    """Extract structured job fields from raw page text using AI."""
    import re
    from services import ai_service

    prompt = (
        "Extract the following fields from this job posting text. "
        "Return only valid JSON with keys: job_title, company, job_description. "
        "For job_description, include the full responsibilities and requirements sections. "
        "If a field is not found, use null.\n\n"
        f"URL: {url}\n\nTEXT:\n{text[:8000]}"
    )

    try:
        resp = ai_service._call_llm(
            messages=[
                {"role": "system", "content": "You are a job data extraction assistant. Return only JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.0,
            tier="jd_parse",
        )
        raw = resp.content.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        data = json.loads(raw)
        return {
            "job_title": data.get("job_title"),
            "company": data.get("company"),
            "job_description": data.get("job_description"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}")


def _task_to_dict(task: QueueTask) -> dict:
    return {
        "id": task.id,
        "user_id": task.user_id,
        "profile_id": task.profile_id,
        "profile_name": task.profile_name,
        "doc_style_id": task.doc_style_id,
        "job_source_url": task.job_source_url,
        "job_url": task.job_url,
        "company": task.company,
        "job_title": task.job_title,
        "status": task.status,
        "warnings": json.loads(task.warnings) if task.warnings else [],
        "application_id": task.application_id,
        "error": task.error,
        "order": task.order,
        "created_at": task.created_at,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "used_key_label": task.used_key_label,
    }


@router.post("")
def enqueue_task(
    profile_id: str = Body(...),
    job_url: str | None = Body(None),
    job_source_url: str | None = Body(None),
    company: str | None = Body(None),
    job_title: str | None = Body(None),
    job_description: str | None = Body(None),
    doc_style_id: str | None = Body(None),
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if not profile or profile.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Snapshot profile name at enqueue time
    profile_name = profile.name if hasattr(profile, "name") else profile_id

    # Determine order: append after current last task for this user
    max_order = db.scalar(
        select(func.max(QueueTask.order)).where(QueueTask.user_id == current_user.id)
    ) or 0

    task = QueueTask(
        user_id=current_user.id,
        profile_id=profile_id,
        profile_name=profile_name,
        doc_style_id=doc_style_id,
        job_source_url=job_source_url,
        job_url=job_url,
        company=company,
        job_title=job_title,
        job_description=job_description,
        status="queued",
        order=max_order + 1,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_dict(task)


@router.get("")
def list_tasks(
    status: str | None = Query(None),
    date: str | None = Query(None),  # "today" for today's tasks
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    stmt = select(QueueTask).where(QueueTask.user_id == current_user.id)
    count_stmt = select(func.count(QueueTask.id)).where(QueueTask.user_id == current_user.id)

    if status:
        stmt = stmt.where(QueueTask.status == status)
        count_stmt = count_stmt.where(QueueTask.status == status)

    if date == "today":
        today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
        stmt = stmt.where(QueueTask.created_at >= today_start)
        count_stmt = count_stmt.where(QueueTask.created_at >= today_start)

    total = db.scalar(count_stmt) or 0
    total_pages = max(1, math.ceil(total / page_size))

    stmt = stmt.order_by(QueueTask.order.asc(), QueueTask.created_at.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    tasks = db.scalars(stmt).all()
    return {
        "items": [_task_to_dict(t) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    action: str = Body(..., embed=True),
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    task = db.get(QueueTask, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    if action == "approve":
        if task.status != "needs_review":
            raise HTTPException(status_code=400, detail="Only needs_review tasks can be approved")
        task.status = "approved"

    elif action == "retry":
        if task.status not in ("failed", "needs_review"):
            raise HTTPException(status_code=400, detail="Only failed or needs_review tasks can be retried")
        task.status = "queued"
        task.error = None
        task.warnings = None
        task.started_at = None
        task.completed_at = None

    elif action == "skip":
        if task.status == "processing":
            raise HTTPException(status_code=400, detail="Cannot skip a task that is processing")
        task.status = "skipped"
        task.completed_at = datetime.utcnow()

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    db.commit()
    db.refresh(task)
    return _task_to_dict(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    task = db.get(QueueTask, task_id)
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status == "processing":
        raise HTTPException(status_code=400, detail="Cannot delete a task that is currently processing")
    db.delete(task)
    db.commit()


@router.post("/start")
def start_queue(
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    current_user.queue_running = True
    db.commit()
    return {"queue_running": True}


@router.post("/pause")
def pause_queue(
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    current_user.queue_running = False
    db.commit()
    return {"queue_running": False}


@router.get("/status")
def queue_status(
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    # Counts by status
    rows = db.execute(
        select(QueueTask.status, func.count(QueueTask.id))
        .where(QueueTask.user_id == current_user.id)
        .group_by(QueueTask.status)
    ).all()
    counts = {row[0]: row[1] for row in rows}

    # Today's completed
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    today_completed = db.scalar(
        select(func.count(QueueTask.id)).where(
            QueueTask.user_id == current_user.id,
            QueueTask.status == "completed",
            QueueTask.completed_at >= today_start,
        )
    ) or 0

    # Today's cost from linked applications
    today_cost_row = db.execute(
        select(func.coalesce(func.sum(Application.total_cost), 0)).where(
            Application.user_id == current_user.id,
            Application.created_at >= today_start,
        )
    ).scalar()
    today_cost = float(today_cost_row or 0)

    # Current processing task
    current_task = db.scalars(
        select(QueueTask).where(
            QueueTask.user_id == current_user.id,
            QueueTask.status == "processing",
        )
    ).first()

    return {
        "queue_running": current_user.queue_running,
        "counts": counts,
        "today_completed": today_completed,
        "today_cost": today_cost,
        "current_task": _task_to_dict(current_task) if current_task else None,
    }
