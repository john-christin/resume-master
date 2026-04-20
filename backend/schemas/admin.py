from datetime import datetime

from pydantic import BaseModel


class UserListItem(BaseModel):
    id: str
    username: str
    role: str
    status: str
    profile_count: int = 0
    application_count: int = 0
    total_cost: float = 0.0
    created_at: datetime


class UserApproveRequest(BaseModel):
    role: str  # "admin" | "bidder" | "caller"


class ProfileStat(BaseModel):
    profile_id: str
    name: str
    application_count: int = 0
    total_cost: float = 0.0


class UserStatItem(BaseModel):
    id: str
    username: str
    role: str
    profile_count: int = 0
    application_count: int = 0
    total_cost: float = 0.0
    profiles: list[ProfileStat] = []


class UserStatsResponse(BaseModel):
    user_id: str
    username: str
    profiles: list[ProfileStat] = []
    total_cost: float = 0.0
    total_tokens: int = 0


class DashboardStats(BaseModel):
    total_users: int = 0
    pending_users: int = 0
    total_applications: int = 0
    total_cost: float = 0.0
    users: list[UserStatItem] = []


class PricingRequest(BaseModel):
    input_price_per_1k: float
    output_price_per_1k: float


class PricingResponse(BaseModel):
    id: str
    input_price_per_1k: float
    output_price_per_1k: float
    effective_from: datetime

    model_config = {"from_attributes": True}


class AIModelConfigCreate(BaseModel):
    provider: str  # "azure_openai", "openai", "anthropic", "google"
    display_name: str
    model_id: str
    api_key: str
    endpoint: str | None = None
    api_version: str | None = None
    input_price_per_1k: float = 0.0
    output_price_per_1k: float = 0.0


class AIModelConfigUpdate(BaseModel):
    display_name: str | None = None
    model_id: str | None = None
    api_key: str | None = None
    endpoint: str | None = None
    api_version: str | None = None
    input_price_per_1k: float | None = None
    output_price_per_1k: float | None = None


class AIModelConfigResponse(BaseModel):
    id: str
    provider: str
    display_name: str
    model_id: str
    api_key_set: bool  # mask the actual key
    endpoint: str | None = None
    api_version: str | None = None
    input_price_per_1k: float = 0.0
    output_price_per_1k: float = 0.0
    is_active: bool
    role: str | None = None  # "primary" | "utility" | None
    created_at: datetime
    updated_at: datetime | None = None


class ActivateModelRequest(BaseModel):
    role: str = "primary"  # "primary" | "utility"


class KnowledgeBaseCreate(BaseModel):
    name: str
    content: str


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    is_active: bool | None = None


class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    content: str
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
