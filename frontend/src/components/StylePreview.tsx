import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  BorderSide,
  FontSettings,
  HeaderFooterSettings,
  ParagraphStyle,
  SectionKey,
  StyleConfig,
  TextStyle,
} from "../types";
import { DEFAULT_SECTION_TITLES, PAGE_SIZES_IN } from "./docstyle/constants";
import { mergeWithDefaults } from "./docstyle/defaults";

// ── units ───────────────────────────────────────────────────────────────────

const PX_PER_PT = 96 / 72;
const pt = (n: number) => n * PX_PER_PT;
const inch = (n: number) => n * 96;
const DEFAULT_SIZE_PT = 11;
const LINE_FACTOR = 1.2; // Word "single" ≈ 1.2 × font size

// ── sample data ─────────────────────────────────────────────────────────────

const NAME = "Alexandra Johnson";
const CONTACT = {
  location: "New York, NY",
  phone: "(555) 867-5309",
  email: "alex@email.com",
  linkedin: "linkedin.com/in/alexj",
};
const SUMMARY =
  "Senior software engineer with 8+ years building scalable web platforms. Track record of leading small teams, shipping reliable APIs and reducing infrastructure cost.";
const SKILLS: { category: string; skills: string[] }[] = [
  { category: "Languages", skills: ["Python", "TypeScript", "Go", "SQL"] },
  { category: "Platforms", skills: ["FastAPI", "React", "PostgreSQL", "Docker", "AWS"] },
];
const EXPERIENCE = [
  {
    company: "Northwind Technologies",
    location: "Austin, TX",
    title: "Senior Software Engineer",
    start: "2021-03",
    end: null as string | null,
    bullets: [
      "Led migration of a monolith to services, cutting deploy time by 70%.",
      "Designed a event-driven ingestion pipeline handling 2M records per day.",
      "Mentored five engineers and introduced design reviews across the team.",
    ],
  },
  {
    company: "Contoso Ltd",
    location: "Seattle, WA",
    title: "Software Engineer",
    start: "2018-06",
    end: "2021-02",
    bullets: [
      "Built customer-facing dashboards used by 40,000 monthly active users.",
      "Reduced p95 API latency from 900ms to 220ms through query tuning and caching.",
    ],
  },
];
const EDUCATION = [
  {
    degree: "Master of Science",
    field: "Computer Science",
    school: "University of Washington",
    gpa: "3.9/4.0",
    start: "2016-09",
    end: "2018-05",
  },
];
const CERTIFICATIONS = [
  { name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", issued: "2022-05", expires: "2025-05" },
  { name: "Certified Kubernetes Administrator", issuer: "CNCF", issued: "2021-11", expires: null as string | null },
];
const LETTER_PARAGRAPHS = [
  "I am excited to apply for the Senior Software Engineer position at Northwind Technologies. With more than eight years of experience building reliable, scalable platforms, I am confident I can contribute from day one.",
  "In my current role I led the migration of a monolith to services, reducing deploy times by 70% while mentoring a team of five engineers. I enjoy turning ambiguous problems into well-scoped, well-tested solutions.",
  "Thank you for your time and consideration. I would welcome the opportunity to discuss how my background fits your team's goals.",
];

// ── date helpers (port of backend docx_helpers) ─────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseMonthYear(raw: string): { month: number | null; year: number } | null {
  const s = raw.trim().replace(/\.$/, "");
  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { month: +m[2], year: +m[1] };
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { month: +m[1], year: +m[2] };
  m = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const idx = MONTHS.findIndex((n) => n.toLowerCase() === m![1].toLowerCase() || n.slice(0, 3).toLowerCase() === m![1].toLowerCase());
    if (idx >= 0) return { month: idx + 1, year: +m[2] };
  }
  m = /^(\d{4})$/.exec(s);
  if (m) return { month: null, year: +m[1] };
  return null;
}

function formatDate(raw: string | null | undefined, fmt: string, presentLabel: string): string {
  if (!raw) return presentLabel;
  if (fmt === "as_entered") return raw;
  const p = parseMonthYear(raw);
  if (!p) return raw;
  if (fmt === "yyyy" || p.month === null) return String(p.year);
  if (fmt === "mon_yyyy") return `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`;
  if (fmt === "month_yyyy") return `${MONTHS[p.month - 1]} ${p.year}`;
  return `${String(p.month).padStart(2, "0")}/${p.year}`;
}

