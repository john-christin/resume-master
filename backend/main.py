import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from config import settings
from database import SessionLocal
from models.token_pricing import TokenPricing
from routers import admin, applications, auth, generate, profile, user_settings

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_default_pricing()
    yield


app = FastAPI(title="Resume Master API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for file serving
uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(generate.router)
app.include_router(applications.router)
app.include_router(admin.router)
app.include_router(user_settings.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
