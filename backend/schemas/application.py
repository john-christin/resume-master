import json
from datetime import datetime

from pydantic import BaseModel, model_validator


class ApplicationSummary(BaseModel):
    id: str
    job_title: str
    company: str | None = None
    job_url: str | None = None
    resume_type: str | None = None
    resume_path: str | None = None
    cover_letter_path: str | None = None
    profile_name: str | None = None
    location: str | None = None
    tech_stack_name: str | None = None
    user_username: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_cost: float | None = None
    call_scheduled: bool = False
    call_id: str | None = None
    call_stage: str | None = None
    call_status: str | None = None
    call_scheduled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationDetail(ApplicationSummary):
    job_description: str
    tailored_bullets: str | None = None
    cover_letter_text: str | None = None
    salary_range: str | None = None
    required_skills: list[str] = []
    # Profile snapshot fields (populated at query time)
    profile_email: str | None = None
    profile_phone: str | None = None
    profile_location: str | None = None
    profile_linkedin: str | None = None
    profile_university: str | None = None

    @model_validator(mode="before")
    @classmethod
    def parse_required_skills(cls, data):
        if hasattr(data, "__dict__"):
            raw = getattr(data, "required_skills", None)
            target = data.__dict__
        elif isinstance(data, dict):
            raw = data.get("required_skills")
            target = data
        else:
            return data

        if raw is None:
            target["required_skills"] = []
        elif isinstance(raw, str):
            try:
                target["required_skills"] = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                target["required_skills"] = []
        return data


class PaginatedApplications(BaseModel):
    items: list[ApplicationSummary]
    total: int
    page: int
    page_size: int
    total_pages: int
