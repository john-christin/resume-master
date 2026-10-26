"""Document style schema (v2).

A style is stored as JSON in ``doc_styles.config``. v2 is nested and built from
two reusable blocks (``TextStyle`` and ``ParagraphStyle``) so that every element
of the resume / cover letter can be formatted the same way. Configs saved by the
old flat schema (v1) are upgraded transparently by ``StyleConfig``'s
``model_validator(mode="before")``.
"""
import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    Field,
    field_validator,
    model_validator,
)

STYLE_VERSION = 2


def _hex(v: str) -> str:
    h = v.lstrip("#").upper()
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6 or any(c not in "0123456789ABCDEF" for c in h):
        raise ValueError(f"invalid hex colour: {v!r}")
    return h


HexColor = Annotated[str, AfterValidator(_hex)]

UnderlineStyle = Literal["none", "single", "double", "dotted", "dashed", "thick", "wavy"]
BorderStyle = Literal[
    "none", "single", "double", "triple", "dotted", "dashed", "dash_dot", "thick", "wave"
]
Align = Literal["left", "center", "right", "justify"]
SectionKey = Literal["summary", "skills", "experience", "education", "certifications"]


# ---------------------------------------------------------------------------
# Reusable building blocks
# ---------------------------------------------------------------------------
class TextStyle(BaseModel):
    font: str | None = None            # None → inherit ``fonts.family``
    size: float | None = Field(None, ge=1, le=96)   # pt; None → inherit
    bold: bool = False
    italic: bool = False
    underline: UnderlineStyle = "none"
    strike: bool = False
    small_caps: bool = False
    all_caps: bool = False
    color: HexColor | None = None      # None → automatic (black)
    highlight: HexColor | None = None  # background fill behind the text
    letter_spacing: float = Field(0.0, ge=-5, le=20)  # pt


class BorderSide(BaseModel):
    style: BorderStyle = "none"
    width: float = Field(0.5, ge=0.25, le=6)   # pt
    color: HexColor = "000000"
    space: float = Field(1.0, ge=0, le=31)     # pt between border and text


class Borders(BaseModel):
    top: BorderSide = Field(default_factory=BorderSide)
    left: BorderSide = Field(default_factory=BorderSide)
    bottom: BorderSide = Field(default_factory=BorderSide)
    right: BorderSide = Field(default_factory=BorderSide)


class ParagraphStyle(BaseModel):
    align: Align = "left"
    space_before: float = Field(0.0, ge=0, le=200)   # pt
    space_after: float = Field(0.0, ge=0, le=200)    # pt
    line_spacing_mode: Literal["multiple", "exact", "at_least"] = "multiple"
    line_spacing: float = Field(1.0, ge=0.5, le=200)  # multiple, or pt for exact / at_least
    left_indent: float = Field(0.0, ge=0, le=5)       # inches
    right_indent: float = Field(0.0, ge=0, le=5)      # inches
    first_line_indent: float = Field(0.0, ge=-5, le=5)  # inches (negative = hanging)
    keep_with_next: bool = False
    keep_together: bool = False
    borders: Borders = Field(default_factory=Borders)
    shading: HexColor | None = None                   # paragraph background fill


# ---------------------------------------------------------------------------
# Document-level groups
# ---------------------------------------------------------------------------
class PageSettings(BaseModel):
    size: Literal["letter", "a4", "legal"] = "letter"
    orientation: Literal["portrait", "landscape"] = "portrait"
    margin_top: float = Field(0.5, ge=0, le=4)
    margin_bottom: float = Field(0.5, ge=0, le=4)
    margin_left: float = Field(0.5, ge=0, le=4)
    margin_right: float = Field(0.5, ge=0, le=4)
    gutter: float = Field(0.0, ge=0, le=3)
    mirror_margins: bool = False
    header_distance: float = Field(0.3, ge=0, le=3)
    footer_distance: float = Field(0.3, ge=0, le=3)
    page_border: BorderSide = Field(default_factory=BorderSide)  # single/double/etc. only


class FontSettings(BaseModel):
    family: str = "Calibri"
    kerning: bool = False
    auto_hyphenation: bool = False
    widow_control: bool = True


class DocProperties(BaseModel):
    title: str | None = None
    author: str | None = None      # None → candidate name
    keywords: str | None = None
    language: str | None = None    # BCP-47, e.g. "en-US"


