from datetime import datetime

from pydantic import BaseModel, field_validator


class CallStageCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Stage name cannot be empty")
        return v


class CallStageUpdate(BaseModel):
    name: str | None = None
    order: int | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Stage name cannot be empty")
        return v


class CallStageReorder(BaseModel):
    ordered_ids: list[str]


class CallStageResponse(BaseModel):
    id: str
    name: str
    value: str
    order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
