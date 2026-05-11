"""Background worker that processes BatchJob records.

Architecture:
- One asyncio task (_worker_loop) runs for the lifetime of the process.
- The loop claims pending BatchJobs from the DB atomically using
  FOR UPDATE SKIP LOCKED, so multiple uvicorn workers never double-claim.
- Up to MAX_CONCURRENT_BATCHES batches run simultaneously.
- A single global semaphore (_global_slots) caps the total number of
  concurrent _generate_single calls across ALL active batches.
"""

import asyncio
import json
import logging
from datetime import datetime

from sqlalchemy import text

from database import SessionLocal
from models.batch_job import BatchJob

logger = logging.getLogger(__name__)

MAX_CONCURRENT_BATCHES = 5
GLOBAL_JOB_SLOTS = 4

_global_slots = asyncio.Semaphore(GLOBAL_JOB_SLOTS)


# ---------------------------------------------------------------------------
# DB helpers (each uses its own short-lived session)
# ---------------------------------------------------------------------------

async def _recover_stale_jobs() -> None:
    """Reset jobs stuck in 'running' from a previous process crash → 'pending'."""
    db = SessionLocal()
    try:
        stale = db.query(BatchJob).filter(BatchJob.status == "running").all()
        for job in stale:
            job.status = "pending"
            job.started_at = None
        if stale:
            db.commit()
            logger.warning("Recovered %d stale batch jobs → pending", len(stale))
    except Exception:
        db.rollback()
        logger.exception("Failed to recover stale batch jobs")
    finally:
        db.close()


async def _claim_next_pending() -> str | None:
    """Atomically claim one pending BatchJob. Returns its id or None."""
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                UPDATE batch_jobs
                   SET status = 'running',
                       started_at = :now
                 WHERE id = (
                       SELECT id FROM batch_jobs
                        WHERE status = 'pending'
                        ORDER BY created_at ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
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
        logger.exception("Failed to claim pending batch job")
        return None
    finally:
        db.close()


def _load_batch(batch_id: str) -> dict | None:
    """Load a BatchJob row and return its fields as a plain dict."""
    db = SessionLocal()
    try:
        b = db.get(BatchJob, batch_id)
        if not b:
            return None
        return {
            "user_id": b.user_id,
            "profile_id": b.profile_id,
            "jobs_input": json.loads(b.jobs_input),
            "completed_indices": set(json.loads(b.completed_job_indices or "[]")),
            "error_details": json.loads(b.error_details or "[]"),
        }
    finally:
        db.close()


def _record_success(batch_id: str, index: int, result) -> None:
    db = SessionLocal()
    try:
        b = db.get(BatchJob, batch_id)
        if not b:
            return
        b.completed_jobs += 1
        b.total_cost += result.cost
        b.total_prompt_tokens += result.prompt_tokens
        b.total_completion_tokens += result.completion_tokens
        indices = set(json.loads(b.completed_job_indices or "[]"))
        indices.add(index)
        b.completed_job_indices = json.dumps(sorted(indices))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to record success for batch %s job %d", batch_id, index)
    finally:
        db.close()


def _record_failure(batch_id: str, index: int, job_title: str, error: str) -> None:
    db = SessionLocal()
    try:
        b = db.get(BatchJob, batch_id)
        if not b:
            return
        b.failed_jobs += 1
        errors = json.loads(b.error_details or "[]")
        errors.append({"index": index, "job_title": job_title, "error": error})
        b.error_details = json.dumps(errors)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to record failure for batch %s job %d", batch_id, index)
    finally:
        db.close()


def _finalize_batch(batch_id: str) -> None:
    db = SessionLocal()
    try:
        b = db.get(BatchJob, batch_id)
        if not b:
            return
        b.completed_at = datetime.utcnow()
        if b.failed_jobs == 0:
            b.status = "completed"
        elif b.completed_jobs == 0:
            b.status = "failed"
        else:
            b.status = "partial"
        db.commit()
        logger.info(
            "Batch %s finalized → %s (%d ok, %d failed)",
            batch_id, b.status, b.completed_jobs, b.failed_jobs,
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to finalize batch %s", batch_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Per-batch runner
# ---------------------------------------------------------------------------

async def _run_batch(batch_id: str) -> None:
    data = _load_batch(batch_id)
    if not data:
        logger.error("Batch %s not found in DB", batch_id)
        return

    jobs_input: list[dict] = data["jobs_input"]
    profile_id: str = data["profile_id"]
    user_id: str = data["user_id"]
    completed_indices: set[int] = data["completed_indices"]

    async def run_one(index: int, job_data: dict) -> None:
        if index in completed_indices:
            logger.debug("Batch %s job %d already done, skipping", batch_id, index)
            return

        async with _global_slots:
            # Lazy import avoids circular dependency at module load time
            from models.profile import Profile
            from models.user import User
            from routers.generate import _generate_single

            job_db = SessionLocal()
            try:
                profile = job_db.get(Profile, profile_id)
                user = job_db.get(User, user_id)
                result = await _generate_single(
                    profile=profile,
                    job_title=job_data["job_title"],
                    company=job_data.get("company"),
                    job_url=job_data.get("job_url"),
                    job_description=job_data["job_description"],
                    resume_type=job_data.get("resume_type"),
                    current_user=user,
                    db=job_db,
                    skip_duplicate_check=job_data.get("skip_duplicate_check", False),
                )
                _record_success(batch_id, index, result)
                logger.info("Batch %s job %d ✓ (%s)", batch_id, index, job_data.get("job_title"))
            except Exception as exc:
                job_title = job_data.get("job_title", f"Job #{index + 1}")
                logger.error("Batch %s job %d failed: %s", batch_id, index, exc)
                _record_failure(batch_id, index, job_title, str(exc))
            finally:
                job_db.close()

    await asyncio.gather(*[run_one(i, job) for i, job in enumerate(jobs_input)])
    _finalize_batch(batch_id)


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

async def _worker_loop() -> None:
    active: dict[str, asyncio.Task] = {}

    while True:
        try:
            # Prune finished tasks
            for bid in [k for k, t in list(active.items()) if t.done()]:
                task = active.pop(bid)
                try:
                    exc = task.exception()
                    if exc:
                        logger.error("Batch %s raised unhandled exception: %s", bid, exc)
                except asyncio.CancelledError:
                    pass

            # Claim new batches up to the cap
            open_slots = MAX_CONCURRENT_BATCHES - len(active)
            for _ in range(open_slots):
                batch_id = await _claim_next_pending()
                if not batch_id:
                    break
                logger.info("Worker claimed batch %s", batch_id)
                active[batch_id] = asyncio.create_task(_run_batch(batch_id))

        except Exception:
            logger.exception("Worker loop iteration error")

        await asyncio.sleep(2)


# ---------------------------------------------------------------------------
# Public entry point — called from main.py lifespan
# ---------------------------------------------------------------------------

async def start_worker() -> None:
    await _recover_stale_jobs()
    asyncio.create_task(_worker_loop())
    logger.info("Batch worker started (slots=%d, max_batches=%d)", GLOBAL_JOB_SLOTS, MAX_CONCURRENT_BATCHES)
