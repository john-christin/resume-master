import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class StyleConfig(BaseModel):
    font_name: str = "Calibri"
    font_size_name: float = 16
    font_size_section: float = 10
    font_size_body: float = 9.5
    font_size_contact: float = 9
    header_layout: str = "centered"       # "centered" | "left"
    accent_color: str = "000000"          # hex without #
    section_separator: str = "line"       # "line" | "thick_line" | "double_line" | "none"
    name_bold: bool = True
    name_uppercase: bool = True
    section_caps: bool = False
    margin_top: float = 0.5
    margin_bottom: float = 0.5
    margin_left: float = 0.5
    margin_right: float = 0.5
    space_before_section: float = 4
    space_after_section: float = 3
    name_color: str = "000000"          # hex color for the header name
    line_spacing: float = 1.0           # paragraph line height multiplier
    section_bold: bool = True           # bold section headings
    bullet_char: str = "•"             # bullet point character
    contact_separator: str = "|"        # separator between contact items


class DocStyleCreate(BaseModel):
    name: str
    description: str | None = None
    config: StyleConfig


class DocStyleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: StyleConfig | None = None


class DocStyleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_system: bool
    config: StyleConfig
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v
