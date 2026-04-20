from datetime import datetime

from pydantic import BaseModel


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
    user_username: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_cost: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationDetail(ApplicationSummary):
    job_description: str
    tailored_bullets: str | None = None
    cover_letter_text: str | None = None


class PaginatedApplications(BaseModel):
    items: list[ApplicationSummary]
    total: int
    page: int
    page_size: int
    total_pages: int
