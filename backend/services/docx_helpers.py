"""Low-level python-docx / OOXML helpers used by docx_service.

python-docx covers the common formatting; everything else (borders, shading,
real list numbering, hyperlinks, fields, kerning ...) is written here, always
inserting elements in the order the OOXML schema requires so Word opens the
files without repair prompts.
"""
import re
from datetime import date

from docx.enum.section import WD_ORIENT
from docx.enum.text import (
    WD_ALIGN_PARAGRAPH,
    WD_LINE_SPACING,
    WD_TAB_ALIGNMENT,
    WD_UNDERLINE,
)
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Inches, Pt, RGBColor

from schemas.doc_style import BorderSide, Borders, ParagraphStyle, TextStyle

# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------
PAGE_SIZES_IN = {"letter": (8.5, 11.0), "a4": (8.2677, 11.6929), "legal": (8.5, 14.0)}

_ALIGN = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}
_UNDERLINE = {
    "single": WD_UNDERLINE.SINGLE,
    "double": WD_UNDERLINE.DOUBLE,
    "dotted": WD_UNDERLINE.DOTTED,
    "dashed": WD_UNDERLINE.DASH,
    "thick": WD_UNDERLINE.THICK,
    "wavy": WD_UNDERLINE.WAVY,
}
_BORDER_VAL = {
    "single": "single", "double": "double", "triple": "triple", "dotted": "dotted",
    "dashed": "dashed", "dash_dot": "dotDash", "thick": "thick", "wave": "wave",
}

_PPR_ORDER = [
    "w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:framePr", "w:widowControl",
    "w:numPr", "w:suppressLineNumbers", "w:pBdr", "w:shd", "w:tabs", "w:suppressAutoHyphens",
    "w:kinsoku", "w:wordWrap", "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE",
    "w:autoSpaceDN", "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind",
    "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc", "w:textDirection",
    "w:textAlignment", "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr",
    "w:sectPr", "w:pPrChange",
]
_RPR_ORDER = [
    "w:rStyle", "w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:smallCaps", "w:strike",
    "w:dstrike", "w:outline", "w:shadow", "w:emboss", "w:imprint", "w:noProof", "w:snapToGrid",
    "w:vanish", "w:webHidden", "w:color", "w:spacing", "w:w", "w:kern", "w:position", "w:sz",
    "w:szCs", "w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign",
    "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath",
]


def _successors(order: list[str], tag: str) -> list[str]:
    return order[order.index(tag) + 1:]


def _put(parent, child, order: list[str]):
    """Insert ``child`` into ``parent`` replacing any existing same-tag element, in schema order."""
    tag = child.tag
    for existing in parent.findall(tag):
        parent.remove(existing)
    prefix_tag = "w:" + tag.split("}")[1]
    parent.insert_element_before(child, *_successors(order, prefix_tag))
    return child


def hex_to_rgb(hex_str: str) -> RGBColor:
    h = hex_str.lstrip("#").zfill(6)
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ---------------------------------------------------------------------------
# Character formatting
# ---------------------------------------------------------------------------
def set_run_fonts(rPr, name: str):
    """Set all four font slots so Latin, East-Asian and complex scripts use the font."""
    fonts = OxmlElement("w:rFonts")
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        fonts.set(qn(attr), name)
    _put(rPr, fonts, _RPR_ORDER)


def format_run(run, ts: TextStyle, base_font: str, kerning: bool = False,
               default_color: str | None = None):
    """Apply a TextStyle to a run (``ts.font`` / ``ts.size`` of None inherit)."""
    rPr = run._r.get_or_add_rPr()
    set_run_fonts(rPr, ts.font or base_font)
    if ts.size:
        run.font.size = Pt(ts.size)
    run.bold = True if ts.bold else None
    run.italic = True if ts.italic else None
    if ts.underline != "none":
        run.font.underline = _UNDERLINE[ts.underline]
    if ts.strike:
        run.font.strike = True
    if ts.small_caps:
        run.font.small_caps = True
    if ts.all_caps:
        run.font.all_caps = True
    color = ts.color or default_color
    if color:
        run.font.color.rgb = hex_to_rgb(color)
    if ts.letter_spacing:
        sp = OxmlElement("w:spacing")
        sp.set(qn("w:val"), str(int(round(ts.letter_spacing * 20))))
        _put(rPr, sp, _RPR_ORDER)
    if kerning:
        kern = OxmlElement("w:kern")
        kern.set(qn("w:val"), "1")  # kern fonts at 0.5pt and above
        _put(rPr, kern, _RPR_ORDER)
    if ts.highlight:
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), ts.highlight)
        _put(rPr, shd, _RPR_ORDER)


