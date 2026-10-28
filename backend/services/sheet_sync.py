"""Keeps each profile's Google Sheet in step with the queue and History.

Callers never talk to Google directly. They add a SheetSyncJob (same DB transaction as
the change that caused it); a background worker applies pending jobs in order and retries
with backoff, so a Google outage or a missing permission never blocks queueing.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from models.application import Application
from models.profile import Profile
from models.queue import QueueTask
from models.sheet_sync import SheetSyncJob
from services import sheet_service
from services.sheet_service import SheetError, SheetsClient

logger = logging.getLogger(__name__)

TICK_INTERVAL = 10  # seconds
BATCH_SIZE = 5  # jobs per tick; each job costs about two Sheets API calls
MAX_ATTEMPTS = 8
MAX_ERROR_CHARS = 500
MAX_COMMENT_CHARS = 300


# ── Building jobs ────────────────────────────────────────────────────────────


def _row_identity(task: QueueTask) -> dict:
    """Fields that locate a task's row in the sheet."""
    return {
        "company": task.company or "",
        "position": task.job_title or "",
        "source_link": task.job_source_url or "",
        "actual_link": task.job_url or "",
    }


def _enabled_profile(db: Session, profile_id: str | None) -> Profile | None:
    if not profile_id:
        return None
    profile = db.get(Profile, profile_id)
    return profile if profile and (profile.job_sheet_url or "").strip() else None


def _add(db: Session, profile: Profile, op: str, payload: dict) -> None:
    db.add(SheetSyncJob(profile_id=profile.id, op=op, payload=payload))


def on_task_queued(db: Session, task: QueueTask) -> None:
    """New queue task -> new row (links, board, position, when posted)."""
    profile = _enabled_profile(db, task.profile_id)
    if not profile:
        return
    identity = _row_identity(task)
    _add(db, profile, "add_row", {
        **identity,
        "job_board": task.job_board
        or sheet_service.job_board_from_url(task.job_source_url or task.job_url),
        "posted": task.posted_text or "",
    })


def _update(db: Session, task: QueueTask, fields: dict) -> None:
    profile = _enabled_profile(db, task.profile_id)
    if not profile:
        return
    _add(db, profile, "update_row", {"match": _row_identity(task), "fields": fields})


def on_task_generated(
    db: Session,
    task: QueueTask,
    required_skills: list[str],
    application_id: str | None = None,
) -> None:
    """Generation finished -> fill Main TechStack and Resume Link (the History page)."""
    fields: dict[str, str] = {}
    skills = [s.strip() for s in required_skills if s and s.strip()][:6]
    if skills:
        fields["tech_stack"] = ", ".join(skills)
    if application_id:
        fields["resume_link"] = f"{settings.public_base_url.rstrip('/')}/history/{application_id}"
    if fields:
        _update(db, task, fields)


def on_task_blocked(db: Session, task: QueueTask, reason: str) -> None:
    """Task needs review, failed or was skipped -> say why in Comment."""
    reason = " ".join(reason.split())[:MAX_COMMENT_CHARS]
    if reason:
        _update(db, task, {"comment": reason})


def on_application_applied(db: Session, application: Application) -> None:
    """History 'applied' checkbox changed -> tick or untick Applied? in the sheet."""
    profile = _enabled_profile(db, application.profile_id)
    if not profile:
        return
    task = db.scalars(
        select(QueueTask)
        .where(QueueTask.application_id == application.id)
        .order_by(QueueTask.created_at.desc())
    ).first()
    if task:
        match = _row_identity(task)
    else:  # generated from the web form, not the queue: best effort on company + link
        match = {
            "company": application.company or "",
            "position": application.job_title or "",
            "source_link": "",
            "actual_link": application.job_url or "",
        }
    _add(db, profile, "update_row", {"match": match, "fields": {"applied": application.applied}})


# ── Processing ───────────────────────────────────────────────────────────────


def _apply(client: SheetsClient, sheet_url: str, job: SheetSyncJob) -> None:
    if job.op == "add_row":
        sheet_service.add_job(client, sheet_url, job.payload)
    elif job.op == "update_row":
        sheet_service.update_job(
            client, sheet_url, job.payload["match"], job.payload["fields"]
        )
    else:
        raise SheetError(f"Unknown sync operation: {job.op}")


def process_pending(
    db: Session, client: SheetsClient, now: datetime | None = None, limit: int = BATCH_SIZE
) -> int:
    """Apply due jobs oldest-first. Once a profile's job fails, its later jobs wait so a
    row update never overtakes the insert it depends on. Returns jobs completed."""
    now = now or datetime.utcnow()
    due = db.scalars(
        select(SheetSyncJob)
        .where(SheetSyncJob.status == "pending", SheetSyncJob.next_attempt_at <= now)
        .order_by(SheetSyncJob.created_at)
        .limit(limit * 4)
    ).all()

    blocked: set[str] = set()
    completed = 0
    for job in due:
        if completed >= limit:
            break
        if job.profile_id in blocked:
            continue
        profile = db.get(Profile, job.profile_id)
        sheet_url = (profile.job_sheet_url or "").strip() if profile else ""
        if not sheet_url:  # link removed since the job was created
            job.status = "failed"
            job.last_error = "Profile has no sheet link"
            db.commit()
            continue
        try:
            _apply(client, sheet_url, job)
        except Exception as exc:
            job.attempts += 1
            job.last_error = str(exc)[:MAX_ERROR_CHARS]
            if job.attempts >= MAX_ATTEMPTS:
                job.status = "failed"
            else:
                job.next_attempt_at = now + timedelta(
                    seconds=min(3600, 30 * 2 ** job.attempts)
                )
            blocked.add(job.profile_id)
            logger.warning(
                "Sheet sync %s (%s) attempt %d failed: %s", job.id, job.op, job.attempts, exc
            )
        else:
            job.status = "done"
            job.done_at = now
            job.last_error = None
            completed += 1
        db.commit()
    return completed


def _tick() -> None:
    client = sheet_service.get_client()
    if client is None:
        return
    db = SessionLocal()
    try:
        process_pending(db, client)
    finally:
        db.close()


async def _worker_loop() -> None:
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _tick)
        except Exception:
            logger.exception("Sheet sync loop error")
        await asyncio.sleep(TICK_INTERVAL)


async def start_sheet_sync_worker() -> None:
    asyncio.create_task(_worker_loop())
    logger.info("Sheet sync worker started")


def retry_failed(db: Session, profile_id: str) -> int:
    """Put a profile's failed jobs back in line (after the owner fixes the sheet)."""
    jobs = db.scalars(
        select(SheetSyncJob).where(
            SheetSyncJob.profile_id == profile_id, SheetSyncJob.status == "failed"
        )
    ).all()
    for job in jobs:
        job.status = "pending"
        job.attempts = 0
        job.next_attempt_at = datetime.utcnow()
    db.commit()
    return len(jobs)
