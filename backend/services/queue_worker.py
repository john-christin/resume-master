"""Background worker that processes QueueTask records sequentially.

Architecture:
- settings.queue_max_workers asyncio tasks (_worker_loop) run for the lifetime of the
  process, so that many tasks are generated at once.
- Each worker ticks every 3 s and claims one task for a user where queue_running = True.
  Users take turns: the next task comes from the user with the fewest tasks running,
  then the one served longest ago, so a long queue never starves anyone else.
- Pre-checks (clearance, banned company, duplicate) gate each task unless it was
  manually approved (status == 'approved'), which skips all pre-checks.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, date

from sqlalchemy import select, text

from config import settings
from database import SessionLocal
from models.application import Application
from models.queue import QueueTask
from models.user import User
from services import sheet_sync
from services.ai_service import RateLimitExceeded

logger = logging.getLogger(__name__)

TICK_INTERVAL = 3  # seconds between polls
RATE_LIMIT_PAUSE = 60  # seconds every worker waits after the AI provider is rate limited

# The rate limit belongs to the whole API account, so when one task hits it the
# other workers would only hit it too: nobody claims a task until this time.
_paused_until = 0.0


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
    """Atomically claim one queued/approved task for a user with queue_running=True.

    Fair across users: prefer the user with the fewest tasks processing right now,
    then the user whose last task started longest ago; within a user, queue order.
    """
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
                        ORDER BY
                              (SELECT COUNT(*) FROM queue_tasks r
                                WHERE r.user_id = qt.user_id
                                  AND r.status = 'processing') ASC,
                              COALESCE((SELECT MAX(r.started_at) FROM queue_tasks r
                                         WHERE r.user_id = qt.user_id),
                                       TIMESTAMP 'epoch') ASC,
                              qt.order ASC, qt.created_at ASC
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
        if task.company and task.job_title and not task.allow_duplicate:
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
                sheet_sync.on_task_blocked(db, task, "; ".join(warnings))
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
            sheet_sync.on_task_blocked(db, task, f"Failed: {task.error}")
            db.commit()
            return

        # Assign a pool key for this job (round-robin)
        pool_key_id: str | None = None
        model_config_id = _get_resume_model_config_id()
        if model_config_id:
            assignment = assign_key_for_job(model_config_id, task_id)
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
        generated = db.get(Application, result.application_id)
        skills: list[str] = []
        if generated and generated.required_skills:
            try:
                loaded = json.loads(generated.required_skills)
                skills = loaded if isinstance(loaded, list) else []
            except ValueError:
                logger.warning("Application %s has unreadable required_skills", generated.id)
        sheet_sync.on_task_generated(db, task, skills, result.application_id)
        db.commit()
        logger.info("Queue task %s completed → application %s", task_id, result.application_id)

    except RateLimitExceeded as exc:
        # Not the task's fault: put it back in the queue and let every worker rest a bit.
        global _paused_until
        _paused_until = time.monotonic() + RATE_LIMIT_PAUSE
        logger.warning("Queue task %s hit the AI rate limit (%s) — requeued, pausing %ds",
                       task_id, exc, RATE_LIMIT_PAUSE)
        db.rollback()
        task = db.get(QueueTask, task_id)
        if task:
            task.status = "queued"
            task.started_at = None
            task.used_api_key_pool_id = None
            db.commit()
        db.close()
    except Exception as exc:
        logger.exception("Queue task %s failed: %s", task_id, exc)
        db = SessionLocal()
        try:
            task = db.get(QueueTask, task_id)
            if task:
                task.status = "failed"
                task.error = str(exc)
                task.completed_at = datetime.utcnow()
                sheet_sync.on_task_blocked(db, task, f"Failed: {exc}")
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

async def _worker_loop(worker_no: int) -> None:
    # Stagger the start so workers don't all poll on the same tick
    await asyncio.sleep(worker_no * TICK_INTERVAL / max(1, settings.queue_max_workers))
    while True:
        if time.monotonic() < _paused_until:
            await asyncio.sleep(TICK_INTERVAL)
            continue
        try:
            task_id = _claim_next_task()
            if task_id:
                logger.info("Queue worker %d claimed task %s", worker_no, task_id)
                await _process_task(task_id)
        except Exception:
            logger.exception("Queue worker loop error")

        await asyncio.sleep(TICK_INTERVAL)


# ---------------------------------------------------------------------------
# Public entry point — called from main.py lifespan
# ---------------------------------------------------------------------------

async def start_queue_worker() -> None:
    await _recover_stale_tasks()
    workers = max(1, settings.queue_max_workers)
    logger.info("Starting %d queue workers", workers)
    for n in range(workers):
        asyncio.create_task(_worker_loop(n))
    logger.info("Queue worker started (tick=%ds)", TICK_INTERVAL)
