from pydantic import BaseModel, Field, field_validator


class GenerateRequest(BaseModel):
    profile_id: str
    job_title: str = Field(max_length=300)
    company: str | None = Field(None, max_length=300)
    job_url: str | None = None
    job_description: str
    resume_type: str | None = None
    skip_duplicate_check: bool = False


class JobDescriptionEntry(BaseModel):
    job_title: str = Field(max_length=300)
    company: str | None = Field(None, max_length=300)
    job_url: str | None = None
    job_description: str
    resume_type: str | None = None
    skip_duplicate_check: bool = False


BATCH_LIMIT = 10


class BatchGenerateRequest(BaseModel):
    profile_id: str
    jobs: list[JobDescriptionEntry]

    @field_validator("jobs")
    @classmethod
    def check_batch_limit(cls, v: list) -> list:
        if len(v) > BATCH_LIMIT:
            raise ValueError(
                f"Batch size {len(v)} exceeds the maximum of {BATCH_LIMIT} applications per request."
            )
        return v


class TailoredExperience(BaseModel):
    company: str
    location: str | None = None
    title: str
    start_date: str
    end_date: str | None = None
    bullets: list[str]


class SkillCategory(BaseModel):
    category: str
    skills: list[str]


class GeneratePreview(BaseModel):
    summary: str
    skills: list[SkillCategory] = []
    tailored_experiences: list[TailoredExperience]
    cover_letter: str


class GenerateResponse(BaseModel):
    application_id: str
    profile_name: str | None = None
    job_title: str
    company: str | None = None
    preview: GeneratePreview
    resume_url: str
    cover_letter_url: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost: float = 0.0


class BatchGenerateResponse(BaseModel):
    results: list[GenerateResponse]
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_cost: float = 0.0