# ---------------------------------------------------------------------------
# Paragraph formatting
# ---------------------------------------------------------------------------
def _border_el(tag: str, side: BorderSide):
    el = OxmlElement(f"w:{tag}")
    el.set(qn("w:val"), _BORDER_VAL.get(side.style, "single"))
    el.set(qn("w:sz"), str(max(2, min(96, int(round(side.width * 8))))))
    el.set(qn("w:space"), str(int(round(side.space))))
    el.set(qn("w:color"), side.color)
    return el


def apply_borders(paragraph, borders: Borders):
    sides = [(n, getattr(borders, n)) for n in ("top", "left", "bottom", "right")]
    sides = [(n, s) for n, s in sides if s.style != "none"]
    if not sides:
        return
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    for name, side in sides:  # schema order: top, left, bottom, right
        pBdr.append(_border_el(name, side))
    _put(pPr, pBdr, _PPR_ORDER)


def apply_shading(paragraph, fill: str | None):
    if not fill:
        return
    pPr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    _put(pPr, shd, _PPR_ORDER)


def apply_paragraph(paragraph, ps: ParagraphStyle, align_override: str | None = None,
                    widow_control: bool = True):
    pf = paragraph.paragraph_format
    pf.alignment = _ALIGN[align_override or ps.align]
    pf.space_before = Pt(ps.space_before)
    pf.space_after = Pt(ps.space_after)
    if ps.line_spacing_mode == "multiple":
        if ps.line_spacing != 1.0:
            pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
            pf.line_spacing = ps.line_spacing
    else:
        pf.line_spacing_rule = (
            WD_LINE_SPACING.EXACTLY if ps.line_spacing_mode == "exact" else WD_LINE_SPACING.AT_LEAST
        )
        pf.line_spacing = Pt(ps.line_spacing)
    if ps.left_indent:
        pf.left_indent = Inches(ps.left_indent)
    if ps.right_indent:
        pf.right_indent = Inches(ps.right_indent)
    if ps.first_line_indent:
        pf.first_line_indent = Inches(ps.first_line_indent)
    if ps.keep_with_next:
        pf.keep_with_next = True
    if ps.keep_together:
        pf.keep_together = True
    pf.widow_control = widow_control
    apply_borders(paragraph, ps.borders)
    apply_shading(paragraph, ps.shading)


def add_right_tab(paragraph, position_in: float):
    paragraph.paragraph_format.tab_stops.add_tab_stop(Inches(position_in), WD_TAB_ALIGNMENT.RIGHT)


def set_outline_level(paragraph, level: int = 0):
    pPr = paragraph._p.get_or_add_pPr()
    el = OxmlElement("w:outlineLvl")
    el.set(qn("w:val"), str(level))
    _put(pPr, el, _PPR_ORDER)


# ---------------------------------------------------------------------------
# Page setup, document-level settings
# ---------------------------------------------------------------------------
def apply_page(section, page, margins: dict[str, float] | None = None):
    w, h = PAGE_SIZES_IN[page.size]
    if page.orientation == "landscape":
        w, h = h, w
        section.orientation = WD_ORIENT.LANDSCAPE
    else:
        section.orientation = WD_ORIENT.PORTRAIT
    section.page_width, section.page_height = Inches(w), Inches(h)
    m = margins or {
        "top": page.margin_top, "bottom": page.margin_bottom,
        "left": page.margin_left, "right": page.margin_right,
    }
    section.top_margin = Inches(m["top"])
    section.bottom_margin = Inches(m["bottom"])
    section.left_margin = Inches(m["left"])
    section.right_margin = Inches(m["right"])
    section.gutter = Inches(page.gutter)
    section.header_distance = Inches(page.header_distance)
    section.footer_distance = Inches(page.footer_distance)

    sectPr = section._sectPr
    if page.page_border.style != "none":
        pgBorders = OxmlElement("w:pgBorders")
        pgBorders.set(qn("w:offsetFrom"), "page")
        for name in ("top", "left", "bottom", "right"):
            pgBorders.append(_border_el(name, page.page_border))
        # pgBorders sits after pgMar in sectPr
        pgMar = sectPr.find(qn("w:pgMar"))
        pgMar.addnext(pgBorders)


def content_width_in(section) -> float:
    return (section.page_width - section.left_margin - section.right_margin - section.gutter) / 914400


_SETTINGS_AFTER_MIRROR = [
    "w:alignBordersAndEdges", "w:bordersDoNotSurroundHeader", "w:bordersDoNotSurroundFooter",
    "w:gutterAtTop", "w:hideSpellingErrors", "w:hideGrammaticalErrors", "w:activeWritingStyle",
    "w:proofState", "w:formsDesign", "w:attachedTemplate", "w:linkStyles",
    "w:stylePaneFormatFilter", "w:stylePaneSortMethod", "w:documentType", "w:mailMerge",
    "w:revisionView", "w:trackRevisions", "w:doNotTrackMoves", "w:doNotTrackFormatting",
    "w:documentProtection", "w:autoFormatOverride", "w:styleLockTheme", "w:styleLockQFSet",
    "w:defaultTabStop", "w:autoHyphenation", "w:consecutiveHyphenLimit", "w:hyphenationZone",
    "w:doNotHyphenateCaps", "w:showEnvelope", "w:summaryLength", "w:clickAndTypeStyle",
    "w:defaultTableStyle", "w:evenAndOddHeaders", "w:bookFoldRevPrinting", "w:bookFoldPrinting",
    "w:bookFoldPrintingSheets", "w:drawingGridHorizontalSpacing", "w:characterSpacingControl",
    "w:compat", "w:rsids", "w:themeFontLang", "w:clrSchemeMapping", "w:decimalSymbol",
    "w:listSeparator",
]


def set_doc_settings(doc, auto_hyphenation: bool, mirror_margins: bool):
    settings = doc.settings.element
    if mirror_margins:
        settings.insert_element_before(OxmlElement("w:mirrorMargins"), *_SETTINGS_AFTER_MIRROR)
    if auto_hyphenation:
        settings.insert_element_before(
            OxmlElement("w:autoHyphenation"), *_SETTINGS_AFTER_MIRROR[_SETTINGS_AFTER_MIRROR.index("w:consecutiveHyphenLimit"):]
        )


def set_default_font(doc, family: str, size: float | None = None, language: str | None = None):
    """Make the Normal style use the document font (all four slots)."""
    normal = doc.styles["Normal"]
    rPr = normal.element.get_or_add_rPr()
    set_run_fonts(rPr, family)
    if size:
        normal.font.size = Pt(size)
    if language:
        lang = OxmlElement("w:lang")
        lang.set(qn("w:val"), language)
        lang.set(qn("w:eastAsia"), language)
        _put(rPr, lang, _RPR_ORDER)
    # Paragraph defaults of the stock template add 0 spacing; make sure of it
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.space_before = Pt(0)


def add_heading_style(doc, name: str = "Section Heading"):
    """Custom paragraph style (outline level 1) used for section headings."""
    from docx.enum.style import WD_STYLE_TYPE

    style = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    style.base_style = doc.styles["Normal"]
    style.quick_style = True
    pPr = style.element.get_or_add_pPr()
    lvl = OxmlElement("w:outlineLvl")
    lvl.set(qn("w:val"), "0")
    _put(pPr, lvl, _PPR_ORDER)
    return style


