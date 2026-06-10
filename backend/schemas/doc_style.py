import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SectionItem(BaseModel):
    key: str          # "summary" | "skills" | "experience" | "education"
    visible: bool = True


class StyleConfig(BaseModel):
    font_name: str = "Calibri"
    font_size_name: float = 16
    font_size_section: float = 10
    font_size_body: float = 9.5
    font_size_contact: float = 9
    header_layout: str = "centered"       # "centered" | "left"
    accent_color: str = "000000"          # hex without # (kept for backward compat)
    section_separator: str = "line"       # deprecated — prefer section_heading_style
    name_bold: bool = True
    name_uppercase: bool = True
    section_caps: bool = False
    margin_top: float = 0.5
    margin_bottom: float = 0.5
    margin_left: float = 0.5
    margin_right: float = 0.5
    space_before_section: float = 4
    space_after_section: float = 3
    name_color: str = "000000"
    line_spacing: float = 1.0
    section_bold: bool = True
    bullet_char: str = "•"
    contact_separator: str = "|"

    # --- Section ordering + visibility ---
    sections: list[SectionItem] = Field(
        default_factory=lambda: [
            SectionItem(key="summary"),
            SectionItem(key="skills"),
            SectionItem(key="experience"),
            SectionItem(key="education"),
        ]
    )

    # --- Section heading visual style ---
    # "plain" | "underline" | "line_below" | "thick_line_below" | "double_line_below" | "boxed" | "bar"
    # boxed = full-width border row; bar = thick left vertical stripe
    section_heading_style: str = "line_below"

    # --- Spacing ---
    space_between_entries: float = 3.0    # pt between job/edu entries
    space_after_bullet: float = 1.0       # pt after each bullet line

    # --- Entry layout ---
    entry_title_size: float = 10.0
    entry_subtitle_size: float = 9.5
    entry_subtitle_style: str = "bold"    # "normal" | "bold" | "italic" | "bold_italic"
    entry_list_style: str = "bullet"      # "bullet" | "dash" | "none"
    entry_indent_body: bool = True

    # --- Per-element colors (hex without #) ---
    color_heading: str = "000000"
    color_heading_line: str = "000000"
    color_job_title: str = "000000"
    color_employer: str = "000000"
    color_dates: str = "555555"
    color_subtitle: str = "000000"
    color_contact: str = "444444"

    # --- Name extended ---
    name_italic: bool = False
    name_letter_spacing: float = 0.0      # extra letter spacing in pt

    # --- Experience layout ---
    # "employer-title" | "title-employer" | "combined"
    experience_layout: str = "employer-title"

    # --- Education layout ---
    # "degree-school" | "school-degree"
    education_layout: str = "degree-school"


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
