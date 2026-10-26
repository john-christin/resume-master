from pathlib import Path

from docx import Document

from schemas.doc_style import (
    Borders,
    HeaderFooterSettings,
    ParagraphStyle,
    StyleConfig,
    TextStyle,
)
from services import docx_helpers as h

_DEFAULT_STYLE = StyleConfig()

_LAYOUT_ALIGN = {"centered": "center", "left": "left", "right": "right", "match_resume": "left"}


def _new_document(s: StyleConfig, user_name: str, title: str):
    """Document with the style's default font, heading style and metadata applied."""
    doc = Document()
    h.set_default_font(doc, s.fonts.family, language=s.properties.language)
    h.add_heading_style(doc)
    h.set_doc_settings(doc, s.fonts.auto_hyphenation, s.page.mirror_margins)
    props = doc.core_properties
    props.title = s.properties.title or title
    props.author = s.properties.author or user_name
    if s.properties.keywords:
        props.keywords = s.properties.keywords
    if s.properties.language:
        props.language = s.properties.language
    return doc


def _add_run(paragraph, text: str, ts: TextStyle, s: StyleConfig, default_color: str | None = None):
    run = paragraph.add_run(text)
    h.format_run(run, ts, s.fonts.family, s.fonts.kerning, default_color)
    return run


def _build_header_footer(doc, section, hf: HeaderFooterSettings, user_name: str, s: StyleConfig):
    """Optional running header / footer text and page numbers."""
    header_text = hf.header_text.replace("{name}", user_name).strip()
    footer_text = hf.footer_text.replace("{name}", user_name).strip()
    numbers = hf.page_numbers != "none"
    if not (header_text or footer_text or numbers):
        return

    section.different_first_page_header_footer = hf.different_first_page

    def fill(container, text: str, with_number: bool):
        if not (text or with_number):
            return
        first = True
        for kind in ("text", "number"):
            if kind == "text" and not text:
                continue
            if kind == "number" and not with_number:
                continue
            para = container.paragraphs[0] if first else container.add_paragraph()
            first = False
            h.apply_paragraph(para, hf.para, widow_control=s.fonts.widow_control)
            if kind == "text":
                _add_run(para, text, hf.text, s)
            elif hf.page_numbers == "number":
                h.add_field(para, "PAGE", hf.text, s.fonts.family)
            else:
                _add_run(para, "Page ", hf.text, s)
                h.add_field(para, "PAGE", hf.text, s.fonts.family)
                _add_run(para, " of ", hf.text, s)
                h.add_field(para, "NUMPAGES", hf.text, s.fonts.family, placeholder="1")

    fill(section.header, header_text, numbers and hf.page_number_position == "header")
    fill(section.footer, footer_text, numbers and hf.page_number_position == "footer")