# ---------------------------------------------------------------------------
# Real Word list numbering
# ---------------------------------------------------------------------------
class ListFactory:
    """Creates multilevel-free list definitions in the document's numbering part."""

    def __init__(self, doc):
        self._numbering = doc.part.numbering_part.element
        self._abstract_ids: dict[tuple, int] = {}

    def _next_id(self, tag: str, attr: str) -> int:
        ids = [int(e.get(qn(attr))) for e in self._numbering.findall(qn(tag))]
        return max(ids, default=0) + 1

    def _abstract(self, fmt: str, text: str, font: str, indent_in: float, hanging_in: float,
                  color: str | None, size: float | None) -> int:
        key = (fmt, text, font, indent_in, hanging_in, color, size)
        if key in self._abstract_ids:
            return self._abstract_ids[key]
        abs_id = self._next_id("w:abstractNum", "w:abstractNumId")
        absn = OxmlElement("w:abstractNum")
        absn.set(qn("w:abstractNumId"), str(abs_id))
        ml = OxmlElement("w:multiLevelType")
        ml.set(qn("w:val"), "singleLevel")
        absn.append(ml)
        lvl = OxmlElement("w:lvl")
        lvl.set(qn("w:ilvl"), "0")
        for tag, val in (("w:start", "1"), ("w:numFmt", fmt), ("w:lvlText", text), ("w:lvlJc", "left")):
            e = OxmlElement(tag)
            e.set(qn("w:val"), val)
            lvl.append(e)
        pPr = OxmlElement("w:pPr")
        ind = OxmlElement("w:ind")
        ind.set(qn("w:left"), str(int(round(indent_in * 1440))))
        ind.set(qn("w:hanging"), str(int(round(hanging_in * 1440))))
        pPr.append(ind)
        lvl.append(pPr)
        rPr = OxmlElement("w:rPr")
        set_run_fonts(rPr, font)
        if color:
            c = OxmlElement("w:color")
            c.set(qn("w:val"), color)
            rPr.append(c)
        if size:
            for tag in ("w:sz", "w:szCs"):
                sz = OxmlElement(tag)
                sz.set(qn("w:val"), str(int(round(size * 2))))
                rPr.append(sz)
        lvl.append(rPr)
        absn.append(lvl)
        # abstractNum elements must precede num elements
        first_num = self._numbering.find(qn("w:num"))
        (first_num.addprevious(absn) if first_num is not None else self._numbering.append(absn))
        self._abstract_ids[key] = abs_id
        return abs_id

    def new_list(self, kind: str, char: str, font: str, indent_in: float, hanging_in: float,
                 color: str | None = None, size: float | None = None) -> int | None:
        """Return a fresh numId (numbered lists restart at 1 for each call)."""
        if kind == "none":
            return None
        if kind == "numbered":
            fmt, text = "decimal", "%1."
        elif kind == "lettered":
            fmt, text = "lowerLetter", "%1."
        elif kind == "dash":
            fmt, text = "bullet", "–"
        elif kind == "custom":
            fmt, text = "bullet", char or "•"
        else:
            fmt, text = "bullet", char or "•"
        abs_id = self._abstract(fmt, text, font, indent_in, hanging_in, color, size)
        num_id = self._next_id("w:num", "w:numId")
        num = OxmlElement("w:num")
        num.set(qn("w:numId"), str(num_id))
        a = OxmlElement("w:abstractNumId")
        a.set(qn("w:val"), str(abs_id))
        num.append(a)
        if fmt != "bullet":
            ov = OxmlElement("w:lvlOverride")
            ov.set(qn("w:ilvl"), "0")
            st = OxmlElement("w:startOverride")
            st.set(qn("w:val"), "1")
            ov.append(st)
            num.append(ov)
        self._numbering.append(num)
        return num_id


