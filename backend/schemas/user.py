from datetime import datetime

from pydantic import BaseModel


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
    description: str
    start_date: str
    end_date: str | None = None


class ProfileCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []


class ProfileResponse(BaseModel):
    id: str
    name: str
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []
    created_at: datetime

    model_config = {"from_attributes": True}
