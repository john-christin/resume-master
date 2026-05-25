import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from auth import get_current_user
from services import ai_service
from .generate import _get_accessible_profile

router = APIRouter(prefix="/api", tags=["chat"])

_SYSTEM_PROMPT = """\
You are a helpful career assistant helping a job applicant answer interview \
and application questions. Answer concisely (1–4 sentences unless asked for more), \
write in first person as the candidate, and use only experience that is listed below. \
For behavioral questions use a brief STAR format.

## Candidate: {name}

### Work Experience
{experiences}

### Education
{educations}

## Target Role
Position: {job_title}
Company: {company}

## Job Description
{job_description}
"""


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


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_accessible_profile(req.profile_id, current_user, db)

    exp_lines = []
    for exp in profile.experiences:
        dates = f"{exp.start_date or ''} – {exp.end_date or 'Present'}"
        desc = f": {exp.description}" if exp.description else ""
        exp_lines.append(f"- {exp.title} at {exp.company} ({dates}){desc}")
    experiences_text = "\n".join(exp_lines) or "None listed."

    edu_lines = []
    for edu in profile.educations:
        parts = " ".join(filter(None, [edu.degree, edu.field]))
        edu_lines.append(f"- {parts} — {edu.school} ({edu.end_date or ''})")
    educations_text = "\n".join(edu_lines) or "None listed."

    system_prompt = _SYSTEM_PROMPT.format(
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
        "utility",
    )

    return ChatResponse(
        message=result.content,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )
