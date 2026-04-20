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
    location: str | None = None
    title: str
    description: str
    start_date: str
    end_date: str | None = None


class ProfileCreate(BaseModel):
    name: str
    location: str | None = None
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []


class ProfileResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    location: str | None = None
    phone: str | None = None
    email: str | None = None
    linkedin: str | None = None
    summary: str | None = None
    educations: list[EducationSchema] = []
    experiences: list[ExperienceSchema] = []
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
