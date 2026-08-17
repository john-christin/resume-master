import asyncio
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
from database import SessionLocal, get_db
from models.ai_usage_event import AIUsageEvent
from models.application import Application
from models.banned_company import BannedCompany
from models.doc_style import DocStyle
from models.knowledge_base import KnowledgeBase
from models.profile import Profile
from models.profile_share import profile_shares
from models.user import User
from schemas.doc_style import StyleConfig
from schemas.generate import (
    BatchGenerateRequest,
    BatchGenerateResponse,
    BannedCompanyCheckRequest,
    BannedCompanyCheckResponse,
    BannedCompanyMatch,
    ClearanceCheckRequest,
    ClearanceCheckResponse,
    CompanyCheckRequest,
    CompanyCheckResponse,
    CompanyMatch,
    ExistingApplicationInfo,
    GeneratePreview,
    GenerateRequest,
    GenerateResponse,
    SkillCategory,
    TailoredExperience,
)
from services import ai_service, docx_service, log_service
from services.pdf_service import convert_to_pdf

router = APIRouter(tags=["generate"])

_bidder_or_admin = require_role("admin", "bidder")


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
    company: str | None,
    job_url: str | None,
    job_description: str,
    resume_type: str | None,
    current_user: User,
    db: Session,
) -> GenerateResponse:
    """Core generation logic for a single job description."""
    total_prompt = 0
    total_completion = 0

    company = company.strip() if company else None

    clearance_result = _check_clearance_for_profile(profile, job_description)
    if not clearance_result.allowed:
        raise HTTPException(status_code=422, detail=clearance_result.reason)

    if company:
        banned_matches = _find_banned_matches([company], db)
        if banned_matches:
            m = banned_matches[0]
            reason = m.description or f'"{m.banned_name}" is on the banned companies list.'
            raise HTTPException(status_code=422, detail=reason)


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
            "title": exp.title,
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

    # Load active knowledge bases — all active entries apply globally now
    # that tech-stack scoping has been removed.
    active_kbs = db.scalars(
        select(KnowledgeBase).where(KnowledgeBase.is_active.is_(True))
    ).all()
    kb_parts = [f"### {kb.name}\n{kb.content}" for kb in active_kbs]

    # Profile-level prompt is always appended last so it takes precedence
    if profile.custom_prompt:
        kb_parts.append(f"### Profile Instructions\n{profile.custom_prompt}")

    kb_content = "\n\n".join(kb_parts) if kb_parts else None

    creativity_factor = getattr(profile, "creativity_factor", 0.3)

    # JD extraction runs first — the resume-bullet writer needs its
    # required_skills as an input, so it can no longer run fully concurrently
    # with the other three calls the way the old "reword existing bullets"
    # flow did.
    try:
        jd_info = await asyncio.to_thread(ai_service.extract_jd_info, job_description)
        required_skills = jd_info.get("required_skills") or []

        # Tailor (web-search-grounded) resume + generate summary/skills + cover letter concurrently
        (tailored, resume_usage), (content_result, content_usage), (cover_letter_text, cl_usage) = await asyncio.gather(
            asyncio.to_thread(
                ai_service.tailor_resume,
                user_name=profile.name,
                experiences=experiences,
                job_description=job_description,
                job_title=job_title,
                company=company,
                required_skills=required_skills,
                knowledge_base=kb_content,
                creativity_factor=creativity_factor,
                profile_id=profile.id,
            ),
            asyncio.to_thread(
                ai_service.generate_resume_content,
                user_name=profile.name,
                email=profile.email,
                phone=profile.phone,
                experiences=experiences,
                job_description=job_description,
                job_title=job_title,
                company=company,
                knowledge_base=kb_content,
                creativity_factor=creativity_factor,
                profile_id=profile.id,
            ),
            asyncio.to_thread(
                ai_service.generate_cover_letter,
                user_name=profile.name,
                email=profile.email,
                phone=profile.phone,
                experiences=experiences,
                job_description=job_description,
                job_title=job_title,
                company=company,
                knowledge_base=kb_content,
                creativity_factor=creativity_factor,
            ),
        )
    except Exception as e:
        log_service.log_bg(
            log_service.ERROR, log_service.GENERATION,
            f"AI generation failed for '{job_title}' at '{company or 'unknown'}'",
            user_id=current_user.id,
            details={
                "profile_id": profile.id,
                "job_title": job_title,
                "company": company,
                "jd_snippet": job_description[:300],
            },
            **log_service.exc_to_log_kwargs(e),
        )
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")
    jd_usage = jd_info.get("usage", {})
    total_prompt += resume_usage["prompt_tokens"] + content_usage["prompt_tokens"] + cl_usage["prompt_tokens"] + jd_usage.get("prompt_tokens", 0)
    total_completion += resume_usage["completion_tokens"] + content_usage["completion_tokens"] + cl_usage["completion_tokens"] + jd_usage.get("completion_tokens", 0)
    summary_text = content_result["summary"]
    skills_data = content_result.get("skills", [])

    # Cost is the sum of what each call already computed for itself at the
    # model it actually ran on — not a single blended price applied after
    # the fact (see ai_service._call_llm).
    usage_parts = [
        ("tailor_resume", "resume", resume_usage),
        ("resume_content", "resume", content_usage),
        ("cover_letter", "cover_letter", cl_usage),
        ("jd_extraction", "jd_parse", jd_usage),
    ]
    cost = sum(u.get("cost", 0.0) for _, _, u in usage_parts)

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
        salary_range=jd_info.get("salary_range"),
        required_skills=json.dumps(jd_info.get("required_skills") or []),
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        total_cost=cost,
    )
    db.add(application)
    db.flush()

    for part, role, usage in usage_parts:
        if not usage.get("provider"):
            continue  # call never actually ran (e.g. JD parse failed before billing)
        db.add(AIUsageEvent(
            application_id=application.id,
            user_id=current_user.id,
            role=role,
            part=part,
            provider=usage["provider"],
            model_id=usage["model_id"],
            ai_model_config_id=usage.get("model_config_id"),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            input_price_per_1k=usage.get("input_price_per_1k", 0.0),
            output_price_per_1k=usage.get("output_price_per_1k", 0.0),
            cost=usage.get("cost", 0.0),
        ))

    # Load doc style for this profile
    doc_style: StyleConfig | None = None
    if profile.doc_style_id:
        style_row = db.get(DocStyle, profile.doc_style_id)
        if style_row:
            doc_style = StyleConfig(**json.loads(style_row.config))
    if doc_style is None:
        # Fall back to the first system style if one exists
        default_row = db.scalars(
            select(DocStyle).where(DocStyle.is_system.is_(True))
        ).first()
        if default_row:
            doc_style = StyleConfig(**json.loads(default_row.config))

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
        skills=skills_data if profile.show_skills else None,
        educations=educations,
        tailored_experiences=tailored,
        output_path=resume_docx,
        style=doc_style,
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
    except RuntimeError as exc:
        resume_pdf = None
        cover_letter_pdf = None
        log_service.log_bg(
            log_service.WARNING, log_service.GENERATION,
            "PDF conversion failed — falling back to DOCX",
            user_id=current_user.id,
            details={"application_id": application.id, "job_title": job_title},
            **log_service.exc_to_log_kwargs(exc),
        )

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

    log_service.log_bg(
        log_service.INFO, log_service.GENERATION,
        f"Generation succeeded for '{job_title}' at '{company or 'unknown'}'",
        user_id=current_user.id,
        details={
            "application_id": application.id,
            "profile_id": profile.id,
            "job_title": job_title,
            "company": company,
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "cost": cost,
        },
    )

    return GenerateResponse(
        application_id=application.id,
        profile_name=profile.name,
        job_title=job_title,
        company=company,
        preview=preview,
        resume_url=f"/api/download/{application.id}_resume.pdf",
        cover_letter_url=f"/api/download/{application.id}_cover_letter.pdf",
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        cost=cost,
    )


