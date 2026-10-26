import type { BorderLineStyle, SectionKey, UnderlineStyle } from "../../types";

/** ATS-friendly fonts only. */
export const ATS_FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Garamond",
  "Georgia",
  "Helvetica",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Book Antiqua",
  "Palatino Linotype",
  "Century Gothic",
] as const;

export const UNDERLINE_OPTIONS: { label: string; value: UnderlineStyle }[] = [
  { label: "None", value: "none" },
  { label: "Single", value: "single" },
  { label: "Double", value: "double" },
  { label: "Dotted", value: "dotted" },
  { label: "Dashed", value: "dashed" },
  { label: "Thick", value: "thick" },
  { label: "Wavy", value: "wavy" },
];

export const BORDER_STYLE_OPTIONS: { label: string; value: BorderLineStyle }[] = [
  { label: "None", value: "none" },
  { label: "Single", value: "single" },
  { label: "Double", value: "double" },
  { label: "Triple", value: "triple" },
  { label: "Dotted", value: "dotted" },
  { label: "Dashed", value: "dashed" },
  { label: "Dash-dot", value: "dash_dot" },
  { label: "Thick", value: "thick" },
  { label: "Wave", value: "wave" },
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
};

export const DEFAULT_SECTION_TITLES: Record<SectionKey, string> = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Professional Experience",
  education: "Education",
  certifications: "Certifications",
};

export const PAGE_SIZES_IN: Record<"letter" | "a4" | "legal", [number, number]> = {
  letter: [8.5, 11],
  a4: [8.2677, 11.6929],
  legal: [8.5, 14],
};

export const ATS_WARNING_TEXT =
  "Page borders, shading and highlights can reduce how reliably applicant tracking systems parse the document.";
export const PDF_FONT_HINT =
  "PDF output is converted with LibreOffice, which substitutes fonts that are not installed on the server.";
export const ALIGN_IGNORED_HINT =
  "Alignment here is ignored: it follows the Header layout / Letterhead setting.";
