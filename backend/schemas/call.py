from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# Stage is now dynamic — validated against the call_stages table
CallStatus = Literal["scheduled", "pending", "passed", "failed", "cancelled"]
CallType = Literal["video", "phone"]


class CallCreate(BaseModel):
    application_id: str
    stage: str
    status: CallStatus = "scheduled"
    scheduled_at: datetime | None = None
    recording_link: str | None = None
    with_whom: str | None = None
    interviewer_role: str | None = None
    call_type: CallType | None = None
    call_link: str | None = None
    additional_note: str | None = None


class CallUpdate(BaseModel):
    stage: str | None = None
    status: CallStatus | None = None
    scheduled_at: datetime | None = None
    recording_link: str | None = None
    with_whom: str | None = None
    interviewer_role: str | None = None
    call_type: CallType | None = None
    call_link: str | None = None
    additional_note: str | None = None
    is_closed: bool | None = None


class CallResponse(BaseModel):
    id: str
    application_id: str
    stage: str
    status: str
    scheduled_at: datetime | None = None
    recording_link: str | None = None
    with_whom: str | None = None
    interviewer_role: str | None = None
    call_type: str | None = None
    call_link: str | None = None
    additional_note: str | None = None
    stage_statuses: dict[str, dict] = {}
    is_closed: bool = False
    created_at: datetime
    updated_at: datetime
    job_title: str | None = None
    company: str | None = None
    profile_name: str | None = None
    user_username: str | None = None

    model_config = {"from_attributes": True}
