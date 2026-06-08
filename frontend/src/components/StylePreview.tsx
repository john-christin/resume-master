import type { SectionItem, StyleConfig } from "../types";

const PAGE_W = 816;  // 8.5" at 96 dpi
const PAGE_H = 1056; // 11"  at 96 dpi

const pt   = (n: number) => n * (96 / 72);
const inch = (n: number) => n * 96;

function headingContainerStyle(config: StyleConfig): React.CSSProperties {
  const color = `#${config.color_heading_line}`;
  switch (config.section_heading_style) {
    case "line_below":        return { borderBottom: `1px solid ${color}`, paddingBottom: "2px" };
    case "thick_line_below":  return { borderBottom: `3px solid ${color}`, paddingBottom: "2px" };
    case "double_line_below": return { borderBottom: `4px double ${color}`, paddingBottom: "2px" };
    case "boxed":             return { border: `1px solid ${color}`, padding: "2px 4px" };
    case "bar":               return { borderLeft: `4px solid ${color}`, paddingLeft: "6px" };
    default:                  return {};
  }
}

function SectionHeading({ title, config }: { title: string; config: StyleConfig }) {
  const containerStyle = headingContainerStyle(config);
  const isUnderline = config.section_heading_style === "underline";
  return (
    <div style={{
      marginTop: `${pt(config.space_before_section)}px`,
      marginBottom: `${pt(config.space_after_section)}px`,
      ...containerStyle,
    }}>
      <span style={{
        fontSize: `${pt(config.font_size_section)}px`,
        fontWeight: config.section_bold ? "bold" : "normal",
        fontFamily: config.font_name,
        color: `#${config.color_heading}`,
        textDecoration: isUnderline ? "underline" : "none",
      }}>
        {config.section_caps ? title.toUpperCase() : title}
      </span>
    </div>
  );
}

function getSubtitleStyle(config: StyleConfig): React.CSSProperties {
  const es = config.entry_subtitle_style;
  return {
    fontWeight: es === "bold" || es === "bold_italic" ? "bold" : "normal",
    fontStyle: es === "italic" || es === "bold_italic" ? "italic" : "normal",
  };
}

function getBulletPrefix(config: StyleConfig): string | null {
  if (config.entry_list_style === "none") return null;
  if (config.entry_list_style === "dash") return "–";
  return config.bullet_char;
}

interface ExperienceEntryProps {
  title: string;
  employer: string;
  dates: string;
  bullets: string[];
  config: StyleConfig;
}

function ExperienceEntry({ title, employer, dates, bullets, config }: ExperienceEntryProps) {
  const bodyPx    = pt(config.font_size_body);
  const ctPx      = pt(config.font_size_contact);
  const indent    = config.entry_indent_body ? "18px" : "0";
  const bPrefix   = getBulletPrefix(config);
  const subtitleS = getSubtitleStyle(config);
  const entryMb   = `${pt(config.space_between_entries)}px`;

  const BulletList = () => (
    <>
      {bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: "5px", marginLeft: indent, marginBottom: "2px" }}>
          {bPrefix && <span style={{ flexShrink: 0, fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{bPrefix}</span>}
          <span style={{ fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{b}</span>
        </div>
      ))}
    </>
  );

  if (config.experience_layout === "combined") {
    return (
      <div style={{ marginBottom: entryMb }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px` }}>
          <span style={{ fontWeight: "bold", color: `#${config.color_job_title}` }}>
            {title} | {employer}
          </span>
          <span style={{ color: `#${config.color_dates}`, fontSize: `${ctPx}px` }}>{dates}</span>
        </div>
        <BulletList />
      </div>
    );
  }

  if (config.experience_layout === "title-employer") {
    return (
      <div style={{ marginBottom: entryMb }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, marginBottom: "1px" }}>
          <span style={{ fontWeight: "bold", color: `#${config.color_job_title}` }}>{title}</span>
          <span style={{ color: `#${config.color_dates}`, fontSize: `${ctPx}px` }}>{dates}</span>
        </div>
        <div style={{ fontSize: `${pt(config.entry_subtitle_size)}px`, color: `#${config.color_employer}`, marginBottom: "2px", ...subtitleS }}>
          {employer}
        </div>
        <BulletList />
      </div>
    );
  }

  // employer-title (default)
  return (
    <div style={{ marginBottom: entryMb }}>
      <div style={{ fontSize: `${pt(config.entry_subtitle_size)}px`, color: `#${config.color_employer}`, marginBottom: "1px", ...subtitleS }}>
        {employer}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, marginBottom: "2px" }}>
        <span style={{ color: `#${config.color_job_title}` }}>{title}</span>
        <span style={{ color: `#${config.color_dates}`, fontSize: `${ctPx}px` }}>{dates}</span>
      </div>
      <BulletList />
    </div>
  );
}

