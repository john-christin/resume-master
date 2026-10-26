from datetime import datetime

from pydantic import BaseModel, field_validator


class EducationSchema(BaseModel):
    id: str | None = None
    school: str
    degree: str
    field: str
    gpa: str | None = None
    start_date: str
    end_date: str | None = None


class ExperienceSchema(BaseModel):
    id: str | None = None
    company: str
    title: str
    start_date: str
    end_date: str | None = None
    description: str | None = None


class CertificationSchema(BaseModel):
    id: str | None = None
    name: str
    issuer: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None


class CustomSectionSchema(BaseModel):
    title: str
    items: list[str] = []


class ProfileCreate(BaseModel):
    name: str
    location: str | None = None
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    creativity_factor: float = 0.7
    custom_prompt: str | None = None
    doc_style_id: str | None = None
    show_skills: bool = True
    use_global_kb: bool = True
    check_clearance: bool = False
    security_clearance: str | None = None
    job_sheet_url: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []
    certifications: list[CertificationSchema] = []
    custom_sections: list[CustomSectionSchema] = []

    @field_validator("job_sheet_url")
    @classmethod
    def _check_sheet_url(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        from services.sheet_service import SheetError, parse_sheet_url

        try:
            parse_sheet_url(v)
        except SheetError as exc:
            raise ValueError(str(exc))
        return v


class ProfileResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    location: str | None = None
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    creativity_factor: float = 0.7
    custom_prompt: str | None = None
    doc_style_id: str | None = None
    show_skills: bool = True
    use_global_kb: bool = True
    check_clearance: bool = False
    security_clearance: str | None = None
    job_sheet_url: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []
    certifications: list[CertificationSchema] = []
    custom_sections: list[CustomSectionSchema] = []
    is_owner: bool = False
    is_shared: bool = False
    owner_username: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileShareRequest(BaseModel):
    user_ids: list[str]


class ProfileShareUser(BaseModel):
    user_id: str
    username: str
    shared_at: datetime | None = None


class UserSearchResult(BaseModel):
    id: str
    username: str
