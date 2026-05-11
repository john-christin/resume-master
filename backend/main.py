import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from config import settings
from database import SessionLocal
from models.token_pricing import TokenPricing
from routers import admin, applications, auth, batch_jobs, generate, profile, user_settings
from services import log_service
from services.batch_worker import start_worker
from utils import get_client_ip

logger = logging.getLogger(__name__)


def _seed_default_pricing() -> None:
    """Insert a default TokenPricing row if the table is empty."""
    db = SessionLocal()
    try:
        exists = db.scalars(select(TokenPricing).limit(1)).first()
        if not exists:
            pricing = TokenPricing(
                input_price_per_1k=settings.default_input_price_per_1k,
                output_price_per_1k=settings.default_output_price_per_1k,
            )
            db.add(pricing)
            db.commit()
            logger.info(
                "Seeded default token pricing: $%s/1K input, $%s/1K output",
                settings.default_input_price_per_1k,
                settings.default_output_price_per_1k,
            )
    finally:
        db.close()


def _extract_user_id_from_request(request: Request) -> str | None:
    """Decode JWT from Authorization header without raising."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header[7:]
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None




class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every API request with status code, user, and duration."""

    # Paths to skip (health checks, static files)
    _SKIP_PREFIXES = ("/uploads/", "/api/health")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in self._SKIP_PREFIXES):
            return await call_next(request)

        start = time.monotonic()
        user_id = _extract_user_id_from_request(request)
        ip_address = get_client_ip(request)
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            log_service.log_bg(
                log_service.CRITICAL, log_service.API,
                f"{request.method} {path} raised unhandled exception",
                user_id=user_id,
                ip_address=ip_address,
                endpoint=path,
                details={"method": request.method, "status_code": 500},
                duration_ms=int((time.monotonic() - start) * 1000),
                **log_service.exc_to_log_kwargs(exc),
            )
            raise
        finally:
            duration_ms = int((time.monotonic() - start) * 1000)
            level = (
                log_service.CRITICAL if status_code >= 500
                else log_service.WARNING if status_code >= 400
                else log_service.INFO
            )
            log_service.log_bg(
                level, log_service.API,
                f"{request.method} {path} → {status_code}",
                user_id=user_id,
                ip_address=ip_address,
                endpoint=path,
                details={"method": request.method, "status_code": status_code},
                duration_ms=duration_ms,
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_default_pricing()
    removed = log_service.cleanup_old_logs(retention_days=15)
    if removed:
        logger.info("Cleaned up %d log entries older than 15 days", removed)
    await start_worker()
    yield


app = FastAPI(title="Resume Master API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# Mount uploads directory for file serving
uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(generate.router)
app.include_router(batch_jobs.router)
app.include_router(applications.router)
app.include_router(admin.router)
app.include_router(user_settings.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