def apply_numbering(paragraph, num_id: int):
    pPr = paragraph._p.get_or_add_pPr()
    numPr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    nid = OxmlElement("w:numId")
    nid.set(qn("w:val"), str(num_id))
    numPr.append(ilvl)
    numPr.append(nid)
    _put(pPr, numPr, _PPR_ORDER)


# ---------------------------------------------------------------------------
# Hyperlinks and fields
# ---------------------------------------------------------------------------
def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if re.match(r"^[a-z][a-z0-9+.-]*:", raw, re.I):
        return raw
    if "@" in raw and " " not in raw and "/" not in raw:
        return f"mailto:{raw}"
    return f"https://{raw}"


def add_hyperlink(paragraph, text: str, url: str, ts: TextStyle, base_font: str,
                  link_color: str | None, underline: bool, kerning: bool = False):
    r_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    link.set(qn("w:history"), "1")
    paragraph._p.append(link)
    from docx.text.run import Run

    r = OxmlElement("w:r")
    link.append(r)
    run = Run(r, paragraph)
    run.text = text
    link_ts = ts.model_copy(update={
        "color": link_color or ts.color,
        "underline": "single" if underline else ts.underline,
    })
    format_run(run, link_ts, base_font, kerning)
    return run


def add_field(paragraph, instr: str, ts: TextStyle, base_font: str, placeholder: str = "1"):
    """Insert a complex field (PAGE, NUMPAGES ...) as separate runs."""
    from docx.text.run import Run

    def _run_with(child):
        r = OxmlElement("w:r")
        paragraph._p.append(r)
        run = Run(r, paragraph)
        format_run(run, ts, base_font)
        r.append(child)
        return run

    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    _run_with(begin)
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = f" {instr} "
    _run_with(it)
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    _run_with(sep)
    t = OxmlElement("w:t")
    t.text = placeholder
    _run_with(t)
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    _run_with(end)


# ---------------------------------------------------------------------------
# Dates
# ---------------------------------------------------------------------------
_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"]
_MONTH_LOOKUP = {m.lower(): i + 1 for i, m in enumerate(_MONTHS)}
_MONTH_LOOKUP.update({m[:3].lower(): i + 1 for i, m in enumerate(_MONTHS)})
_MONTH_LOOKUP["sept"] = 9


def parse_month_year(raw: str) -> tuple[int | None, int] | None:
    """Parse '2021-03', '03/2021', 'Mar 2021', 'March, 2021', '2021'. Returns (month|None, year)."""
    s = raw.strip().rstrip(".")
    if not s:
        return None
    m = re.fullmatch(r"(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?", s)
    if m and 1 <= int(m.group(2)) <= 12:
        return int(m.group(2)), int(m.group(1))
    m = re.fullmatch(r"(\d{1,2})[-/.](\d{4})", s)
    if m and 1 <= int(m.group(1)) <= 12:
        return int(m.group(1)), int(m.group(2))
    m = re.fullmatch(r"([A-Za-z]+)\.?,?\s+(\d{4})", s)
    if m and m.group(1).lower() in _MONTH_LOOKUP:
        return _MONTH_LOOKUP[m.group(1).lower()], int(m.group(2))
    m = re.fullmatch(r"(\d{4})", s)
    if m:
        return None, int(m.group(1))
    return None


def format_date(raw: str | None, fmt: str, present_label: str = "Present") -> str:
    if not raw:
        return present_label if present_label else ""
    if fmt == "as_entered":
        return raw
    parsed = parse_month_year(raw)
    if not parsed:
        return raw
    month, year = parsed
    if fmt == "yyyy" or month is None:
        return str(year)
    if fmt == "mon_yyyy":
        return f"{_MONTHS[month - 1][:3]} {year}"
    if fmt == "month_yyyy":
        return f"{_MONTHS[month - 1]} {year}"
    return f"{month:02d}/{year}"  # mm_yyyy


def format_letter_date(fmt: str) -> str:
    today = date.today()
    if fmt == "us":
        return today.strftime("%m/%d/%Y")
    if fmt == "iso":
        return today.isoformat()
    return today.strftime("%B %d, %Y")
