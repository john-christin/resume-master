import type { StyleConfig } from "../types";

const PAGE_W = 816;  // 8.5" at 96 dpi
const PAGE_H = 1056; // 11"  at 96 dpi

const pt   = (n: number) => n * (96 / 72);
const inch = (n: number) => n * 96;

function sepStyle(config: StyleConfig): React.CSSProperties {
  const color = `#${config.accent_color}`;
  switch (config.section_separator) {
    case "line":        return { borderBottom: `1px solid ${color}` };
    case "thick_line":  return { borderBottom: `3px solid ${color}` };
    case "double_line": return { borderBottom: `4px double ${color}` };
    default:            return {};
  }
}

function SectionHeading({ title, config }: { title: string; config: StyleConfig }) {
  const s = sepStyle(config);
  return (
    <div style={{ marginTop: `${pt(config.space_before_section)}px`, marginBottom: `${pt(config.space_after_section)}px`, paddingBottom: s.borderBottom ? "2px" : 0, ...s }}>
      <span style={{ fontSize: `${pt(config.font_size_section)}px`, fontWeight: config.section_bold ? "bold" : "normal", fontFamily: config.font_name }}>
        {config.section_caps ? title.toUpperCase() : title}
      </span>
    </div>
  );
}

function ResumeDocument({ config }: { config: StyleConfig }) {
  const align  = config.header_layout === "centered" ? "center" as const : "left" as const;
  const bodyPx = pt(config.font_size_body);
  const ctPx   = pt(config.font_size_contact);
  const dim    = "#555";

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
        <div style={{ fontSize: `${pt(config.font_size_name)}px`, fontWeight: config.name_bold ? "bold" : "normal", letterSpacing: config.name_uppercase ? "0.04em" : "normal", lineHeight: 1.15, color: `#${config.name_color}` }}>
          {config.name_uppercase ? "ALEXANDRA JOHNSON" : "Alexandra Johnson"}
        </div>
        <div style={{ fontSize: `${ctPx}px`, color: "#444", marginTop: "4px" }}>
          {["New York, NY", "(555) 867-5309", "alex@email.com", "linkedin.com/in/alex"].join(` ${config.contact_separator} `)}
        </div>
      </div>

      {/* Experience */}
      <SectionHeading title="Professional Experience" config={config} />
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: `${bodyPx}px`, marginBottom: "1px" }}>Acme Technologies, New York</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, marginBottom: "2px" }}>
          <span>Senior Software Engineer</span>
          <span style={{ color: dim, fontSize: `${ctPx}px` }}>Jan 2021 – Present</span>
        </div>
        <div style={{ marginLeft: "18px" }}>
          {["Architected microservices platform handling 50M+ daily requests with 99.9% uptime", "Led cross-functional team of 7 engineers, delivering roadmap 20% ahead of schedule", "Reduced infrastructure costs by $180K/year through query optimization and caching"].map((b, i) => (
            <div key={i} style={{ display: "flex", gap: "5px", marginBottom: "2px" }}>
              <span style={{ flexShrink: 0, fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{config.bullet_char}</span>
              <span style={{ fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: `${bodyPx}px`, marginBottom: "1px" }}>Startup Co, San Francisco</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, marginBottom: "2px" }}>
          <span>Software Engineer</span>
          <span style={{ color: dim, fontSize: `${ctPx}px` }}>Mar 2018 – Dec 2020</span>
        </div>
        <div style={{ marginLeft: "18px" }}>
          {["Built real-time data pipeline reducing processing latency by 40%", "Designed REST APIs serving 2M daily active users across mobile and web clients"].map((b, i) => (
            <div key={i} style={{ display: "flex", gap: "5px", marginBottom: "2px" }}>
              <span style={{ flexShrink: 0, fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{config.bullet_char}</span>
              <span style={{ fontSize: `${bodyPx}px`, lineHeight: config.line_spacing }}>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <SectionHeading title="Technical Skills" config={config} />
      <div style={{ fontSize: `${bodyPx}px`, marginBottom: "3px" }}><span style={{ fontWeight: "bold" }}>Languages: </span>Python, TypeScript, Go, SQL</div>
      <div style={{ fontSize: `${bodyPx}px`, marginBottom: "3px" }}><span style={{ fontWeight: "bold" }}>Frameworks: </span>FastAPI, React, PostgreSQL, Redis, Docker, Kubernetes</div>

      {/* Education */}
      <SectionHeading title="Education" config={config} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${bodyPx}px`, fontWeight: "bold" }}>
        <span>B.S. Computer Science, Massachusetts Institute of Technology</span>
        <span style={{ fontWeight: "normal", fontSize: `${ctPx}px`, color: dim }}>2014 – 2018</span>
      </div>
      <div style={{ fontSize: `${ctPx}px`, color: dim, marginTop: "2px" }}>GPA: 3.9</div>
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

  // Outer box is always containerWidth wide. Height = full page at base scale
  // so zoom=1 shows the whole page; zoom>1 lets you scroll into detail.
  const outerH = Math.round(PAGE_H * baseScale);
  // Inner spacer gives the scrollable area the correct scrollable dimensions.
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
      {/* Spacer div establishes correct scroll dimensions */}
      <div style={{ width: `${innerW}px`, height: `${innerH}px`, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: `${PAGE_W}px`, height: `${PAGE_H}px` }}>
          <ResumeDocument config={config} />
        </div>
      </div>
    </div>
  );
}