function letterDate(fmt: "long" | "us" | "iso"): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (fmt === "us") return `${mm}/${dd}/${d.getFullYear()}`;
  if (fmt === "iso") return `${d.getFullYear()}-${mm}-${dd}`;
  return `${MONTHS[d.getMonth()]} ${dd}, ${d.getFullYear()}`;
}

// ── CSS mapping ─────────────────────────────────────────────────────────────

const SERIF = ["cambria", "garamond", "georgia", "times new roman", "book antiqua", "palatino linotype"];
function fontStack(name: string): string {
  const generic = SERIF.includes(name.toLowerCase()) ? "serif" : "sans-serif";
  return `"${name}", ${generic}`;
}

function textCss(ts: TextStyle, fonts: FontSettings): CSSProperties {
  const css: CSSProperties = {
    fontFamily: fontStack(ts.font ?? fonts.family),
    fontSize: pt(ts.size ?? DEFAULT_SIZE_PT),
    fontWeight: ts.bold ? 700 : 400,
    fontStyle: ts.italic ? "italic" : "normal",
    color: `#${ts.color ?? "000000"}`,
  };
  if (ts.letter_spacing) css.letterSpacing = pt(ts.letter_spacing);
  if (ts.small_caps) css.fontVariant = "small-caps";
  if (ts.all_caps) css.textTransform = "uppercase";
  if (ts.highlight) css.backgroundColor = `#${ts.highlight}`;
  const lines: string[] = [];
  if (ts.underline !== "none") lines.push("underline");
  if (ts.strike) lines.push("line-through");
  if (lines.length) {
    css.textDecorationLine = lines.join(" ");
    css.textDecorationStyle =
      ts.underline === "double" ? "double"
        : ts.underline === "dotted" ? "dotted"
        : ts.underline === "dashed" ? "dashed"
        : ts.underline === "wavy" ? "wavy"
        : "solid";
    if (ts.underline === "thick") css.textDecorationThickness = "2px";
  }
  return css;
}

const CSS_BORDER_STYLE: Record<Exclude<BorderSide["style"], "none">, string> = {
  single: "solid",
  double: "double",
  triple: "double",
  dotted: "dotted",
  dashed: "dashed",
  dash_dot: "dashed",
  thick: "solid",
  wave: "dotted",
};

function borderCss(side: BorderSide): string | undefined {
  if (side.style === "none") return undefined;
  let w = Math.max(1, pt(side.width));
  if (side.style === "double" || side.style === "triple") w = Math.max(3, w);
  return `${w}px ${CSS_BORDER_STYLE[side.style]} #${side.color}`;
}

function paraCss(ps: ParagraphStyle, sizePt: number, align?: string): CSSProperties {
  const css: CSSProperties = {
    textAlign: (align ?? ps.align) as CSSProperties["textAlign"],
    marginTop: pt(ps.space_before),
    marginBottom: pt(ps.space_after),
    marginLeft: inch(ps.left_indent),
    marginRight: inch(ps.right_indent),
    textIndent: ps.first_line_indent ? inch(ps.first_line_indent) : undefined,
    fontSize: pt(sizePt),
  };
  if (ps.line_spacing_mode === "multiple") css.lineHeight = ps.line_spacing * LINE_FACTOR;
  else if (ps.line_spacing_mode === "exact") css.lineHeight = `${pt(ps.line_spacing)}px`;
  else css.lineHeight = `${Math.max(pt(ps.line_spacing), pt(sizePt) * LINE_FACTOR)}px`;
  if (ps.shading) css.backgroundColor = `#${ps.shading}`;
  const sides = [
    ["Top", ps.borders.top],
    ["Left", ps.borders.left],
    ["Bottom", ps.borders.bottom],
    ["Right", ps.borders.right],
  ] as const;
  for (const [name, side] of sides) {
    const b = borderCss(side);
    if (b) {
      css[`border${name}`] = b;
      css[`padding${name}`] = pt(side.space);
    }
  }
  return css;
}

const LAYOUT_ALIGN = { centered: "center", left: "left", right: "right", match_resume: "left" } as const;

// ── building blocks ─────────────────────────────────────────────────────────

function P({
  ps,
  size = DEFAULT_SIZE_PT,
  align,
  style,
  children,
}: {
  ps: ParagraphStyle;
  size?: number;
  align?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <div style={{ ...paraCss(ps, size, align), ...style }}>{children}</div>;
}

function T({ ts, fonts, children, style }: { ts: TextStyle; fonts: FontSettings; children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...textCss(ts, fonts), ...style }}>{children}</span>;
}

