"""Centralised database logging service.

All public functions are fire-and-forget: they open their own DB session,
write the row, and swallow any exceptions so that a logging failure can
never break the main request path.
"""

import asyncio
import json
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from sqlalchemy import delete

from database import SessionLocal
from models.system_log import SystemLog

# Dedicated thread pool so log writes never compete with request workers.
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="log_writer")

# ---------------------------------------------------------------------------
# Public constants
# ---------------------------------------------------------------------------

INFO = "INFO"
WARNING = "WARNING"
ERROR = "ERROR"
CRITICAL = "CRITICAL"

API = "api"
AI_CALL = "ai_call"
GENERATION = "generation"
AUTH = "auth"
ADMIN = "admin"


# ---------------------------------------------------------------------------
# Core write function (sync — safe to call from threads)
# ---------------------------------------------------------------------------

def write_log(
    level: str,
    category: str,
    message: str,
    *,
    user_id: str | None = None,
    ip_address: str | None = None,
    endpoint: str | None = None,
    details: dict | None = None,
    error_type: str | None = None,
    stack_trace: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """Write one log row to the database. Never raises.

    INFO entries are intentionally dropped — only WARNING and above are
    persisted so the log table stays focused on actionable events.
    """
    if level == INFO:
        return
    db = SessionLocal()
    try:
        db.add(SystemLog(
            level=level,
            category=category,
            message=message,
            user_id=user_id,
            ip_address=ip_address,
            endpoint=endpoint,
            details=json.dumps(details, default=str) if details else None,
            error_type=error_type,
            stack_trace=stack_trace,
            duration_ms=duration_ms,
        ))
        db.commit()
    except Exception:
        pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Async fire-and-forget helpers (for use inside async request handlers)
# ---------------------------------------------------------------------------

def log_bg(
    level: str,
    category: str,
    message: str,
    **kwargs,
) -> None:
    """Schedule a log write on the background thread pool without awaiting.

    Safe to call from both sync and async contexts.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.run_in_executor(
            _executor,
            lambda: write_log(level, category, message, **kwargs),
        )
    except RuntimeError:
        # No running event loop (e.g. called from a plain sync context).
        write_log(level, category, message, **kwargs)


# ---------------------------------------------------------------------------
# Convenience wrappers
# ---------------------------------------------------------------------------

def exc_to_log_kwargs(exc: BaseException) -> dict:
    """Extract error_type and stack_trace from an exception."""
    return {
        "error_type": type(exc).__name__,
        "stack_trace": traceback.format_exc(),
    }


# ---------------------------------------------------------------------------
# Retention cleanup
# ---------------------------------------------------------------------------

def cleanup_old_logs(retention_days: int = 15) -> int:
    """Delete log rows older than *retention_days*. Returns the count removed."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        result = db.execute(delete(SystemLog).where(SystemLog.created_at < cutoff))
        db.commit()
        return result.rowcount
    except Exception:
        return 0
    finally:
        db.close()