class HeaderSettings(BaseModel):
    layout: Literal["centered", "left", "right"] = "centered"
    name: TextStyle = Field(default_factory=lambda: TextStyle(size=16, bold=True, color="000000"))
    name_uppercase: bool = True
    name_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=2))
    contact: TextStyle = Field(default_factory=lambda: TextStyle(size=9, color="444444"))
    contact_separator: str = "|"
    contact_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=6))
    hyperlinks: bool = True        # make email / LinkedIn clickable
    link_color: HexColor | None = None      # None → keep contact colour
    link_underline: bool = False


class HeadingSettings(BaseModel):
    text: TextStyle = Field(default_factory=lambda: TextStyle(size=10, bold=True, color="000000"))
    para: ParagraphStyle = Field(
        default_factory=lambda: ParagraphStyle(
            space_before=4,
            space_after=3,
            keep_with_next=True,
            borders=Borders(bottom=BorderSide(style="single", width=0.5, color="000000", space=1)),
        )
    )
    titles: dict[str, str] = Field(
        default_factory=lambda: {
            "summary": "Professional Summary",
            "skills": "Technical Skills",
            "experience": "Professional Experience",
            "education": "Education",
            "certifications": "Certifications",
        }
    )


class ListSettings(BaseModel):
    kind: Literal["bullet", "dash", "none", "numbered", "lettered", "custom"] = "bullet"
    char: str = "•"                  # used for kind == "custom" (and as the "bullet" glyph)
    indent: float = Field(0.25, ge=0, le=3)    # inches — text position
    hanging: float = Field(0.25, ge=0, le=3)   # inches — marker hangs this far left of text
    color: HexColor | None = None    # marker colour (None → text colour)
    para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=1))


class BodySettings(BaseModel):
    text: TextStyle = Field(default_factory=lambda: TextStyle(size=9.5))
    summary_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=4))
    skills_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=1))
    skills_category: TextStyle = Field(default_factory=lambda: TextStyle(size=9.5, bold=True))
    skills_separator: str = ", "


class EntrySettings(BaseModel):
    # Experience ---------------------------------------------------------
    experience_layout: Literal["employer-title", "title-employer", "combined"] = "employer-title"
    job_title: TextStyle = Field(default_factory=lambda: TextStyle(size=10, color="000000"))
    employer: TextStyle = Field(default_factory=lambda: TextStyle(size=9.5, bold=True, color="000000"))
    combined_separator: str = "|"
    # Education ----------------------------------------------------------
    education_layout: Literal["degree-school", "school-degree"] = "degree-school"
    degree: TextStyle = Field(default_factory=lambda: TextStyle(size=10, bold=True, color="000000"))
    school: TextStyle = Field(default_factory=lambda: TextStyle(size=10, bold=True, color="000000"))
    gpa: TextStyle = Field(default_factory=lambda: TextStyle(size=9, color="000000"))
    # Certifications -----------------------------------------------------
    certification_layout: Literal["name-issuer", "inline"] = "name-issuer"
    cert_name: TextStyle = Field(default_factory=lambda: TextStyle(size=10, bold=True, color="000000"))
    cert_issuer: TextStyle = Field(default_factory=lambda: TextStyle(size=9.5, color="000000"))
    # Shared -------------------------------------------------------------
    dates: TextStyle = Field(default_factory=lambda: TextStyle(size=9, color="555555"))
    date_format: Literal["as_entered", "mon_yyyy", "month_yyyy", "mm_yyyy", "yyyy"] = "as_entered"
    date_separator: str = "–"
    present_label: str = "Present"
    first_line_para: ParagraphStyle = Field(
        default_factory=lambda: ParagraphStyle(space_before=3, space_after=1, keep_with_next=True)
    )
    second_line_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=1))
    bullets: ListSettings = Field(default_factory=ListSettings)


class HeaderFooterSettings(BaseModel):
    header_text: str = ""          # supports {name}
    footer_text: str = ""          # supports {name}
    page_numbers: Literal["none", "number", "page_of_total"] = "none"
    page_number_position: Literal["header", "footer"] = "footer"
    text: TextStyle = Field(default_factory=lambda: TextStyle(size=8, color="777777"))
    para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(align="center"))
    different_first_page: bool = False   # first page has no header / footer


class CoverLetterSettings(BaseModel):
    margin_top: float = Field(1.0, ge=0, le=4)
    margin_bottom: float = Field(1.0, ge=0, le=4)
    margin_left: float = Field(1.0, ge=0, le=4)
    margin_right: float = Field(1.0, ge=0, le=4)
    letterhead: Literal["left", "centered", "right", "match_resume"] = "left"
    name: TextStyle = Field(default_factory=lambda: TextStyle(size=14, bold=True))
    name_uppercase: bool = False
    name_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=2))
    contact: TextStyle = Field(default_factory=lambda: TextStyle(size=10))
    contact_separator: str = "|"
    contact_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=12))
    letterhead_border: BorderSide = Field(default_factory=BorderSide)  # line under the letterhead
    include_date: bool = True
    date_format: Literal["long", "us", "iso"] = "long"
    date: TextStyle = Field(default_factory=lambda: TextStyle(size=11))
    date_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=12))
    include_recipient: bool = False      # "Hiring Team, <Company>" block under the date
    body: TextStyle = Field(default_factory=lambda: TextStyle(size=11))
    body_para: ParagraphStyle = Field(default_factory=lambda: ParagraphStyle(space_after=8))
    header_footer: HeaderFooterSettings = Field(default_factory=HeaderFooterSettings)


class SectionItem(BaseModel):
    key: SectionKey
    visible: bool = True


def _default_sections() -> list[SectionItem]:
    return [SectionItem(key=k) for k in ("summary", "skills", "experience", "education", "certifications")]


# ---------------------------------------------------------------------------
# v1 → v2 migration
# ---------------------------------------------------------------------------
def _v1_heading_borders(cfg: dict) -> dict:
    heading_style = cfg.get("section_heading_style", "line_below")
    separator = cfg.get("section_separator", "line")
    if heading_style == "line_below" and separator != "line":
        heading_style = {
            "thick_line": "thick_line_below",
            "double_line": "double_line_below",
            "none": "plain",
        }.get(separator, "line_below")
    color = cfg.get("color_heading_line", "000000")

    def side(style: str, width: float, space: float) -> dict:
        return {"style": style, "width": width, "color": color, "space": space}

    borders: dict[str, Any] = {}
    underline = "none"
    if heading_style == "underline":
        underline = "single"
    elif heading_style == "line_below":
        borders["bottom"] = side("single", 0.5, 1)
    elif heading_style == "thick_line_below":
        borders["bottom"] = side("thick", 0.75, 1)
    elif heading_style == "double_line_below":
        borders["bottom"] = side("double", 0.5, 1)
    elif heading_style == "boxed":
        for s in ("top", "left", "bottom", "right"):
            borders[s] = side("single", 0.5, 4)
    elif heading_style == "bar":
        borders["left"] = side("single", 2.25, 6)
    return {"borders": borders, "underline": underline}


def _subtitle_flags(cfg: dict) -> dict:
    es = cfg.get("entry_subtitle_style", "bold")
    return {"bold": es in ("bold", "bold_italic"), "italic": es in ("italic", "bold_italic")}


_V1_MARKERS = (
    "font_name", "font_size_body", "header_layout", "margin_left", "section_heading_style",
    "experience_layout", "education_layout", "color_heading",
)


def _is_v1(data: dict) -> bool:
    """Old flat configs have no ``version`` (or a version below 2) and flat keys."""
    version = data.get("version")
    if version is not None:
        return version < STYLE_VERSION
    return any(k in data for k in _V1_MARKERS)


def migrate_v1(cfg: dict) -> dict:
    """Convert a flat v1 style dict to the nested v2 shape (same visual output)."""
    g = cfg.get
    layout = g("header_layout", "centered")
    exp_layout = g("experience_layout", "employer-title")
    edu_layout = g("education_layout", "degree-school")
    sub = _subtitle_flags(cfg)
    font = g("font_name", "Calibri")
    heading = _v1_heading_borders(cfg)

    title_sz = g("entry_title_size", 10.0)
    sub_sz = g("entry_subtitle_size", 9.5)
    c_job, c_emp = g("color_job_title", "000000"), g("color_employer", "000000")
    c_sub = g("color_subtitle", "000000")

    if exp_layout == "title-employer":
        job_title = {"size": title_sz, "bold": True, "color": c_job}
        employer = {"size": sub_sz, "color": c_emp, **sub}
    elif exp_layout == "combined":
        job_title = {"size": title_sz, "bold": True, "color": c_job}
        employer = dict(job_title)
    else:  # employer-title
        job_title = {"size": title_sz, "bold": False, "color": c_job}
        employer = {"size": sub_sz, "bold": True, "color": c_emp}

    if edu_layout == "school-degree":
        school = {"size": title_sz, "bold": True, "color": c_emp}
        degree = {"size": sub_sz, "color": c_sub, **sub}
    else:
        degree = {"size": title_sz, "bold": True, "color": c_job}
        school = dict(degree)

    list_kind = g("entry_list_style", "bullet")
    bullet_char = g("bullet_char", "•")
    ls = g("line_spacing", 1.0)
    body_size = g("font_size_body", 9.5)
    space_bullet = g("space_after_bullet", 1.0)
    between = g("space_between_entries", 3.0)
    margins = {k: g(k, 0.5) for k in ("margin_top", "margin_bottom", "margin_left", "margin_right")}

    align = "center" if layout == "centered" else "left"
    sections = g("sections") or [s.model_dump() for s in _default_sections()]
    keys = {s["key"] for s in sections}
    if "certifications" not in keys:
        sections = [*sections, {"key": "certifications", "visible": True}]

    return {
        "version": STYLE_VERSION,
        "page": margins,
        "fonts": {"family": font},
        "header": {
            "layout": layout,
            "name": {
                "size": g("font_size_name", 16), "bold": g("name_bold", True),
                "italic": g("name_italic", False), "color": g("name_color", "000000"),
                "letter_spacing": g("name_letter_spacing", 0.0),
            },
            "name_uppercase": g("name_uppercase", True),
            "name_para": {"align": align, "space_after": 2},
            "contact": {"size": g("font_size_contact", 9), "color": g("color_contact", "444444")},
            "contact_separator": g("contact_separator", "|"),
            "contact_para": {"align": align, "space_after": 6},
            "hyperlinks": False,  # v1 never produced links; keep output identical
        },
        "headings": {
            "text": {
                "size": g("font_size_section", 10), "bold": g("section_bold", True),
                "all_caps": g("section_caps", False), "color": g("color_heading", "000000"),
                "underline": heading["underline"],
            },
            "para": {
                "space_before": g("space_before_section", 4),
                "space_after": g("space_after_section", 3),
                "keep_with_next": True,
                "borders": heading["borders"],
            },
        },
        "body": {
            "text": {"size": body_size},
            "summary_para": {"space_after": 4, "line_spacing": ls},
            "skills_para": {"space_after": 1, "line_spacing": ls},
            "skills_category": {"size": body_size, "bold": True},
        },
        "entries": {
            "experience_layout": exp_layout,
            "job_title": job_title,
            "employer": employer,
            "education_layout": edu_layout,
            "degree": degree,
            "school": school,
            "gpa": {"size": g("font_size_contact", 9), "color": c_sub},
            "cert_name": {"size": title_sz, "bold": True, "color": c_job},
            "cert_issuer": {"size": sub_sz, "color": c_sub, **sub},
            "dates": {"size": g("font_size_contact", 9), "color": g("color_dates", "555555")},
            "first_line_para": {"space_before": between, "space_after": 1, "keep_with_next": True},
            "second_line_para": {"space_after": 1},
            "bullets": {
                "kind": list_kind if list_kind in ("bullet", "dash", "none") else "bullet",
                "char": bullet_char,
                # v1 "indent body" off → marker at margin, text at next tab stop, wraps flush-left
                "indent": 0.25 if g("entry_indent_body", True) else 0.0,
                "hanging": 0.25 if g("entry_indent_body", True) else 0.0,
                "para": {"space_after": space_bullet, "line_spacing": ls},
            },
        },
        "sections": sections,
        "cover_letter": {},
    }


# ---------------------------------------------------------------------------
# Root config
# ---------------------------------------------------------------------------
class StyleConfig(BaseModel):
    version: int = STYLE_VERSION
    page: PageSettings = Field(default_factory=PageSettings)
    fonts: FontSettings = Field(default_factory=FontSettings)
    properties: DocProperties = Field(default_factory=DocProperties)
    header: HeaderSettings = Field(default_factory=HeaderSettings)
    headings: HeadingSettings = Field(default_factory=HeadingSettings)
    body: BodySettings = Field(default_factory=BodySettings)
    entries: EntrySettings = Field(default_factory=EntrySettings)
    header_footer: HeaderFooterSettings = Field(default_factory=HeaderFooterSettings)
    sections: list[SectionItem] = Field(default_factory=_default_sections)
    cover_letter: CoverLetterSettings = Field(default_factory=CoverLetterSettings)

    @model_validator(mode="before")
    @classmethod
    def _upgrade(cls, data: Any) -> Any:
        if isinstance(data, dict) and _is_v1(data):
            return migrate_v1(data)
        return data

    @field_validator("sections")
    @classmethod
    def _complete_sections(cls, v: list[SectionItem]) -> list[SectionItem]:
        seen = {s.key for s in v}
        extra = [SectionItem(key=k) for k in ("summary", "skills", "experience", "education", "certifications") if k not in seen]
        return [*v, *extra] if extra else v


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
