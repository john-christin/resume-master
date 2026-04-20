import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import require_role
from config import settings
from database import get_db
from models.ai_model_config import AIModelConfig
from models.application import Application
from models.knowledge_base import KnowledgeBase
from models.profile import Profile
from models.profile_share import profile_shares
from models.token_pricing import TokenPricing
from models.user import User
from schemas.generate import (
    BatchGenerateRequest,
    BatchGenerateResponse,
    GeneratePreview,
    GenerateRequest,
    GenerateResponse,
    SkillCategory,
    TailoredExperience,
)
from services import ai_service, docx_service
from services.pdf_service import convert_to_pdf

router = APIRouter(tags=["generate"])

_bidder_or_admin = require_role("admin", "bidder")


def _get_current_pricing(db: Session) -> tuple[float, float]:
    """Return (input_price_per_1k, output_price_per_1k).

    Uses primary model pricing first, then any active model, falls back
    to global TokenPricing.
    """
    # Check primary model pricing first (bulk of tokens)
    primary = db.scalars(
        select(AIModelConfig).where(
            AIModelConfig.is_active.is_(True),
            AIModelConfig.role == "primary",
        )
    ).first()
    if primary and (
        primary.input_price_per_1k > 0 or primary.output_price_per_1k > 0
    ):
        return primary.input_price_per_1k, primary.output_price_per_1k

    # Fallback: any active model
    active_model = db.scalars(
        select(AIModelConfig).where(AIModelConfig.is_active.is_(True))
    ).first()
    if active_model and (
        active_model.input_price_per_1k > 0
        or active_model.output_price_per_1k > 0
    ):
        return active_model.input_price_per_1k, active_model.output_price_per_1k

    # Fall back to global pricing
    pricing = db.scalars(
        select(TokenPricing).order_by(TokenPricing.effective_from.desc())
    ).first()
    if not pricing:
        return 0.0, 0.0
    return pricing.input_price_per_1k, pricing.output_price_per_1k


def _calculate_cost(
    prompt_tokens: int, completion_tokens: int, db: Session
) -> float:
    input_price, output_price = _get_current_pricing(db)
    return (prompt_tokens / 1000 * input_price) + (
        completion_tokens / 1000 * output_price
    )


def _get_accessible_profile(
    profile_id: str, user: User, db: Session
) -> Profile:
    """Load profile, verify user has access (owner or shared)."""
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