interface EducationEntryProps {
  degree: string;
  school: string;
  dates: string;
  gpa?: string;
  config: StyleConfig;
}

function EducationEntry({ degree, school, dates, gpa, config }: EducationEntryProps) {
  const bodyPx    = pt(config.font_size_body);
  const ctPx      = pt(config.font_size_contact);
  const subtitleS = getSubtitleStyle(config);
  const entryMb   = `${pt(config.space_between_entries)}px`;

  if (config.education_layout === "school-degree") {
    return (
      <div style={{ marginBottom: entryMb }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, fontWeight: "bold", marginBottom: "1px" }}>
          <span style={{ color: `#${config.color_employer}` }}>{school}</span>
          <span style={{ fontWeight: "normal", fontSize: `${ctPx}px`, color: `#${config.color_dates}` }}>{dates}</span>
        </div>
        <div style={{ fontSize: `${pt(config.entry_subtitle_size)}px`, color: `#${config.color_subtitle}`, ...subtitleS }}>
          {degree}
        </div>
        {gpa && <div style={{ fontSize: `${ctPx}px`, color: `#${config.color_subtitle}`, marginTop: "2px" }}>GPA: {gpa}</div>}
      </div>
    );
  }

  // degree-school (default)
  return (
    <div style={{ marginBottom: entryMb }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, fontWeight: "bold" }}>
        <span style={{ color: `#${config.color_job_title}` }}>{degree}, {school}</span>
        <span style={{ fontWeight: "normal", fontSize: `${ctPx}px`, color: `#${config.color_dates}` }}>{dates}</span>
      </div>
      {gpa && <div style={{ fontSize: `${ctPx}px`, color: `#${config.color_subtitle}`, marginTop: "2px" }}>GPA: {gpa}</div>}
    </div>
  );
}

const MOCK_EXPERIENCES = [
  {
    title: "Senior Software Engineer",
    employer: "Acme Technologies, New York",
    dates: "Jan 2021 – Present",
    bullets: [
      "Architected microservices platform handling 50M+ daily requests with 99.9% uptime",
      "Led team of 7 engineers, delivering roadmap 20% ahead of schedule",
    ],
  },
  {
    title: "Software Engineer",
    employer: "Startup Co, San Francisco",
    dates: "Mar 2018 – Dec 2020",
    bullets: ["Built real-time data pipeline reducing latency by 40%"],
  },
];

const MOCK_EDUCATIONS = [
  { degree: "B.S. Computer Science", school: "MIT", dates: "2014 – 2018", gpa: "3.9" },
];

const SECTION_LABELS: Record<string, string> = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Professional Experience",
  education: "Education",
};

