import type {
  BorderSide,
  Borders,
  CoverLetterSettings,
  HeaderFooterSettings,
  ParagraphStyle,
  SectionItem,
  SectionKey,
  StyleConfig,
  TextStyle,
} from "../../types";

// Mirrors backend/schemas/doc_style.py defaults exactly.

export const SECTION_KEYS: SectionKey[] = ["summary", "skills", "experience", "education", "certifications"];

export function textStyle(over: Partial<TextStyle> = {}): TextStyle {
  return {
    font: null,
    size: null,
    bold: false,
    italic: false,
    underline: "none",
    strike: false,
    small_caps: false,
    all_caps: false,
    color: null,
    highlight: null,
    letter_spacing: 0,
    ...over,
  };
}

export function borderSide(over: Partial<BorderSide> = {}): BorderSide {
  return { style: "none", width: 0.5, color: "000000", space: 1, ...over };
}

export function noBorders(): Borders {
  return { top: borderSide(), left: borderSide(), bottom: borderSide(), right: borderSide() };
}

export function paragraphStyle(over: Partial<ParagraphStyle> = {}): ParagraphStyle {
  return {
    align: "left",
    space_before: 0,
    space_after: 0,
    line_spacing_mode: "multiple",
    line_spacing: 1,
    left_indent: 0,
    right_indent: 0,
    first_line_indent: 0,
    keep_with_next: false,
    keep_together: false,
    borders: noBorders(),
    shading: null,
    ...over,
  };
}

function headerFooter(): HeaderFooterSettings {
  return {
    header_text: "",
    footer_text: "",
    page_numbers: "none",
    page_number_position: "footer",
    text: textStyle({ size: 8, color: "777777" }),
    para: paragraphStyle({ align: "center" }),
    different_first_page: false,
  };
}

export const defaultHeaderFooter = headerFooter;

function defaultCoverLetter(): CoverLetterSettings {
  return {
    margin_top: 1,
    margin_bottom: 1,
    margin_left: 1,
    margin_right: 1,
    letterhead: "left",
    name: textStyle({ size: 14, bold: true }),
    name_uppercase: false,
    name_para: paragraphStyle({ space_after: 2 }),
    contact: textStyle({ size: 10 }),
    contact_separator: "|",
    contact_para: paragraphStyle({ space_after: 12 }),
    letterhead_border: borderSide(),
    include_date: true,
    date_format: "long",
    date: textStyle({ size: 11 }),
    date_para: paragraphStyle({ space_after: 12 }),
    include_recipient: false,
    body: textStyle({ size: 11 }),
    body_para: paragraphStyle({ space_after: 8 }),
    header_footer: headerFooter(),
  };
}

export function defaultSections(): SectionItem[] {
  return SECTION_KEYS.map((key) => ({ key, visible: true }));
}

export function defaultStyleConfig(): StyleConfig {
  return {
    version: 2,
    page: {
      size: "letter",
      orientation: "portrait",
      margin_top: 0.5,
      margin_bottom: 0.5,
      margin_left: 0.5,
      margin_right: 0.5,
      gutter: 0,
      mirror_margins: false,
      header_distance: 0.3,
      footer_distance: 0.3,
      page_border: borderSide(),
    },
    fonts: { family: "Calibri", kerning: false, auto_hyphenation: false, widow_control: true },
    properties: { title: null, author: null, keywords: null, language: null },
    header: {
      layout: "centered",
      name: textStyle({ size: 16, bold: true, color: "000000" }),
      name_uppercase: true,
      name_para: paragraphStyle({ space_after: 2 }),
      contact: textStyle({ size: 9, color: "444444" }),
      contact_separator: "|",
      contact_para: paragraphStyle({ space_after: 6 }),
      hyperlinks: true,
      link_color: null,
      link_underline: false,
    },
    headings: {
      text: textStyle({ size: 10, bold: true, color: "000000" }),
      para: paragraphStyle({
        space_before: 4,
        space_after: 3,
        keep_with_next: true,
        borders: { ...noBorders(), bottom: borderSide({ style: "single", width: 0.5, color: "000000", space: 1 }) },
      }),
      titles: {
        summary: "Professional Summary",
        skills: "Technical Skills",
        experience: "Professional Experience",
        education: "Education",
        certifications: "Certifications",
      },
    },
    body: {
      text: textStyle({ size: 9.5 }),
      summary_para: paragraphStyle({ space_after: 4 }),
      skills_para: paragraphStyle({ space_after: 1 }),
      skills_category: textStyle({ size: 9.5, bold: true }),
      skills_separator: ", ",
    },
    entries: {
      experience_layout: "employer-title",
      job_title: textStyle({ size: 10, color: "000000" }),
      employer: textStyle({ size: 9.5, bold: true, color: "000000" }),
      combined_separator: "|",
      education_layout: "degree-school",
      degree: textStyle({ size: 10, bold: true, color: "000000" }),
      school: textStyle({ size: 10, bold: true, color: "000000" }),
      gpa: textStyle({ size: 9, color: "000000" }),
      certification_layout: "name-issuer",
      cert_name: textStyle({ size: 10, bold: true, color: "000000" }),
      cert_issuer: textStyle({ size: 9.5, color: "000000" }),
      dates: textStyle({ size: 9, color: "555555" }),
      date_format: "as_entered",
      date_separator: "–",
      present_label: "Present",
      first_line_para: paragraphStyle({ space_before: 3, space_after: 1, keep_with_next: true }),
      second_line_para: paragraphStyle({ space_after: 1 }),
      bullets: {
        kind: "bullet",
        char: "•",
        indent: 0.25,
        hanging: 0.25,
        color: null,
        para: paragraphStyle({ space_after: 1 }),
      },
    },
    header_footer: headerFooter(),
    sections: defaultSections(),
    cover_letter: defaultCoverLetter(),
  };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (isPlainObject(base)) {
    if (!isPlainObject(over)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(over)) {
      out[key] = key in base ? deepMerge(base[key], over[key]) : over[key];
    }
    return out;
  }
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (over === null) return base === null ? null : over; // null is meaningful for nullable fields
  return over;
}

/** Fill any missing / partial parts of a config with the defaults so the editor never crashes. */
export function mergeWithDefaults(config: unknown): StyleConfig {
  const merged = deepMerge(defaultStyleConfig(), config) as StyleConfig;
  const seen = new Set<string>();
  const sections = (Array.isArray(merged.sections) ? merged.sections : []).filter((s) => {
    if (!s || !SECTION_KEYS.includes(s.key) || seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
  for (const key of SECTION_KEYS) if (!seen.has(key)) sections.push({ key, visible: true });
  return { ...merged, version: 2, sections };
}

/** Minimal shape check for imported JSON. Returns a config or an error message. */
export function parseImportedConfig(raw: string): { config: StyleConfig } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "File is not valid JSON" };
  }
  if (isPlainObject(data) && isPlainObject(data.config)) data = data.config;
  if (!isPlainObject(data)) return { error: "JSON must be an object" };
  const looksV2 = data.version === 2 || (isPlainObject(data.page) && isPlainObject(data.header));
  if (!looksV2) return { error: "Not a v2 style config (expected version 2 with page/header groups)" };
  for (const key of ["page", "fonts", "header", "headings", "body", "entries", "cover_letter"]) {
    if (key in data && !isPlainObject(data[key])) return { error: `"${key}" must be an object` };
  }
  if ("sections" in data && !Array.isArray(data.sections)) return { error: `"sections" must be an array` };
  return { config: mergeWithDefaults(data) };
}
