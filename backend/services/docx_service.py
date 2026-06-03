from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.shared import Inches, Pt, RGBColor

from schemas.doc_style import StyleConfig

_DEFAULT_STYLE = StyleConfig()


def _hex_to_rgbcolor(hex_str: str) -> RGBColor:
    h = hex_str.lstrip("#").zfill(6)
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _set_font(run, name: str = "Calibri", size: float = 11, bold: bool = False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold


def _add_section_border(paragraph, style: StyleConfig):
    """Add a section separator line based on style config."""
    sep = style.section_separator
    if sep == "none":
        return

    from docx.oxml.ns import qn
    from lxml import etree

    val_map = {
        "line": "single",
        "thick_line": "thick",
        "double_line": "double",
    }
    val = val_map.get(sep, "single")
    sz = "6" if sep == "thick_line" else "4"

    pPr = paragraph._element.get_or_add_pPr()
    pBdr = etree.SubElement(pPr, qn("w:pBdr"))
    bottom = etree.SubElement(pBdr, qn("w:bottom"))
    bottom.set(qn("w:val"), val)
    bottom.set(qn("w:sz"), sz)
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), style.accent_color)


def _add_left_tabstop(paragraph, position_inches: float):
    """Add a left-aligned tab stop to a paragraph."""
    from docx.oxml.ns import qn
    from lxml import etree

    pPr = paragraph._element.get_or_add_pPr()
    tabs = pPr.find(qn("w:tabs"))
    if tabs is None:
        tabs = etree.SubElement(pPr, qn("w:tabs"))
    tab = etree.SubElement(tabs, qn("w:tab"))
    tab.set(qn("w:val"), "left")
    tab.set(qn("w:pos"), str(int(position_inches * 1440)))


def _set_line_spacing(paragraph, spacing: float):
    """Apply a multiple line-spacing rule to a paragraph."""
    if spacing != 1.0:
        paragraph.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        paragraph.paragraph_format.line_spacing = spacing


def _add_tabstop_right(paragraph, position_inches: float):
    """Add a right-aligned tab stop to a paragraph."""
    from docx.oxml.ns import qn
    from lxml import etree

    pPr = paragraph._element.get_or_add_pPr()
    tabs = pPr.find(qn("w:tabs"))
    if tabs is None:
        tabs = etree.SubElement(pPr, qn("w:tabs"))
    tab = etree.SubElement(tabs, qn("w:tab"))
    tab.set(qn("w:val"), "right")
    tab.set(qn("w:pos"), str(int(position_inches * 1440)))  # inches to twips


def create_resume(
    user_name: str,
    location: str | None,
    email: str | None,
    phone: str | None,
    linkedin: str | None,
    summary: str | None,
    skills: list[dict] | None,
    educations: list[dict],
    tailored_experiences: list[dict],
    output_path: Path,
    style: StyleConfig | None = None,
) -> Path:
    """Generate a resume DOCX at output_path. Returns the path."""
    s = style or _DEFAULT_STYLE
    doc = Document()

    page_width_inches = 8.5
    content_width = page_width_inches - s.margin_left - s.margin_right

    for section in doc.sections:
        section.top_margin = Inches(s.margin_top)
        section.bottom_margin = Inches(s.margin_bottom)
        section.left_margin = Inches(s.margin_left)
        section.right_margin = Inches(s.margin_right)

    align = WD_ALIGN_PARAGRAPH.CENTER if s.header_layout == "centered" else WD_ALIGN_PARAGRAPH.LEFT

    # --- Headline ---
    name_para = doc.add_paragraph()
    name_para.alignment = align
    name_para.space_after = Pt(2)
    name_text = user_name.upper() if s.name_uppercase else user_name
    run = name_para.add_run(name_text)
    _set_font(run, name=s.font_name, size=s.font_size_name, bold=s.name_bold)
    run.font.color.rgb = _hex_to_rgbcolor(s.name_color)

    contact_parts = [p for p in [location, phone, email, linkedin] if p]
    if contact_parts:
        contact_para = doc.add_paragraph()
        contact_para.alignment = align
        contact_para.space_after = Pt(6)
        run = contact_para.add_run(f" {s.contact_separator} ".join(contact_parts))
        _set_font(run, name=s.font_name, size=s.font_size_contact)

    def _section_heading(label: str):
        heading = doc.add_paragraph()
        heading.space_before = Pt(s.space_before_section)
        heading.space_after = Pt(s.space_after_section)
        text = label.upper() if s.section_caps else label
        run = heading.add_run(text)
        _set_font(run, name=s.font_name, size=s.font_size_section, bold=s.section_bold)
        _add_section_border(heading, s)
        return heading

    # --- Summary ---
    if summary:
        _section_heading("Professional Summary")
        summary_para = doc.add_paragraph()
        summary_para.space_after = Pt(4)
        _set_line_spacing(summary_para, s.line_spacing)
        run = summary_para.add_run(summary)
        _set_font(run, name=s.font_name, size=s.font_size_body)

    # --- Technical Skills ---
    if skills:
        _section_heading("Technical Skills")
        for skill_cat in skills:
            skill_para = doc.add_paragraph()
            skill_para.space_after = Pt(1)
            _set_line_spacing(skill_para, s.line_spacing)
            cat_run = skill_para.add_run(f"{skill_cat['category']}: ")
            _set_font(cat_run, name=s.font_name, size=s.font_size_body, bold=True)
            skills_run = skill_para.add_run(", ".join(skill_cat["skills"]))
            _set_font(skills_run, name=s.font_name, size=s.font_size_body)

    # --- Professional Experience ---
    if tailored_experiences:
        _section_heading("Professional Experience")
        for exp in tailored_experiences:
            end = exp.get("end_date") or "Present"
            exp_location = exp.get("location") or ""

            company_para = doc.add_paragraph()
            company_para.space_before = Pt(3)
            company_para.space_after = Pt(1)
            company_text = exp.get("company") or ""
            if exp_location:
                company_text += f", {exp_location}"
            run = company_para.add_run(company_text)
            _set_font(run, name=s.font_name, size=s.font_size_body, bold=True)

            title_para = doc.add_paragraph()
            title_para.space_after = Pt(1)
            _add_tabstop_right(title_para, content_width)
            run = title_para.add_run(exp.get("title") or "")
            _set_font(run, name=s.font_name, size=s.font_size_body)
            run = title_para.add_run(f"\t{exp.get('start_date') or ''} - {end}")
            _set_font(run, name=s.font_name, size=s.font_size_contact)

            for bullet in exp.get("bullets", []):
                bullet_para = doc.add_paragraph()
                bullet_para.space_after = Pt(1)
                bullet_para.paragraph_format.left_indent = Inches(0.25)
                bullet_para.paragraph_format.first_line_indent = Inches(-0.25)
                _add_left_tabstop(bullet_para, 0.25)
                _set_line_spacing(bullet_para, s.line_spacing)
                run = bullet_para.add_run(f"{s.bullet_char}\t{bullet}")
                _set_font(run, name=s.font_name, size=s.font_size_body)

    # --- Education ---
    if educations:
        _section_heading("Education")
        for edu in educations:
            end = edu.get("end_date") or "Present"

            edu_para = doc.add_paragraph()
            edu_para.space_before = Pt(3)
            edu_para.space_after = Pt(1)
            _add_tabstop_right(edu_para, content_width)

            degree_text = f"{edu['degree']} in {edu['field']}, {edu['school']}"
            run = edu_para.add_run(degree_text)
            _set_font(run, name=s.font_name, size=s.font_size_body, bold=True)
            run = edu_para.add_run(f"\t{edu['start_date']} - {end}")
            _set_font(run, name=s.font_name, size=s.font_size_contact)

            if edu.get("gpa"):
                gpa_para = doc.add_paragraph()
                gpa_para.space_after = Pt(1)
                run = gpa_para.add_run(f"GPA: {edu['gpa']}")
                _set_font(run, name=s.font_name, size=s.font_size_contact)

    doc.save(str(output_path))
    return output_path


def create_cover_letter(
    user_name: str,
    email: str | None,
    phone: str | None,
    cover_letter_text: str,
    job_title: str,
    company: str | None,
    output_path: Path,
) -> Path:
    """Generate a cover letter DOCX at output_path. Returns the path."""
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    name_para = doc.add_paragraph()
    name_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    name_para.space_after = Pt(2)
    run = name_para.add_run(user_name)
    _set_font(run, size=14, bold=True)

    contact_parts = [p for p in [email, phone] if p]
    if contact_parts:
        contact_para = doc.add_paragraph()
        contact_para.space_after = Pt(12)
        run = contact_para.add_run(" | ".join(contact_parts))
        _set_font(run, size=10)

    date_para = doc.add_paragraph()
    date_para.space_after = Pt(12)
    run = date_para.add_run(date.today().strftime("%B %d, %Y"))
    _set_font(run, size=11)

    paragraphs = cover_letter_text.split("\n\n")
    for text in paragraphs:
        text = text.strip()
        if not text:
            continue
        para = doc.add_paragraph()
        para.space_after = Pt(8)
        run = para.add_run(text)
        _set_font(run, size=11)

    doc.save(str(output_path))
    return output_path