/** Left content with right-aligned content (the DOCX right tab stop). */
function TabLine({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span>{left}</span>
      {right !== undefined && right !== "" && <span style={{ whiteSpace: "nowrap" }}>{right}</span>}
    </div>
  );
}

function markerFor(kind: string, char: string, index: number): string {
  switch (kind) {
    case "dash": return "–";
    case "numbered": return `${index + 1}.`;
    case "lettered": return `${String.fromCharCode(97 + (index % 26))}.`;
    case "custom": return char || "•";
    default: return char || "•";
  }
}

// ── page shell ──────────────────────────────────────────────────────────────

interface ShellProps {
  config: StyleConfig;
  width: number;
  height: number;
  margins: { top: number; bottom: number; left: number; right: number };
  hf: HeaderFooterSettings;
  children: ReactNode;
}

function HeaderFooterBlock({ hf, fonts, where }: { hf: HeaderFooterSettings; fonts: FontSettings; where: "header" | "footer" }) {
  const text = (where === "header" ? hf.header_text : hf.footer_text).replace(/\{name\}/g, NAME).trim();
  const number =
    hf.page_numbers !== "none" && hf.page_number_position === where
      ? hf.page_numbers === "number" ? "1" : "Page 1 of 2"
      : "";
  if (!text && !number) return null;
  const size = hf.text.size ?? DEFAULT_SIZE_PT;
  return (
    <>
      {text && (
        <P ps={hf.para} size={size}>
          <T ts={hf.text} fonts={fonts}>{text}</T>
        </P>
      )}
      {number && (
        <P ps={hf.para} size={size}>
          <T ts={hf.text} fonts={fonts}>{number}</T>
        </P>
      )}
    </>
  );
}