async def _generate_single(
    profile: Profile,
    job_title: str,
    job_url: str | None,
    job_description: str,
    resume_type: str | None,
    current_user: User,
    db: Session,
    skip_duplicate_check: bool = False,
) -> GenerateResponse:
    """Core generation logic for a single job description."""
    total_prompt = 0
    total_completion = 0

    # Extract company from JD
    company, extract_usage = ai_service.extract_company_name_with_usage(
        job_description
    )
    total_prompt += extract_usage["prompt_tokens"]
    total_completion += extract_usage["completion_tokens"]

    # Duplicate check: find previous applications for same profile + company
    if not skip_duplicate_check and company:
        existing_apps = db.scalars(
            select(Application)
            .where(
                Application.profile_id == profile.id,
                Application.company.ilike(company),
            )
            .order_by(Application.created_at.desc())
        ).all()

        for prev_app in existing_apps:
            similarity = ai_service.text_similarity(
                job_description, prev_app.job_description
            )
            if similarity > 0.9:
                # High similarity — definitely a duplicate
                raise HTTPException(
                    status_code=409,
                    detail={
                        "duplicate": True,
                        "similarity": round(similarity, 2),
                        "existing_application": {
                            "id": prev_app.id,
                            "job_title": prev_app.job_title,
                            "company": prev_app.company,
                            "created_at": prev_app.created_at.isoformat(),
                        },
                    },
                )
            if similarity > 0.6:
                # Ambiguous — use AI to confirm
                is_same, ai_usage = ai_service.ai_check_same_role(
                    job_description, prev_app.job_description
                )
                total_prompt += ai_usage["prompt_tokens"]
                total_completion += ai_usage["completion_tokens"]
                if is_same:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "duplicate": True,
                            "similarity": round(similarity, 2),
                            "existing_application": {
                                "id": prev_app.id,
                                "job_title": prev_app.job_title,
                                "company": prev_app.company,
                                "created_at": prev_app.created_at.isoformat(),
                            },
                        },
                    )

    # Cross-profile reference: find similar applications from other profiles
    reference_bullets = None
    if company:
        cross_profile_app = db.scalars(
            select(Application)
            .where(
                Application.company.ilike(company),
                Application.profile_id != profile.id,
                Application.tailored_bullets.isnot(None),
            )
            .order_by(Application.created_at.desc())
        ).first()

        if cross_profile_app:
            similarity = ai_service.text_similarity(
                job_description, cross_profile_app.job_description
            )
            if similarity > 0.6:
                try:
                    reference_bullets = json.loads(
                        cross_profile_app.tailored_bullets
                    )
                except (json.JSONDecodeError, TypeError):
                    reference_bullets = None

    # Extract job location / work mode from JD
    job_location, loc_usage = ai_service.extract_job_location_with_usage(
        job_description
    )
    total_prompt += loc_usage["prompt_tokens"]
    total_completion += loc_usage["completion_tokens"]

    # Prepare profile data
    experiences = [
        {
            "company": exp.company,
            "location": exp.location,
            "title": exp.title,
            "description": exp.description,
            "start_date": exp.start_date,
            "end_date": exp.end_date,
        }
        for exp in profile.experiences
    ]
    educations = [
        {
            "school": edu.school,
            "degree": edu.degree,
            "field": edu.field,
            "gpa": edu.gpa,
            "start_date": edu.start_date,
            "end_date": edu.end_date,
        }
        for edu in profile.educations
    ]

    # Load active knowledge bases
    active_kbs = db.scalars(
        select(KnowledgeBase).where(KnowledgeBase.is_active.is_(True))
    ).all()
    kb_content = (
        "\n\n".join(f"### {kb.name}\n{kb.content}" for kb in active_kbs)
        if active_kbs
        else None
    )

    # Tailor resume
    try:
        tailored, resume_usage = ai_service.tailor_resume(
            user_name=profile.name,
            experiences=experiences,
            educations=educations,
            job_description=job_description,
            job_title=job_title,
            company=company,
            reference_bullets=reference_bullets,
            knowledge_base=kb_content,
        )
        total_prompt += resume_usage["prompt_tokens"]
        total_completion += resume_usage["completion_tokens"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    # Generate summary, skills, and cover letter in a single AI call
    try:
        content_result, content_usage = ai_service.generate_resume_content(
            user_name=profile.name,
            email=profile.email,
            phone=profile.phone,
            experiences=experiences,
            job_description=job_description,
            job_title=job_title,
            company=company,
            knowledge_base=kb_content,
        )
        total_prompt += content_usage["prompt_tokens"]
        total_completion += content_usage["completion_tokens"]
        summary_text = content_result["summary"]
        skills_data = content_result.get("skills", [])
        cover_letter_text = content_result["cover_letter"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    # Calculate cost
    cost = _calculate_cost(total_prompt, total_completion, db)

    # Create application record
    application = Application(
        user_id=current_user.id,
        profile_id=profile.id,
        profile_name=profile.name,
        job_title=job_title,
        company=company or "",
        location=job_location,
        job_url=job_url,
        job_description=job_description,
        resume_type=resume_type,
        tailored_bullets=json.dumps(tailored),
        cover_letter_text=cover_letter_text,
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        total_cost=cost,
    )
    db.add(application)
    db.flush()

    # Generate DOCX files
    uploads_dir = Path(settings.upload_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    resume_docx = uploads_dir / f"{application.id}_resume.docx"
    cover_letter_docx = uploads_dir / f"{application.id}_cover_letter.docx"

    docx_service.create_resume(
        user_name=profile.name,
        location=profile.location,
        email=profile.email,
        phone=profile.phone,
        linkedin=profile.linkedin,
        summary=summary_text,
        skills=skills_data or None,
        educations=educations,
        tailored_experiences=tailored,
        output_path=resume_docx,
    )

    docx_service.create_cover_letter(
        user_name=profile.name,
        email=profile.email,
        phone=profile.phone,
        cover_letter_text=cover_letter_text,
        job_title=job_title,
        company=company,
        output_path=cover_letter_docx,
    )

    # Convert to PDF
    try:
        resume_pdf = await convert_to_pdf(resume_docx, uploads_dir)
        cover_letter_pdf = await convert_to_pdf(cover_letter_docx, uploads_dir)
    except RuntimeError:
        resume_pdf = None
        cover_letter_pdf = None

    application.resume_path = str(resume_pdf or resume_docx)
    application.cover_letter_path = str(cover_letter_pdf or cover_letter_docx)
    db.commit()
    db.refresh(application)

    preview = GeneratePreview(
        summary=summary_text,
        skills=[SkillCategory(**s) for s in skills_data],
        tailored_experiences=[
            TailoredExperience(**exp) for exp in tailored
        ],
        cover_letter=cover_letter_text,
    )

    return GenerateResponse(
        application_id=application.id,
        preview=preview,
        resume_url=f"/api/download/{application.id}_resume.pdf",
        cover_letter_url=f"/api/download/{application.id}_cover_letter.pdf",
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        cost=cost,
    )


@router.post("/api/generate", response_model=GenerateResponse)
async def generate_application(
    req: GenerateRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)
    return await _generate_single(
        profile=profile,
        job_title=req.job_title,
        job_url=req.job_url,
        job_description=req.job_description,
        resume_type=req.resume_type,
        current_user=current_user,
        db=db,
        skip_duplicate_check=req.skip_duplicate_check,
    )


@router.post("/api/generate/batch", response_model=BatchGenerateResponse)
async def batch_generate(
    req: BatchGenerateRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)

    results = []
    total_prompt = 0
    total_completion = 0
    total_cost = 0.0

    for job in req.jobs:
        result = await _generate_single(
            profile=profile,
            job_title=job.job_title,
            job_url=job.job_url,
            job_description=job.job_description,
            resume_type=job.resume_type,
            current_user=current_user,
            db=db,
            skip_duplicate_check=job.skip_duplicate_check,
        )
        results.append(result)
        total_prompt += result.prompt_tokens
        total_completion += result.completion_tokens
        total_cost += result.cost

    return BatchGenerateResponse(
        results=results,
        total_prompt_tokens=total_prompt,
        total_completion_tokens=total_completion,
        total_cost=total_cost,
    )


@router.get("/api/download/{filename}")
def download_file(filename: str):
    file_path = Path(settings.upload_dir) / filename
    if not file_path.exists():
        docx_fallback = file_path.with_suffix(".docx")
        if docx_fallback.exists():
            file_path = docx_fallback
        else:
            raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )
