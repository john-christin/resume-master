import type {
  BorderSide,
  HeaderFooterSettings,
  HeaderSettings,
  HeadingSettings,
  SectionKey,
} from "../../types";
import { patcher } from "./patcher";
import { DEFAULT_SECTION_TITLES, SECTION_LABELS } from "./constants";
import { SECTION_KEYS, borderSide, noBorders } from "./defaults";
import {
  Block,
  ColorField,
  Field,
  Grid,
  HintText,
  SelectField,
  SubHeading,
  SwitchField,
  TextField,
  WarnIcon,
} from "./controls";
import { ParagraphEditor, TextStyleEditor } from "./StyleBlocks";
import { ATS_WARNING_TEXT } from "./constants";
import { Button } from "../ui/button";

const SEPARATOR_OPTIONS = ["|", "·", "•", "/", "—", "–", "~"];

export function SeparatorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <input
          className="h-8 w-16 rounded-md border bg-background px-2 text-xs text-center"
          value={value}
          maxLength={10}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        {SEPARATOR_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`h-8 w-7 rounded-md border text-xs hover:bg-accent ${value === s ? "bg-accent" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function HeaderTab({ value, onChange }: { value: HeaderSettings; onChange: (v: HeaderSettings) => void }) {
  const set = patcher(value, onChange);
  return (
    <div className="space-y-4">
      <Block title="Layout">
        <Grid cols={3}>
          <Field label="Header layout">
            <SelectField
              value={value.layout}
              onChange={(v) => set("layout", v)}
              options={[
                { label: "Centered", value: "centered" },
                { label: "Left", value: "left" },
                { label: "Right", value: "right" },
              ]}
            />
          </Field>
        </Grid>
        <HintText>Name and contact lines are aligned by this layout; the paragraph alignment is ignored for the header.</HintText>
      </Block>

      <SubHeading>Name</SubHeading>
      <TextStyleEditor title="Name" value={value.name} onChange={(v) => set("name", v)} />
      <SwitchField label="Uppercase name" checked={value.name_uppercase} onChange={(v) => set("name_uppercase", v)} />
      <ParagraphEditor title="Name paragraph" hideAlign value={value.name_para} onChange={(v) => set("name_para", v)} />

      <SubHeading>Contact line</SubHeading>
      <TextStyleEditor title="Contact" value={value.contact} onChange={(v) => set("contact", v)} />
      <SeparatorField label="Separator" value={value.contact_separator} onChange={(v) => set("contact_separator", v)} />
      <ParagraphEditor title="Contact paragraph" hideAlign value={value.contact_para} onChange={(v) => set("contact_para", v)} />

      <Block title="Hyperlinks">
        <SwitchField label="Make email / LinkedIn clickable" checked={value.hyperlinks} onChange={(v) => set("hyperlinks", v)} />
        {value.hyperlinks && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              label="Link colour"
              nullable
              noneLabel="same as contact"
              value={value.link_color}
              onChange={(v) => set("link_color", v)}
            />
            <div className="flex items-end pb-1">
              <SwitchField label="Underline links" checked={value.link_underline} onChange={(v) => set("link_underline", v)} />
            </div>
          </div>
        )}
      </Block>
    </div>
  );
}

// ── Headings ────────────────────────────────────────────────────────────────

interface Preset {
  label: string;
  underline: boolean;
  sides: Partial<Record<"top" | "left" | "bottom" | "right", Partial<BorderSide>>>;
}

const ALL4 = { style: "single", width: 0.5, space: 4 } as const;
const PRESETS: Preset[] = [
  { label: "Plain", underline: false, sides: {} },
  { label: "Underline", underline: true, sides: {} },
  { label: "Line below", underline: false, sides: { bottom: { style: "single", width: 0.5, space: 1 } } },
  { label: "Thick line", underline: false, sides: { bottom: { style: "thick", width: 0.75, space: 1 } } },
  { label: "Double line", underline: false, sides: { bottom: { style: "double", width: 0.5, space: 1 } } },
  { label: "Boxed", underline: false, sides: { top: ALL4, left: ALL4, bottom: ALL4, right: ALL4 } },
  { label: "Left bar", underline: false, sides: { left: { style: "single", width: 2.25, space: 6 } } },
];

export function HeadingsTab({ value, onChange }: { value: HeadingSettings; onChange: (v: HeadingSettings) => void }) {
  const set = patcher(value, onChange);

  const applyPreset = (p: Preset) => {
    const color = value.text.color ?? "000000";
    const borders = noBorders();
    for (const side of ["top", "left", "bottom", "right"] as const) {
      const over = p.sides[side];
      if (over) borders[side] = borderSide({ ...over, color });
    }
    onChange({
      ...value,
      text: { ...value.text, underline: p.underline ? "single" : "none" },
      para: { ...value.para, borders },
    });
  };

  const setTitle = (key: SectionKey, title: string) =>
    set("titles", { ...value.titles, [key]: title });

  return (
    <div className="space-y-4">
      <Block title="Heading decoration presets">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => applyPreset(p)}>
              {p.label}
            </Button>
          ))}
        </div>
        <HintText>
          Presets use the heading text colour for the line. Fine-tune each side under Paragraph → Borders below.
        </HintText>
      </Block>

      <TextStyleEditor title="Heading text" value={value.text} onChange={(v) => set("text", v)} />
      <ParagraphEditor title="Heading paragraph (spacing, borders, shading)" defaultOpen value={value.para} onChange={(v) => set("para", v)} />

      <Block title="Section titles">
        <Grid cols={2}>
          {SECTION_KEYS.map((key) => (
            <TextField
              key={key}
              label={SECTION_LABELS[key]}
              value={value.titles[key] ?? ""}
              placeholder={DEFAULT_SECTION_TITLES[key]}
              onChange={(v) => setTitle(key, v)}
            />
          ))}
        </Grid>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WarnIcon text={ATS_WARNING_TEXT} /> Use standard titles (Experience, Education, Skills) so ATS parsers recognise sections.
        </p>
      </Block>
    </div>
  );
}

// ── Running header / footer ─────────────────────────────────────────────────

export function HeaderFooterEditor({
  value,
  onChange,
}: {
  value: HeaderFooterSettings;
  onChange: (v: HeaderFooterSettings) => void;
}) {
  const set = patcher(value, onChange);
  return (
    <div className="space-y-4">
      <Block title="Content">
        <Grid cols={2}>
          <TextField label="Header text" value={value.header_text} placeholder="e.g. {name}" onChange={(v) => set("header_text", v)} />
          <TextField label="Footer text" value={value.footer_text} placeholder="e.g. {name} — Confidential" onChange={(v) => set("footer_text", v)} />
          <Field label="Page numbers">
            <SelectField
              value={value.page_numbers}
              onChange={(v) => set("page_numbers", v)}
              options={[
                { label: "None", value: "none" },
                { label: "1", value: "number" },
                { label: "Page 1 of N", value: "page_of_total" },
              ]}
            />
          </Field>
          <Field label="Page number position">
            <SelectField
              value={value.page_number_position}
              onChange={(v) => set("page_number_position", v)}
              options={[
                { label: "Footer", value: "footer" },
                { label: "Header", value: "header" },
              ]}
            />
          </Field>
        </Grid>
        <SwitchField
          label="Different first page (no header / footer on page 1)"
          checked={value.different_first_page}
          onChange={(v) => set("different_first_page", v)}
        />
        <HintText>{"{name}"} is replaced with the candidate name.</HintText>
      </Block>
      <TextStyleEditor title="Header / footer text" value={value.text} onChange={(v) => set("text", v)} />
      <ParagraphEditor title="Header / footer paragraph" value={value.para} onChange={(v) => set("para", v)} />
    </div>
  );
}
