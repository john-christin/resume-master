import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_approved_user, get_current_user
from database import get_db
from models.ai_model_config import AIModelConfig
from models.ai_usage_event import AIUsageEvent
from models.application import Application
from models.chat_message import ChatMessage
from models.user import User
from prompts import CHAT_INTERVIEW_PREP
from services import ai_service
from .generate import _get_accessible_profile

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessageIn(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    profile_id: str
    job_title: str | None = None
    company: str | None = None
    job_description: str | None = None
    messages: list[ChatMessageIn]


class ChatResponse(BaseModel):
    message: str
    prompt_tokens: int
    completion_tokens: int


# ── Application-scoped chat schemas ────────────────────────────────────────────

class AppChatMessage(BaseModel):
    id: str
    application_id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class AppChatHistory(BaseModel):
    messages: list[AppChatMessage]


class ActiveModelItem(BaseModel):
    id: str
    display_name: str
    provider: str
    model_id: str


class AppChatSendRequest(BaseModel):
    content: str
    model_config_id: str | None = None


class AppChatSendResponse(BaseModel):
    message: AppChatMessage
    prompt_tokens: int
    completion_tokens: int


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_own_application(app_id: str, user: User, db: Session) -> Application:
    app = db.scalars(select(Application).where(Application.id == app_id)).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.user_id != user.id and user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Access denied")
    return app


def _build_system_prompt(app: Application, db: Session) -> str:
    if app.profile_id:
        try:
            # Reuse the profile loading logic from generate router
            from .generate import _get_accessible_profile
            # We need a user mock — since we already verified ownership, load directly
            from models.profile import Profile
            profile = db.scalars(select(Profile).where(Profile.id == app.profile_id)).first()
        except Exception:
            profile = None
    else:
        profile = None

    # Prefer this application's own AI-authored, company/role-grounded
    # bullets over the profile's bare company+title+dates — the tailored
    # bullets are already exactly what's on the generated resume for this job.
    tailored = None
    if app.tailored_bullets:
        try:
            tailored = json.loads(app.tailored_bullets)
        except (ValueError, TypeError):
            tailored = None

    if tailored:
        exp_lines = []
        for exp in tailored:
            dates = f"{exp.get('start_date', '')} – {exp.get('end_date') or 'Present'}"
            exp_lines.append(f"- {exp.get('title', '')} at {exp.get('company', '')} ({dates})")
            for bullet in exp.get("bullets", []):
                exp_lines.append(f"  - {bullet}")
        experiences_text = "\n".join(exp_lines) or "None listed."
    elif profile:
        exp_lines = []
        for exp in profile.experiences:
            dates = f"{exp.start_date or ''} – {exp.end_date or 'Present'}"
            exp_lines.append(f"- {exp.title} at {exp.company} ({dates})")
        experiences_text = "\n".join(exp_lines) or "None listed."
    else:
        experiences_text = "Not available."

    if profile:
        edu_lines = []
        for edu in profile.educations:
            parts = " ".join(filter(None, [edu.degree, edu.field]))
            edu_lines.append(f"- {parts} — {edu.school} ({edu.end_date or ''})")
        educations_text = "\n".join(edu_lines) or "None listed."
        candidate_name = profile.name
    else:
        educations_text = "Not available."
        candidate_name = app.profile_name or "Candidate"

    return CHAT_INTERVIEW_PREP.format(
        name=candidate_name,
        experiences=experiences_text,
        educations=educations_text,
        job_title=app.job_title or "Not specified",
        company=app.company or "Not specified",
        job_description=(app.job_description or "Not provided")[:3000],
    )


# ── Active models listing (for model picker) ──────────────────────────────────

@router.get("/models/active", response_model=list[ActiveModelItem])
def list_active_models(
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    """List every configured model, for the manual per-message override picker.

    Not filtered to role-assigned models — this picker is an explicit
    bypass of the role system, so an unassigned model should still be
    selectable here.
    """
    models = db.scalars(
        select(AIModelConfig).order_by(AIModelConfig.created_at)
    ).all()
    return [
        ActiveModelItem(
            id=m.id,
            display_name=m.display_name,
            provider=m.provider,
            model_id=m.model_id,
        )
        for m in models
    ]


# ── Application-scoped chat endpoints ─────────────────────────────────────────

@router.get("/applications/{app_id}/chat", response_model=AppChatHistory)
def get_application_chat(
    app_id: str,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    _get_own_application(app_id, current_user, db)
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.application_id == app_id)
        .order_by(ChatMessage.created_at)
    ).all()
    return AppChatHistory(
        messages=[
            AppChatMessage(
                id=m.id,
                application_id=m.application_id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ]
    )


@router.post("/applications/{app_id}/chat", response_model=AppChatSendResponse)
async def send_application_chat(
    app_id: str,
    req: AppChatSendRequest,
    current_user: User = Depends(get_approved_user),
    db: Session = Depends(get_db),
):
    app = _get_own_application(app_id, current_user, db)

    # Load full chat history from DB to maintain context
    history = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.application_id == app_id)
        .order_by(ChatMessage.created_at)
    ).all()

    # Persist the user message first
    user_msg = ChatMessage(
        application_id=app_id,
        role="user",
        content=req.content,
    )
    db.add(user_msg)
    db.flush()

    # Build messages list for AI call
    system_prompt = _build_system_prompt(app, db)
    ai_messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        ai_messages.append({"role": m.role, "content": m.content})
    ai_messages.append({"role": "user", "content": req.content})

    result = await asyncio.to_thread(
        ai_service._call_llm,
        ai_messages,
        512,
        0.7,
        "chat",
        req.model_config_id,
    )

    # Persist assistant response
    assistant_msg = ChatMessage(
        application_id=app_id,
        role="assistant",
        content=result.content,
    )
    db.add(assistant_msg)
    db.add(AIUsageEvent(
        application_id=app_id,
        user_id=current_user.id,
        role="chat",
        part="chat",
        provider=result.provider,
        model_id=result.model_id,
        ai_model_config_id=result.model_config_id,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        input_price_per_1k=result.input_price_per_1k,
        output_price_per_1k=result.output_price_per_1k,
        cost=result.cost,
    ))
    db.commit()
    db.refresh(assistant_msg)

    return AppChatSendResponse(
        message=AppChatMessage(
            id=assistant_msg.id,
            application_id=assistant_msg.application_id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            created_at=assistant_msg.created_at.isoformat(),
        ),
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )


# ── Generic (profile-based) chat ───────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)

    # No stored Application/tailored_bullets in this generic, pre-generation
    # endpoint — only bare company/title/dates are available as context.
    exp_lines = []
    for exp in profile.experiences:
        dates = f"{exp.start_date or ''} – {exp.end_date or 'Present'}"
        exp_lines.append(f"- {exp.title} at {exp.company} ({dates})")
    experiences_text = "\n".join(exp_lines) or "None listed."

    edu_lines = []
    for edu in profile.educations:
        parts = " ".join(filter(None, [edu.degree, edu.field]))
        edu_lines.append(f"- {parts} — {edu.school} ({edu.end_date or ''})")
    educations_text = "\n".join(edu_lines) or "None listed."

    system_prompt = CHAT_INTERVIEW_PREP.format(
        name=profile.name,
        experiences=experiences_text,
        educations=educations_text,
        job_title=req.job_title or "Not specified",
        company=req.company or "Not specified",
        job_description=(req.job_description or "Not provided")[:3000],
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.messages:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})

    result = await asyncio.to_thread(
        ai_service._call_llm,
        messages,
        512,
        0.7,
        "chat",
    )

    db.add(AIUsageEvent(
        application_id=None,
        user_id=current_user.id,
        role="chat",
        part="chat",
        provider=result.provider,
        model_id=result.model_id,
        ai_model_config_id=result.model_config_id,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        input_price_per_1k=result.input_price_per_1k,
        output_price_per_1k=result.output_price_per_1k,
        cost=result.cost,
    ))
    db.commit()

    return ChatResponse(
        message=result.content,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )
