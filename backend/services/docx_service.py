from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


def _set_font(run, name: str = "Calibri", size: float = 11, bold: bool = False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold


def _add_bottom_border(paragraph):
    """Add a bottom border line to a paragraph."""
    from docx.oxml.ns import qn
    from lxml import etree

    pPr = paragraph._element.get_or_add_pPr()
    pBdr = etree.SubElement(pPr, qn("w:pBdr"))
    bottom = etree.SubElement(pBdr, qn("w:bottom"))
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "000000")


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
) -> Path:
    """Generate a resume DOCX at output_path. Returns the path."""
    doc = Document()

    # Page margins
    page_width_inches = 8.5
    margin = 0.5
    content_width = page_width_inches - 2 * margin

    for section in doc.sections:
        section.top_margin = Inches(margin)
        section.bottom_margin = Inches(margin)
        section.left_margin = Inches(margin)
        section.right_margin = Inches(margin)

    # --- Headline ---
    # 1st line: Name (centered)
    name_para = doc.add_paragraph()
    name_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    name_para.space_after = Pt(2)
    run = name_para.add_run(user_name.upper())
    _set_font(run, size=16, bold=True)

    # 2nd line: Location | Phone | Email | LinkedIn (centered)
    contact_parts = [p for p in [location, phone, email, linkedin] if p]
    if contact_parts:
        contact_para = doc.add_paragraph()
        contact_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        contact_para.space_after = Pt(6)
        run = contact_para.add_run(" | ".join(contact_parts))
        _set_font(run, size=9)

    # --- Summary ---
    if summary:
        heading = doc.add_paragraph()
        heading.space_before = Pt(4)
        heading.space_after = Pt(3)
        run = heading.add_run("Professional Summary")
        _set_font(run, size=10, bold=True)
        _add_bottom_border(heading)

        summary_para = doc.add_paragraph()
        summary_para.space_after = Pt(4)
        run = summary_para.add_run(summary)
        _set_font(run, size=9.5)

    # --- Technical Skills ---
    if skills:
        heading = doc.add_paragraph()
        heading.space_before = Pt(4)
        heading.space_after = Pt(3)
        run = heading.add_run("Technical Skills")
        _set_font(run, size=10, bold=True)
        _add_bottom_border(heading)

        for skill_cat in skills:
            skill_para = doc.add_paragraph()
            skill_para.space_after = Pt(1)
            # Category name in bold
            cat_run = skill_para.add_run(f"{skill_cat['category']}: ")
            _set_font(cat_run, size=9.5, bold=True)
            # Skills list
            skills_run = skill_para.add_run(", ".join(skill_cat["skills"]))
            _set_font(skills_run, size=9.5)

    # --- Professional Experience ---
    if tailored_experiences:
        heading = doc.add_paragraph()
        heading.space_before = Pt(4)
        heading.space_after = Pt(3)
        run = heading.add_run("Professional Experience")
        _set_font(run, size=10, bold=True)
        _add_bottom_border(heading)

        for exp in tailored_experiences:
            end = exp.get("end_date") or "Present"
            exp_location = exp.get("location") or ""

            # Line 1: Company Name, Location
            company_para = doc.add_paragraph()
            company_para.space_before = Pt(3)
            company_para.space_after = Pt(1)
            company_text = exp["company"]
            if exp_location:
                company_text += f", {exp_location}"
            run = company_para.add_run(company_text)
            _set_font(run, size=9.5, bold=True)

            # Line 2: Position Title, Duration
            title_para = doc.add_paragraph()
            title_para.space_after = Pt(1)
            _add_tabstop_right(title_para, content_width)
            run = title_para.add_run(exp["title"])
            _set_font(run, size=9.5)
            run = title_para.add_run(f"\t{exp['start_date']} - {end}")
            _set_font(run, size=9)

            # Bullets
            for bullet in exp.get("bullets", []):
                bullet_para = doc.add_paragraph(style="List Bullet")
                bullet_para.space_after = Pt(1)
                bullet_para.clear()
                run = bullet_para.add_run(bullet)
                _set_font(run, size=9.5)

    # --- Education ---
    if educations:
        heading = doc.add_paragraph()
        heading.space_before = Pt(4)
        heading.space_after = Pt(3)
        run = heading.add_run("Education")
        _set_font(run, size=10, bold=True)
        _add_bottom_border(heading)

        for edu in educations:
            end = edu.get("end_date") or "Present"

            # Single line: Degree, Major, in University (left) \t Duration (right)
            edu_para = doc.add_paragraph()
            edu_para.space_before = Pt(3)
            edu_para.space_after = Pt(1)
            _add_tabstop_right(edu_para, content_width)

            degree_text = f"{edu['degree']} in {edu['field']}, {edu['school']}"
            run = edu_para.add_run(degree_text)
            _set_font(run, size=9.5, bold=True)

            run = edu_para.add_run(f"\t{edu['start_date']} - {end}")
            _set_font(run, size=9)

            if edu.get("gpa"):
                gpa_para = doc.add_paragraph()
                gpa_para.space_after = Pt(1)
                run = gpa_para.add_run(f"GPA: {edu['gpa']}")
                _set_font(run, size=9)

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

    # Page margins
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Header: Name
    name_para = doc.add_paragraph()
    name_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    name_para.space_after = Pt(2)
    run = name_para.add_run(user_name)
    _set_font(run, size=14, bold=True)

    # Contact
    contact_parts = [p for p in [email, phone] if p]
    if contact_parts:
        contact_para = doc.add_paragraph()
        contact_para.space_after = Pt(12)
        run = contact_para.add_run(" | ".join(contact_parts))
        _set_font(run, size=10)

    # Date
    date_para = doc.add_paragraph()
    date_para.space_after = Pt(12)
    run = date_para.add_run(date.today().strftime("%B %d, %Y"))
    _set_font(run, size=11)

    # Body paragraphs
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