def _add_contact_line(paragraph, parts: list[tuple[str, str | None]], separator: str,
                      ts: TextStyle, s: StyleConfig):
    """parts: (text, url-or-None). Writes 'a | b | c' with optional hyperlinks."""
    for i, (text, url) in enumerate(parts):
        if i:
            _add_run(paragraph, f" {separator} ", ts, s)
        if url and s.header.hyperlinks:
            h.add_hyperlink(paragraph, text, url, ts, s.fonts.family,
                            s.header.link_color, s.header.link_underline, s.fonts.kerning)
        else:
            _add_run(paragraph, text, ts, s)


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
    certifications: list[dict] | None = None,
    custom_sections: list[dict] | None = None,
) -> Path:
    """Generate a resume DOCX at output_path. Returns the path."""
    s = style or _DEFAULT_STYLE
    doc = _new_document(s, user_name, f"{user_name} - Resume")
    section = doc.sections[0]
    h.apply_page(section, s.page)
    content_width = h.content_width_in(section)
    widow = s.fonts.widow_control
    lists = h.ListFactory(doc)

    _build_header_footer(doc, section, s.header_footer, user_name, s)

    def para(ps: ParagraphStyle, align: str | None = None):
        p = doc.add_paragraph()
        h.apply_paragraph(p, ps, align_override=align, widow_control=widow)
        return p

    def date_range(start: str | None, end: str | None) -> str:
        e = s.entries
        start_txt = h.format_date(start, e.date_format, present_label="")
        end_txt = h.format_date(end, e.date_format, present_label=e.present_label)
        return f"{start_txt} {e.date_separator} {end_txt}"

    def add_dates(p, text: str):
        _add_run(p, f"\t{text}", s.entries.dates, s)

    # --- Headline ---------------------------------------------------------
    hd = s.header
    align = _LAYOUT_ALIGN[hd.layout]
    name_para = para(hd.name_para, align)
    _add_run(name_para, user_name.upper() if hd.name_uppercase else user_name, hd.name, s)

    contact_parts: list[tuple[str, str | None]] = []
    if location:
        contact_parts.append((location, None))
    if phone:
        contact_parts.append((phone, None))
    if email:
        contact_parts.append((email, h.normalize_url(f"mailto:{email}")))
    if linkedin:
        contact_parts.append((linkedin, h.normalize_url(linkedin)))
    if contact_parts:
        contact_para = para(hd.contact_para, align)
        _add_contact_line(contact_para, contact_parts, hd.contact_separator, hd.contact, s)

    # --- Shared bits --------------------------------------------------------
    def section_heading(key: str, fallback: str):
        label = s.headings.titles.get(key) or fallback
        p = para(s.headings.para)
        p.style = doc.styles["Section Heading"]
        # re-apply: assigning a style does not remove direct formatting, but keep order stable
        _add_run(p, label, s.headings.text, s)
        return p

    def add_bullets(items: list[str]):
        bl = s.entries.bullets
        num_id = lists.new_list(bl.kind, bl.char, s.body.text.font or s.fonts.family, bl.indent,
                                  bl.hanging, bl.color, s.body.text.size)
        for text in items:
            p = para(bl.para)
            if num_id is not None:
                h.apply_numbering(p, num_id)
            _add_run(p, text, s.body.text, s)

    # --- Sections -----------------------------------------------------------
    def render_summary():
        if not summary:
            return
        section_heading("summary", "Professional Summary")
        p = para(s.body.summary_para)
        _add_run(p, summary, s.body.text, s)

    def render_skills():
        if not skills:
            return
        section_heading("skills", "Technical Skills")
        for cat in skills:
            p = para(s.body.skills_para)
            _add_run(p, f"{cat['category']}: ", s.body.skills_category, s)
            _add_run(p, s.body.skills_separator.join(cat["skills"]), s.body.text, s)

    def render_experience():
        if not tailored_experiences:
            return
        section_heading("experience", "Professional Experience")
        e = s.entries
        for exp in tailored_experiences:
            company = exp.get("company") or ""
            title = exp.get("title") or ""
            exp_location = exp.get("location") or ""
            company_text = f"{company}, {exp_location}" if exp_location else company
            dates_text = date_range(exp.get("start_date"), exp.get("end_date"))

            if e.experience_layout == "combined":
                p = para(e.first_line_para)
                h.add_right_tab(p, content_width)
                _add_run(p, title, e.job_title, s)
                _add_run(p, f" {e.combined_separator} {company_text}", e.employer, s)
                add_dates(p, dates_text)
            elif e.experience_layout == "title-employer":
                p = para(e.first_line_para)
                h.add_right_tab(p, content_width)
                _add_run(p, title, e.job_title, s)
                add_dates(p, dates_text)
                p2 = para(e.second_line_para)
                _add_run(p2, company_text, e.employer, s)
            else:  # employer-title
                p = para(e.first_line_para)
                _add_run(p, company_text, e.employer, s)
                p2 = para(e.second_line_para)
                h.add_right_tab(p2, content_width)
                _add_run(p2, title, e.job_title, s)
                add_dates(p2, dates_text)

            add_bullets(exp.get("bullets", []))

    def render_education():
        if not educations:
            return
        section_heading("education", "Education")
        e = s.entries
        for edu in educations:
            dates_text = date_range(edu.get("start_date"), edu.get("end_date"))
            degree_text = f"{edu['degree']} in {edu['field']}"
            school_text = edu["school"]

            p = para(e.first_line_para)
            h.add_right_tab(p, content_width)
            if e.education_layout == "school-degree":
                _add_run(p, school_text, e.school, s)
                add_dates(p, dates_text)
                p2 = para(e.second_line_para)
                _add_run(p2, degree_text, e.degree, s)
            else:
                _add_run(p, degree_text, e.degree, s)
                _add_run(p, f", {school_text}", e.school, s)
                add_dates(p, dates_text)

            if edu.get("gpa"):
                gp = para(e.second_line_para)
                _add_run(gp, f"GPA: {edu['gpa']}", e.gpa, s)

    def render_certifications():
        if not certifications:
            return
        section_heading("certifications", "Certifications")
        e = s.entries
        for cert in certifications:
            issued = h.format_date(cert.get("issue_date"), e.date_format, present_label="")
            expires = h.format_date(cert.get("expiry_date"), e.date_format, present_label="")
            dates_text = f"{issued} {e.date_separator} {expires}" if issued and expires else (issued or expires)
            name, issuer = cert.get("name") or "", cert.get("issuer") or ""

            p = para(e.first_line_para)
            h.add_right_tab(p, content_width)
            _add_run(p, name, e.cert_name, s)
            if e.certification_layout == "inline" and issuer:
                _add_run(p, f", {issuer}", e.cert_issuer, s)
            if dates_text:
                add_dates(p, dates_text)
            if e.certification_layout == "name-issuer" and issuer:
                p2 = para(e.second_line_para)
                _add_run(p2, issuer, e.cert_issuer, s)

    renderers = {
        "summary": render_summary,
        "skills": render_skills,
        "experience": render_experience,
        "education": render_education,
        "certifications": render_certifications,
    }
    for sec in s.sections:
        if sec.visible and sec.key in renderers:
            renderers[sec.key]()

    for custom_sec in (custom_sections or []):
        title = (custom_sec.get("title") or "").strip()
        items = custom_sec.get("items") or []
        if not title or not items:
            continue
        section_heading(title, title)
        add_bullets([item for item in items if item.strip()])

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
    style: StyleConfig | None = None,
) -> Path:
    """Generate a cover letter DOCX at output_path. Returns the path."""
    s = style or _DEFAULT_STYLE
    cl = s.cover_letter
    doc = _new_document(s, user_name, f"{user_name} - Cover Letter")
    section = doc.sections[0]
    h.apply_page(section, s.page, margins={
        "top": cl.margin_top, "bottom": cl.margin_bottom,
        "left": cl.margin_left, "right": cl.margin_right,
    })
    widow = s.fonts.widow_control

    _build_header_footer(doc, section, cl.header_footer, user_name, s)

    def para(ps: ParagraphStyle, align: str | None = None):
        p = doc.add_paragraph()
        h.apply_paragraph(p, ps, align_override=align, widow_control=widow)
        return p

    # Letterhead — "match_resume" reuses the resume header styling
    if cl.letterhead == "match_resume":
        name_ts, name_ps = s.header.name, s.header.name_para
        contact_ts, contact_ps = s.header.contact, s.header.contact_para
        upper, sep = s.header.name_uppercase, s.header.contact_separator
        align = _LAYOUT_ALIGN[s.header.layout]
    else:
        name_ts, name_ps = cl.name, cl.name_para
        contact_ts, contact_ps = cl.contact, cl.contact_para
        upper, sep = cl.name_uppercase, cl.contact_separator
        align = _LAYOUT_ALIGN[cl.letterhead]

    name_para = para(name_ps, align)
    _add_run(name_para, user_name.upper() if upper else user_name, name_ts, s)

    contact_parts: list[tuple[str, str | None]] = []
    if email:
        contact_parts.append((email, h.normalize_url(f"mailto:{email}")))
    if phone:
        contact_parts.append((phone, None))
    border_para = name_para
    if contact_parts:
        contact_para = para(contact_ps, align)
        _add_contact_line(contact_para, contact_parts, sep, contact_ts, s)
        border_para = contact_para
    if cl.letterhead_border.style != "none":
        h.apply_borders(border_para, Borders(bottom=cl.letterhead_border))

    if cl.include_date:
        date_para = para(cl.date_para)
        _add_run(date_para, h.format_letter_date(cl.date_format), cl.date, s)

    if cl.include_recipient and company:
        recipient = para(ParagraphStyle(space_after=cl.date_para.space_after))
        _add_run(recipient, "Hiring Manager", cl.body, s)
        recipient.add_run().add_break()
        _add_run(recipient, company, cl.body, s)

    for text in cover_letter_text.split("\n\n"):
        text = text.strip()
        if not text:
            continue
        p = para(cl.body_para)
        _add_run(p, text, cl.body, s)

    doc.save(str(output_path))
    return output_path