def _company_name_similar(a: str, b: str) -> bool:
    """True if the two company names are an exact match or one contains the other."""
    a = a.lower().strip()
    b = b.lower().strip()
    return a == b or a in b or b in a


@router.post("/api/generate/check-companies", response_model=CompanyCheckResponse)
async def check_company_duplicates(
    req: CompanyCheckRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    """Return previous applications that share a similar company name.

    Only checks company-name similarity (exact or substring match).
    Does not inspect job descriptions or use AI. The caller decides
    whether to proceed.
    """
    profile = _get_accessible_profile(req.profile_id, current_user, db)

    existing_apps = db.scalars(
        select(Application)
        .where(Application.profile_id == profile.id)
        .order_by(Application.created_at.desc())
    ).all()

    seen: set[str] = set()
    matches: list[CompanyMatch] = []

    for new_company in req.companies:
        if not new_company or not new_company.strip():
            continue
        key = new_company.lower().strip()
        if key in seen:
            continue
        seen.add(key)

        matched: list[ExistingApplicationInfo] = []
        for app in existing_apps:
            if app.company and _company_name_similar(new_company, app.company):
                matched.append(
                    ExistingApplicationInfo(
                        id=str(app.id),
                        job_title=app.job_title,
                        company=app.company,
                        created_at=app.created_at,
                    )
                )

        if matched:
            matches.append(CompanyMatch(company=new_company, existing_applications=matched))

    return CompanyCheckResponse(matches=matches)


_CLEARANCE_LEVELS: dict[str, int] = {
    "None": 0,
    "PublicTrust": 1,
    "Secret": 2,
    "TopSecret": 3,
    "TSSCI": 4,
}

_CLEARANCE_PATTERNS: list[tuple[str, list[str]]] = [
    ("TSSCI", [r"ts/sci", r"top secret/sci", r"ts-sci", r"sensitive compartmented"]),
    ("TopSecret", [r"top secret", r"\bts\b clearance", r"top-secret"]),
    ("Secret", [r"\bsecret clearance\b", r"active secret", r"requires secret", r"hold(s|ing)? a secret", r"\bsecret\b.{0,20}clearance"]),
    ("PublicTrust", [r"public trust"]),
]


def _detect_required_clearance(job_description: str) -> str | None:
    """Return the highest clearance level found in the job description, or None."""
    import re
    text = job_description.lower()
    for level, patterns in _CLEARANCE_PATTERNS:
        for pat in patterns:
            if re.search(pat, text):
                return level
    return None


def _clearance_level(name: str | None) -> int:
    return _CLEARANCE_LEVELS.get(name or "None", 0)


def _check_clearance_for_profile(profile: "Profile", job_description: str) -> ClearanceCheckResponse:
    """Return whether this job is allowed based on profile clearance settings."""
    if not profile.check_clearance:
        return ClearanceCheckResponse(allowed=True)

    detected = _detect_required_clearance(job_description)
    if not detected:
        return ClearanceCheckResponse(allowed=True, detected_clearance=None)

    profile_level = _clearance_level(profile.security_clearance)
    required_level = _clearance_level(detected)

    if profile_level >= required_level:
        return ClearanceCheckResponse(allowed=True, detected_clearance=detected)

    clearance_label = {
        "TSSCI": "TS/SCI",
        "TopSecret": "Top Secret",
        "Secret": "Secret",
        "PublicTrust": "Public Trust",
    }.get(detected, detected)
    profile_label = {
        "TSSCI": "TS/SCI",
        "TopSecret": "Top Secret",
        "Secret": "Secret",
        "PublicTrust": "Public Trust",
        "None": "None",
    }.get(profile.security_clearance or "None", profile.security_clearance or "None")

    return ClearanceCheckResponse(
        allowed=False,
        detected_clearance=detected,
        reason=f"This job requires {clearance_label} clearance, but your profile clearance is {profile_label}.",
    )


@router.post("/api/generate/check-clearance", response_model=ClearanceCheckResponse)
async def check_clearance(
    req: ClearanceCheckRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)
    return _check_clearance_for_profile(profile, req.job_description)


def _find_duplicate_bids(
    user_id: str,
    profile_id: str,
    jobs: list[tuple[str | None, str]],
    db: Session,
) -> list[tuple[str, str]]:
    """Return (company, job_title) pairs already applied to under this profile.

    Scoped to (user_id, profile_id) — the same job on a different profile is
    not a duplicate. Only checks entries where company is non-empty.
    """
    duplicates: list[tuple[str, str]] = []
    for company, job_title in jobs:
        if not company or not company.strip():
            continue
        existing = db.scalars(
            select(Application).where(
                Application.user_id == user_id,
                Application.profile_id == profile_id,
                Application.company.ilike(company.strip()),
                Application.job_title.ilike(job_title.strip()),
            )
        ).first()
        if existing:
            duplicates.append((company.strip(), job_title.strip()))
    return duplicates


def _find_banned_matches(companies: list[str], db: Session) -> list[BannedCompanyMatch]:
    """Return a BannedCompanyMatch for each input company that hits the banned list."""
    all_banned = db.scalars(select(BannedCompany)).all()
    matches: list[BannedCompanyMatch] = []
    for company in companies:
        if not company or not company.strip():
            continue
        key = company.lower().strip()
        for banned in all_banned:
            banned_key = banned.name.lower().strip()
            if key == banned_key or key in banned_key or banned_key in key:
                matches.append(
                    BannedCompanyMatch(
                        company=company,
                        banned_name=banned.name,
                        description=banned.description,
                    )
                )
                break
    return matches


@router.post("/api/generate/check-banned-companies", response_model=BannedCompanyCheckResponse)
async def check_banned_companies(
    req: BannedCompanyCheckRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    matches = _find_banned_matches(req.companies, db)
    return BannedCompanyCheckResponse(matches=matches)


@router.post("/api/generate", response_model=GenerateResponse)
async def generate_application(
    req: GenerateRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)
    if current_user.role != "admin":
        dupes = _find_duplicate_bids(
            current_user.id, profile.id, [(req.company, req.job_title)], db
        )
        if dupes:
            company, title = dupes[0]
            raise HTTPException(
                status_code=409,
                detail=f'You already have an application for "{title}" at "{company}". Duplicate bids are not allowed.',
            )
    return await _generate_single(
        profile=profile,
        job_title=req.job_title,
        company=req.company,
        job_url=req.job_url,
        job_description=req.job_description,
        resume_type=req.resume_type,
        current_user=current_user,
        db=db,
    )


@router.post("/api/generate/batch", response_model=BatchGenerateResponse)
async def batch_generate(
    req: BatchGenerateRequest,
    current_user: User = Depends(_bidder_or_admin),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)
    if current_user.role != "admin":
        dupes = _find_duplicate_bids(
            current_user.id,
            profile.id,
            [(job.company, job.job_title) for job in req.jobs],
            db,
        )
        if dupes:
            labels = ", ".join(f'"{t}" at "{c}"' for c, t in dupes)
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate bids detected — already applied to: {labels}. Remove them and try again.",
            )
    profile_id = profile.id
    user_id = current_user.id

    async def run_job(job) -> GenerateResponse:
        # Each job needs its own session — concurrent writes to a shared
        # session cause flush/commit conflicts.
        job_db = SessionLocal()
        try:
            job_profile = job_db.get(Profile, profile_id)
            job_user = job_db.get(User, user_id)
            return await _generate_single(
                profile=job_profile,
                job_title=job.job_title,
                company=job.company,
                job_url=job.job_url,
                job_description=job.job_description,
                resume_type=job.resume_type,
                current_user=job_user,
                db=job_db,
            )
        finally:
            job_db.close()

    results = list(await asyncio.gather(*[run_job(job) for job in req.jobs]))

    return BatchGenerateResponse(
        results=results,
        total_prompt_tokens=sum(r.prompt_tokens for r in results),
        total_completion_tokens=sum(r.completion_tokens for r in results),
        total_cost=sum(r.cost for r in results),
    )


@router.get("/api/download/{filename}")
def download_file(filename: str, name: str | None = None):
    file_path = Path(settings.upload_dir) / filename
    if not file_path.exists():
        docx_fallback = file_path.with_suffix(".docx")
        if docx_fallback.exists():
            file_path = docx_fallback
        else:
            raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(file_path),
        filename=name or filename,
        media_type="application/octet-stream",
    )