function PageShell({ config, width, height, margins, hf, children }: ShellProps) {
  const { page, fonts } = config;
  const showHf = !hf.different_first_page;
  const left = margins.left + page.gutter;
  const border = page.page_border;
  const borderStr = borderCss(border);
  return (
    <div
      lang="en"
      style={{
        position: "relative",
        width,
        minHeight: height,
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        fontFamily: fontStack(fonts.family),
        fontSize: pt(DEFAULT_SIZE_PT),
        fontKerning: fonts.kerning ? "normal" : "none",
        hyphens: fonts.auto_hyphenation ? "auto" : "manual",
        paddingTop: inch(margins.top),
        paddingBottom: inch(margins.bottom),
        paddingLeft: inch(left),
        paddingRight: inch(margins.right),
      }}
    >
      {borderStr && (
        <div
          style={{
            position: "absolute",
            inset: pt(border.space),
            border: borderStr,
            pointerEvents: "none",
          }}
        />
      )}
      {showHf && (
        <div style={{ position: "absolute", top: inch(page.header_distance), left: inch(left), right: inch(margins.right) }}>
          <HeaderFooterBlock hf={hf} fonts={fonts} where="header" />
        </div>
      )}
      {showHf && (
        <div style={{ position: "absolute", bottom: inch(page.footer_distance), left: inch(left), right: inch(margins.right) }}>
          <HeaderFooterBlock hf={hf} fonts={fonts} where="footer" />
        </div>
      )}
      {children}
      {/* page-break guide lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${height - 1}px, rgba(100,116,139,0.55) ${height - 1}px, rgba(100,116,139,0.55) ${height}px)`,
        }}
      />
    </div>
  );
}

// ── contact line ────────────────────────────────────────────────────────────

function ContactLine({
  parts,
  separator,
  ts,
  fonts,
  link,
}: {
  parts: { text: string; link: boolean }[];
  separator: string;
  ts: TextStyle;
  fonts: FontSettings;
  link?: { enabled: boolean; color: string | null; underline: boolean };
}) {
  return (
    <>
      {parts.map((p, i) => {
        const isLink = p.link && link?.enabled;
        const style: TextStyle = isLink
          ? { ...ts, color: link.color ?? ts.color, underline: link.underline ? "single" : ts.underline }
          : ts;
        return (
          <span key={i}>
            {i > 0 && <T ts={ts} fonts={fonts}>{` ${separator} `}</T>}
            <T ts={style} fonts={fonts}>{p.text}</T>
          </span>
        );
      })}
    </>
  );
}

// ── resume ──────────────────────────────────────────────────────────────────

function Resume({ config: c }: { config: StyleConfig }) {
  const { fonts, entries: e, body, headings, header: hd } = c;
  const [pw, ph] = pageSize(c);
  const sz = (ts: TextStyle) => ts.size ?? DEFAULT_SIZE_PT;

  const dateRange = (start: string | null, end: string | null) =>
    `${formatDate(start, e.date_format, "")} ${e.date_separator} ${formatDate(end, e.date_format, e.present_label)}`;

  const dates = (text: string) => <T ts={e.dates} fonts={fonts}>{text}</T>;

  const heading = (key: SectionKey) => (
    <P key={`h-${key}`} ps={headings.para} size={sz(headings.text)}>
      <T ts={headings.text} fonts={fonts}>{headings.titles[key] || DEFAULT_SECTION_TITLES[key]}</T>
    </P>
  );

  const bullets = (items: string[]) => {
    const bl = e.bullets;
    return items.map((text, i) => {
      const textNode = <T ts={body.text} fonts={fonts}>{text}</T>;
      if (bl.kind === "none") {
        return <P key={i} ps={bl.para} size={sz(body.text)}>{textNode}</P>;
      }
      const left = bl.para.left_indent || bl.indent;
      const first = bl.para.first_line_indent || -bl.hanging;
      const markerWidth = Math.max(0, -first);
      return (
        <P
          key={i}
          ps={bl.para}
          size={sz(body.text)}
          style={{ marginLeft: inch(Math.max(0, left + first)), textIndent: undefined, display: "flex", alignItems: "baseline" }}
        >
          <span
            style={{
              flexShrink: 0,
              width: markerWidth ? inch(markerWidth) : undefined,
              marginRight: markerWidth ? 0 : 4,
              fontFamily: fontStack(body.text.font ?? fonts.family),
              fontSize: pt(sz(body.text)),
              color: `#${bl.color ?? body.text.color ?? "000000"}`,
            }}
          >
            {markerFor(bl.kind, bl.char, i)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{textNode}</span>
        </P>
      );
    });
  };

  const summary = () => (
    <div key="summary">
      {heading("summary")}
      <P ps={body.summary_para} size={sz(body.text)}>
        <T ts={body.text} fonts={fonts}>{SUMMARY}</T>
      </P>
    </div>
  );

  const skills = () => (
    <div key="skills">
      {heading("skills")}
      {SKILLS.map((cat) => (
        <P key={cat.category} ps={body.skills_para} size={sz(body.text)}>
          <T ts={body.skills_category} fonts={fonts}>{`${cat.category}: `}</T>
          <T ts={body.text} fonts={fonts}>{cat.skills.join(body.skills_separator)}</T>
        </P>
      ))}
    </div>
  );

  const experience = () => (
    <div key="experience">
      {heading("experience")}
      {EXPERIENCE.map((x) => {
        const company = x.location ? `${x.company}, ${x.location}` : x.company;
        const d = dates(dateRange(x.start, x.end));
        const title = <T ts={e.job_title} fonts={fonts}>{x.title}</T>;
        const emp = <T ts={e.employer} fonts={fonts}>{company}</T>;
        const big = Math.max(sz(e.job_title), sz(e.employer));
        let lines: ReactNode;
        if (e.experience_layout === "combined") {
          lines = (
            <P ps={e.first_line_para} size={big}>
              <TabLine
                left={<>{title}<T ts={e.employer} fonts={fonts}>{` ${e.combined_separator} ${company}`}</T></>}
                right={d}
              />
            </P>
          );
        } else if (e.experience_layout === "title-employer") {
          lines = (
            <>
              <P ps={e.first_line_para} size={big}><TabLine left={title} right={d} /></P>
              <P ps={e.second_line_para} size={big}>{emp}</P>
            </>
          );
        } else {
          lines = (
            <>
              <P ps={e.first_line_para} size={big}>{emp}</P>
              <P ps={e.second_line_para} size={big}><TabLine left={title} right={d} /></P>
            </>
          );
        }
        return (
          <div key={x.company}>
            {lines}
            {bullets(x.bullets)}
          </div>
        );
      })}
    </div>
  );

  const education = () => (
    <div key="education">
      {heading("education")}
      {EDUCATION.map((x) => {
        const degree = `${x.degree} in ${x.field}`;
        const d = dates(dateRange(x.start, x.end));
        const big = Math.max(sz(e.degree), sz(e.school));
        return (
          <div key={x.school}>
            {e.education_layout === "school-degree" ? (
              <>
                <P ps={e.first_line_para} size={big}>
                  <TabLine left={<T ts={e.school} fonts={fonts}>{x.school}</T>} right={d} />
                </P>
                <P ps={e.second_line_para} size={sz(e.degree)}><T ts={e.degree} fonts={fonts}>{degree}</T></P>
              </>
            ) : (
              <P ps={e.first_line_para} size={big}>
                <TabLine
                  left={<><T ts={e.degree} fonts={fonts}>{degree}</T><T ts={e.school} fonts={fonts}>{`, ${x.school}`}</T></>}
                  right={d}
                />
              </P>
            )}
            {x.gpa && (
              <P ps={e.second_line_para} size={sz(e.gpa)}><T ts={e.gpa} fonts={fonts}>{`GPA: ${x.gpa}`}</T></P>
            )}
          </div>
        );
      })}
    </div>
  );

  const certifications = () => (
    <div key="certifications">
      {heading("certifications")}
      {CERTIFICATIONS.map((x) => {
        const issued = formatDate(x.issued, e.date_format, "");
        const expires = formatDate(x.expires, e.date_format, "");
        const dt = issued && expires ? `${issued} ${e.date_separator} ${expires}` : issued || expires;
        const big = Math.max(sz(e.cert_name), sz(e.cert_issuer));
        const inline = e.certification_layout === "inline";
        return (
          <div key={x.name}>
            <P ps={e.first_line_para} size={big}>
              <TabLine
                left={<><T ts={e.cert_name} fonts={fonts}>{x.name}</T>{inline && <T ts={e.cert_issuer} fonts={fonts}>{`, ${x.issuer}`}</T>}</>}
                right={dt ? dates(dt) : undefined}
              />
            </P>
            {!inline && (
              <P ps={e.second_line_para} size={sz(e.cert_issuer)}><T ts={e.cert_issuer} fonts={fonts}>{x.issuer}</T></P>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderers: Record<SectionKey, () => ReactNode> = { summary, skills, experience, education, certifications };
  const align = LAYOUT_ALIGN[hd.layout];
  const contact = [
    { text: CONTACT.location, link: false },
    { text: CONTACT.phone, link: false },
    { text: CONTACT.email, link: true },
    { text: CONTACT.linkedin, link: true },
  ];

  return (
    <PageShell
      config={c}
      width={pw}
      height={ph}
      margins={{ top: c.page.margin_top, bottom: c.page.margin_bottom, left: c.page.margin_left, right: c.page.margin_right }}
      hf={c.header_footer}
    >
      <P ps={hd.name_para} size={sz(hd.name)} align={align}>
        <T ts={hd.name} fonts={fonts}>{hd.name_uppercase ? NAME.toUpperCase() : NAME}</T>
      </P>
      <P ps={hd.contact_para} size={sz(hd.contact)} align={align}>
        <ContactLine
          parts={contact}
          separator={hd.contact_separator}
          ts={hd.contact}
          fonts={fonts}
          link={{ enabled: hd.hyperlinks, color: hd.link_color, underline: hd.link_underline }}
        />
      </P>
      {c.sections.filter((s) => s.visible).map((s) => renderers[s.key]())}
    </PageShell>
  );
}

// ── cover letter ────────────────────────────────────────────────────────────

function CoverLetter({ config: c }: { config: StyleConfig }) {
  const { fonts, cover_letter: cl, header: hd } = c;
  const [pw, ph] = pageSize(c);
  const sz = (ts: TextStyle) => ts.size ?? DEFAULT_SIZE_PT;

  const match = cl.letterhead === "match_resume";
  const nameTs = match ? hd.name : cl.name;
  const namePs = match ? hd.name_para : cl.name_para;
  const contactTs = match ? hd.contact : cl.contact;
  const contactPs = match ? hd.contact_para : cl.contact_para;
  const upper = match ? hd.name_uppercase : cl.name_uppercase;
  const sep = match ? hd.contact_separator : cl.contact_separator;
  const align = match ? LAYOUT_ALIGN[hd.layout] : LAYOUT_ALIGN[cl.letterhead];

  // The letterhead border replaces any borders on the last letterhead paragraph.
  const borderOnly = (ps: ParagraphStyle): ParagraphStyle => ({
    ...ps,
    borders: { ...ps.borders, top: { ...ps.borders.top, style: "none" }, left: { ...ps.borders.left, style: "none" }, right: { ...ps.borders.right, style: "none" }, bottom: cl.letterhead_border },
  });
  const hasBorder = cl.letterhead_border.style !== "none";

  return (
    <PageShell
      config={c}
      width={pw}
      height={ph}
      margins={{ top: cl.margin_top, bottom: cl.margin_bottom, left: cl.margin_left, right: cl.margin_right }}
      hf={cl.header_footer}
    >
      <P ps={namePs} size={sz(nameTs)} align={align}>
        <T ts={nameTs} fonts={fonts}>{upper ? NAME.toUpperCase() : NAME}</T>
      </P>
      <P ps={hasBorder ? borderOnly(contactPs) : contactPs} size={sz(contactTs)} align={align}>
        <ContactLine
          parts={[{ text: CONTACT.email, link: true }, { text: CONTACT.phone, link: false }]}
          separator={sep}
          ts={contactTs}
          fonts={fonts}
          link={{ enabled: hd.hyperlinks, color: hd.link_color, underline: hd.link_underline }}
        />
      </P>
      {cl.include_date && (
        <P ps={cl.date_para} size={sz(cl.date)}>
          <T ts={cl.date} fonts={fonts}>{letterDate(cl.date_format)}</T>
        </P>
      )}
      {cl.include_recipient && (
        <P ps={{ ...cl.date_para, space_before: 0, align: "left", borders: cl.body_para.borders, shading: null }} size={sz(cl.body)}>
          <T ts={cl.body} fonts={fonts}>Hiring Manager</T>
          <br />
          <T ts={cl.body} fonts={fonts}>Northwind Technologies</T>
        </P>
      )}
      {LETTER_PARAGRAPHS.map((text, i) => (
        <P key={i} ps={cl.body_para} size={sz(cl.body)}>
          <T ts={cl.body} fonts={fonts}>{text}</T>
        </P>
      ))}
    </PageShell>
  );
}

// ── public component ────────────────────────────────────────────────────────

function pageSize(c: StyleConfig): [number, number] {
  const [w, h] = PAGE_SIZES_IN[c.page.size] ?? PAGE_SIZES_IN.letter;
  return c.page.orientation === "landscape" ? [inch(h), inch(w)] : [inch(w), inch(h)];
}

export type PreviewDoc = "resume" | "cover_letter";

interface StylePreviewProps {
  config: StyleConfig;
  /** Outer container width in px. The document scales to fit. Default 360. */
  containerWidth?: number;
  /** Zoom multiplier on top of the fit-to-width scale. Default 1. */
  zoom?: number;
  className?: string;
  /** Controlled document; omit to let the component manage it. */
  doc?: PreviewDoc;
  onDocChange?: (doc: PreviewDoc) => void;
  /** Show the resume / cover letter switch. Default true. Set false for thumbnails. */
  showSwitch?: boolean;
}

export default function StylePreview({
  config,
  containerWidth = 360,
  zoom = 1,
  className,
  doc,
  onDocChange,
  showSwitch = true,
}: StylePreviewProps) {
  const [innerDoc, setInnerDoc] = useState<PreviewDoc>("resume");
  const active = doc ?? innerDoc;
  const cfg = mergeWithDefaults(config);

  const [pw, ph] = pageSize(cfg);
  const baseScale = containerWidth / pw;
  const scale = baseScale * zoom;

  const pageRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(ph);
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const update = () => setContentH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pick = (d: PreviewDoc) => {
    setInnerDoc(d);
    onDocChange?.(d);
  };

  const h = Math.max(contentH, ph);

  return (
    <div className={className} style={{ width: containerWidth, flexShrink: 0 }}>
      {showSwitch && (
        <div className="mb-2 inline-flex rounded-md bg-muted p-0.5 text-xs">
          {(["resume", "cover_letter"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                active === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "resume" ? "Resume" : "Cover letter"}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          width: containerWidth,
          height: Math.round(h * baseScale),
          overflow: "auto",
          borderRadius: 4,
          boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
          background: "#e5e7eb",
        }}
      >
        <div style={{ width: Math.round(pw * scale), height: Math.round(h * scale), position: "relative" }}>
          <div
            ref={pageRef}
            style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: pw }}
          >
            {active === "resume" ? <Resume config={cfg} /> : <CoverLetter config={cfg} />}
          </div>
        </div>
      </div>
    </div>
  );
}