function ResumeDocument({ config }: { config: StyleConfig }) {
  const align  = config.header_layout === "centered" ? "center" as const : "left" as const;
  const bodyPx = pt(config.font_size_body);
  const ctPx   = pt(config.font_size_contact);

  const sections: SectionItem[] = config.sections?.length
    ? config.sections
    : [
        { key: "summary", visible: true },
        { key: "skills", visible: true },
        { key: "experience", visible: true },
        { key: "education", visible: true },
      ];

  function renderSection(key: string) {
    switch (key) {
      case "summary":
        return (
          <div key="summary">
            <SectionHeading title={SECTION_LABELS.summary} config={config} />
            <div style={{ fontSize: `${bodyPx}px`, marginBottom: "4px", lineHeight: config.line_spacing }}>
              Results-driven software engineer with 6+ years building scalable systems. Passionate about clean architecture and developer experience.
            </div>
          </div>
        );
      case "skills":
        return (
          <div key="skills">
            <SectionHeading title={SECTION_LABELS.skills} config={config} />
            <div style={{ fontSize: `${bodyPx}px`, marginBottom: "3px" }}><span style={{ fontWeight: "bold" }}>Languages: </span>Python, TypeScript, Go, SQL</div>
            <div style={{ fontSize: `${bodyPx}px`, marginBottom: "3px" }}><span style={{ fontWeight: "bold" }}>Frameworks: </span>FastAPI, React, PostgreSQL, Redis, Docker</div>
          </div>
        );
      case "experience":
        return (
          <div key="experience">
            <SectionHeading title={SECTION_LABELS.experience} config={config} />
            {MOCK_EXPERIENCES.map((exp, i) => (
              <ExperienceEntry key={i} {...exp} config={config} />
            ))}
          </div>
        );
      case "education":
        return (
          <div key="education">
            <SectionHeading title={SECTION_LABELS.education} config={config} />
            {MOCK_EDUCATIONS.map((edu, i) => (
              <EducationEntry key={i} {...edu} config={config} />
            ))}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div style={{
      width: `${PAGE_W}px`, height: `${PAGE_H}px`,
      backgroundColor: "#fff",
      boxSizing: "border-box",
      paddingTop:    `${inch(config.margin_top)}px`,
      paddingBottom: `${inch(config.margin_bottom)}px`,
      paddingLeft:   `${inch(config.margin_left)}px`,
      paddingRight:  `${inch(config.margin_right)}px`,
      fontFamily: config.font_name,
      color: "#111",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{ textAlign: align, marginBottom: "6px" }}>
        <div style={{
          fontSize: `${pt(config.font_size_name)}px`,
          fontWeight: config.name_bold ? "bold" : "normal",
          fontStyle: config.name_italic ? "italic" : "normal",
          letterSpacing: config.name_letter_spacing
            ? `${config.name_letter_spacing}pt`
            : config.name_uppercase ? "0.04em" : "normal",
          lineHeight: 1.15,
          color: `#${config.name_color}`,
        }}>
          {config.name_uppercase ? "ALEXANDRA JOHNSON" : "Alexandra Johnson"}
        </div>
        <div style={{ fontSize: `${ctPx}px`, color: `#${config.color_contact}`, marginTop: "4px" }}>
          {["New York, NY", "(555) 867-5309", "alex@email.com", "linkedin.com/in/alex"].join(` ${config.contact_separator} `)}
        </div>
      </div>

      {/* Sections in configured order */}
      {sections.filter(s => s.visible).map(s => renderSection(s.key))}
    </div>
  );
}

interface StylePreviewProps {
  config: StyleConfig;
  /** Outer container width in px. The document scales to fit. Default 360. */
  containerWidth?: number;
  /** Zoom multiplier on top of the fit-to-width scale. Default 1. */
  zoom?: number;
  className?: string;
}

export default function StylePreview({
  config,
  containerWidth = 360,
  zoom = 1,
  className,
}: StylePreviewProps) {
  const baseScale = containerWidth / PAGE_W;
  const scale     = baseScale * zoom;

  const outerH = Math.round(PAGE_H * baseScale);
  const innerW = Math.round(PAGE_W * scale);
  const innerH = Math.round(PAGE_H * scale);

  return (
    <div
      className={className}
      style={{
        width: `${containerWidth}px`,
        height: `${outerH}px`,
        overflow: "auto",
        borderRadius: "4px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
        flexShrink: 0,
        background: "#e5e7eb",
      }}
    >
      <div style={{ width: `${innerW}px`, height: `${innerH}px`, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: `${PAGE_W}px`, height: `${PAGE_H}px` }}>
          <ResumeDocument config={config} />
        </div>
      </div>
    </div>
  );
}
