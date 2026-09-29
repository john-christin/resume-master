"""Background worker that processes QueueTask records sequentially.

Architecture:
- One asyncio task (_worker_loop) runs for the lifetime of the process.
- Ticks every 3 s, picks one task at a time per user where queue_running = True.
- Pre-checks (clearance, banned company, duplicate) gate each task unless it was
  manually approved (status == 'approved'), which skips all pre-checks.
"""

import asyncio
import json
import logging
from datetime import datetime, date

from sqlalchemy import select, text

from database import SessionLocal
from models.queue import QueueTask
from models.user import User

logger = logging.getLogger(__name__)

TICK_INTERVAL = 3  # seconds between polls


# ---------------------------------------------------------------------------
# Crash recovery
# ---------------------------------------------------------------------------

async def _recover_stale_tasks() -> None:
    """Reset tasks stuck in 'processing' from a previous crash → 'queued'."""
    db = SessionLocal()
    try:
        stale = db.scalars(
            select(QueueTask).where(QueueTask.status == "processing")
        ).all()
        for task in stale:
            task.status = "queued"
            task.started_at = None
        if stale:
            db.commit()
            logger.warning("Recovered %d stale queue tasks → queued", len(stale))
    except Exception:
        db.rollback()
        logger.exception("Failed to recover stale queue tasks")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Claim next task atomically
# ---------------------------------------------------------------------------

def _claim_next_task() -> str | None:
    """Atomically claim one queued/approved task for a user with queue_running=True."""
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                UPDATE queue_tasks
                   SET status = 'processing',
                       started_at = :now
                 WHERE id = (
                       SELECT qt.id
                         FROM queue_tasks qt
                         JOIN users u ON u.id = qt.user_id
                        WHERE qt.status IN ('queued', 'approved')
                          AND u.queue_running = TRUE
                        ORDER BY qt.order ASC, qt.created_at ASC
                        LIMIT 1
                        FOR UPDATE OF qt SKIP LOCKED
                       )
                RETURNING id
                """
            ),
            {"now": datetime.utcnow()},
        ).fetchone()
        db.commit()
        return row[0] if row else None
    except Exception:
        db.rollback()
        logger.exception("Failed to claim next queue task")
        return None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pre-checks
# ---------------------------------------------------------------------------

def _run_pre_checks(task_id: str) -> list[str]:
    """
    Run clearance, banned-company, and duplicate checks.
    Returns a list of warning strings; empty means all clear.
    """
    from models.profile import Profile
    from routers.generate import (
        _check_clearance_for_profile,
        _find_banned_matches,
        _find_duplicate_bids,
    )

    warnings: list[str] = []
    db = SessionLocal()
    try:
        task = db.get(QueueTask, task_id)
        if not task or not task.profile_id:
            return []

        profile = db.get(Profile, task.profile_id)
        if not profile:
            return ["Profile no longer exists"]

        # Clearance check
        if task.job_description:
            clearance_result = _check_clearance_for_profile(profile, task.job_description)
            if not clearance_result.allowed:
                warnings.append(f"Clearance: {clearance_result.reason}")

        # Banned company check
        if task.company:
            matches = _find_banned_matches([task.company], db)
            for m in matches:
                warnings.append(f"Banned company: {m.description or m.banned_name}")

        # Duplicate check
        if task.company and task.job_title:
            dupes = _find_duplicate_bids(
                task.user_id,
                task.profile_id,
                [(task.company, task.job_title)],
                db,
            )
            for company, job_title in dupes:
                warnings.append(f"Already applied: {company} — {job_title}")

        return warnings
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Task execution
# ---------------------------------------------------------------------------

def _get_resume_model_config_id() -> str | None:
    """Return the DB id of the model config assigned to the 'resume' role, or None."""
    from models.ai_model_config import AIModelConfig
    from models.role_model_assignment import RoleModelAssignment
    db = SessionLocal()
    try:
        row = db.scalars(
            select(AIModelConfig)
            .join(RoleModelAssignment, RoleModelAssignment.ai_model_config_id == AIModelConfig.id)
            .where(RoleModelAssignment.role == "resume")
        ).first()
        return row.id if row else None
    finally:
        db.close()


async def _process_task(task_id: str) -> None:
    from models.profile import Profile
    from routers.generate import _generate_single
    from services.ai_service import assign_key_for_job

    db = SessionLocal()
    try:
        task = db.get(QueueTask, task_id)
        if not task:
            logger.error("Queue task %s not found", task_id)
            return

        # A task is "approved" if it previously had warnings (user accepted them).
        skip_checks = bool(task.warnings)

        if not skip_checks:
            warnings = await asyncio.get_event_loop().run_in_executor(None, _run_pre_checks, task_id)
            if warnings:
                task.status = "needs_review"
                task.warnings = json.dumps(warnings)
                task.started_at = None
                db.commit()
                logger.info("Task %s needs review: %s", task_id, warnings)
                return

        # Run generation
        profile = db.get(Profile, task.profile_id) if task.profile_id else None
        user = db.get(User, task.user_id)

        if not profile or not user:
            task.status = "failed"
            task.error = "Profile or user not found"
            task.completed_at = datetime.utcnow()
            db.commit()
            return

        # Assign a pool key for this job (round-robin)
        pool_key_id: str | None = None
        model_config_id = _get_resume_model_config_id()
        if model_config_id:
            assignment = assign_key_for_job(model_config_id)
            if assignment:
                pool_key_id, key_label = assignment
                task.used_api_key_pool_id = pool_key_id
                task.used_key_label = key_label
                db.commit()
                logger.info(
                    "Task %s assigned pool key %s (%s)",
                    task_id, pool_key_id, key_label or "unlabeled",
                )

        result = await _generate_single(
            profile=profile,
            job_title=task.job_title or "",
            company=task.company,
            job_url=task.job_url,
            job_description=task.job_description or "",
            resume_type=None,
            current_user=user,
            db=db,
            pool_key_id=pool_key_id,
        )

        # Option A: update to the key that actually ran if a failover happened
        if result.used_pool_key_id and result.used_pool_key_id != pool_key_id:
            task.used_api_key_pool_id = result.used_pool_key_id
            # Fetch label for the winning key
            from models.api_key_pool import ApiKeyPool
            winner = db.get(ApiKeyPool, result.used_pool_key_id)
            task.used_key_label = winner.label if winner else None
            logger.info(
                "Task %s: key failover — updated used key to %s (%s)",
                task_id, result.used_pool_key_id, task.used_key_label or "unlabeled",
            )

        task.status = "completed"
        task.application_id = result.application_id
        task.completed_at = datetime.utcnow()
        db.commit()
        logger.info("Queue task %s completed → application %s", task_id, result.application_id)

    except Exception as exc:
        logger.exception("Queue task %s failed: %s", task_id, exc)
        db = SessionLocal()
        try:
            task = db.get(QueueTask, task_id)
            if task:
                task.status = "failed"
                task.error = str(exc)
                task.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    else:
        db.close()


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

async def _worker_loop() -> None:
    while True:
        try:
            task_id = _claim_next_task()
            if task_id:
                logger.info("Queue worker claimed task %s", task_id)
                await _process_task(task_id)
        except Exception:
            logger.exception("Queue worker loop error")

        await asyncio.sleep(TICK_INTERVAL)


# ---------------------------------------------------------------------------
# Public entry point — called from main.py lifespan
# ---------------------------------------------------------------------------

async def start_queue_worker() -> None:
    await _recover_stale_tasks()
    asyncio.create_task(_worker_loop())
    logger.info("Queue worker started (tick=%ds)", TICK_INTERVAL)
