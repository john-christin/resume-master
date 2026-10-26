import type { BorderSide, Borders, ParagraphStyle, TextStyle } from "../../types";
import { patcher } from "./patcher";
import { cn } from "@/lib/utils";
import { ALIGN_IGNORED_HINT, ATS_WARNING_TEXT, BORDER_STYLE_OPTIONS, UNDERLINE_OPTIONS } from "./constants";
import {
  Block,
  Collapsible,
  ColorField,
  Field,
  FontSelect,
  Grid,
  HintText,
  NumberField,
  SelectField,
  SwitchField,
  WarnIcon,
} from "./controls";

// ── TextStyleEditor ─────────────────────────────────────────────────────────

function ToggleButton({
  pressed,
  onClick,
  children,
  className,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-8 min-w-8 rounded-md border px-2 text-xs transition-colors",
        pressed ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextStyleEditor({
  title,
  value,
  onChange,
  inheritLabel,
}: {
  title?: string;
  value: TextStyle;
  onChange: (v: TextStyle) => void;
  inheritLabel?: string;
}) {
  const set = patcher(value, onChange);
  return (
    <Block title={title}>
      <Grid cols={4}>
        <FontSelect value={value.font} onChange={(v) => set("font", v)} inheritLabel={inheritLabel} />
        <Field label="Size (pt)">
          <NumberField
            nullable
            value={value.size}
            min={1}
            max={96}
            step={0.5}
            placeholder="inherit"
            onChange={(v) => set("size", v)}
          />
        </Field>
        <Field label="Underline">
          <SelectField value={value.underline} options={UNDERLINE_OPTIONS} onChange={(v) => set("underline", v)} />
        </Field>
        <Field label="Letter spacing (pt)">
          <NumberField value={value.letter_spacing} min={-5} max={20} step={0.1} onChange={(v) => set("letter_spacing", v)} />
        </Field>
        <ColorField
          label="Colour"
          nullable
          noneLabel="automatic"
          value={value.color}
          onChange={(v) => set("color", v)}
        />
        <ColorField
          label="Highlight"
          hint={<WarnIcon text={ATS_WARNING_TEXT} />}
          nullable
          noneLabel="none"
          value={value.highlight}
          onChange={(v) => set("highlight", v)}
        />
      </Grid>
      <div className="flex flex-wrap gap-1.5">
        <ToggleButton pressed={value.bold} onClick={() => set("bold", !value.bold)} className="font-bold">B</ToggleButton>
        <ToggleButton pressed={value.italic} onClick={() => set("italic", !value.italic)} className="italic">I</ToggleButton>
        <ToggleButton pressed={value.strike} onClick={() => set("strike", !value.strike)} className="line-through">S</ToggleButton>
        <ToggleButton pressed={value.small_caps} onClick={() => set("small_caps", !value.small_caps)}>
          <span style={{ fontVariant: "small-caps" }}>Small caps</span>
        </ToggleButton>
        <ToggleButton pressed={value.all_caps} onClick={() => set("all_caps", !value.all_caps)}>ALL CAPS</ToggleButton>
      </div>
    </Block>
  );
}

// ── Borders ─────────────────────────────────────────────────────────────────

export function BorderSideEditor({
  label,
  value,
  onChange,
  warn,
}: {
  label?: string;
  value: BorderSide;
  onChange: (v: BorderSide) => void;
  warn?: boolean;
}) {
  const set = patcher(value, onChange);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-[4rem_1fr_1fr_1.4fr_1fr] gap-2 items-end">
      {label && (
        <span className="text-xs font-medium col-span-2 sm:col-span-1 sm:pb-2 flex items-center gap-1">
          {label}
          {warn && value.style !== "none" && <WarnIcon text={ATS_WARNING_TEXT} />}
        </span>
      )}
      <Field label="Style">
        <SelectField value={value.style} options={BORDER_STYLE_OPTIONS} onChange={(v) => set("style", v)} />
      </Field>
      <Field label="Width (pt)">
        <NumberField value={value.width} min={0.25} max={6} step={0.25} onChange={(v) => set("width", v)} />
      </Field>
      <ColorField label="Colour" value={value.color} onChange={(v) => set("color", v ?? "000000")} />
      <Field label="Space (pt)">
        <NumberField value={value.space} min={0} max={31} step={1} onChange={(v) => set("space", v)} />
      </Field>
    </div>
  );
}

export function BordersEditor({ value, onChange }: { value: Borders; onChange: (v: Borders) => void }) {
  const set = patcher(value, onChange);
  return (
    <div className="space-y-3">
      <BorderSideEditor label="Top" value={value.top} onChange={(v) => set("top", v)} />
      <BorderSideEditor label="Left" value={value.left} onChange={(v) => set("left", v)} />
      <BorderSideEditor label="Bottom" value={value.bottom} onChange={(v) => set("bottom", v)} />
      <BorderSideEditor label="Right" value={value.right} onChange={(v) => set("right", v)} />
    </div>
  );
}

// ── ParagraphEditor ─────────────────────────────────────────────────────────

const ALIGN_OPTIONS = [
  { label: "Left", value: "left" as const },
  { label: "Center", value: "center" as const },
  { label: "Right", value: "right" as const },
  { label: "Justify", value: "justify" as const },
];

const LINE_MODE_OPTIONS = [
  { label: "Multiple", value: "multiple" as const },
  { label: "Exactly (pt)", value: "exact" as const },
  { label: "At least (pt)", value: "at_least" as const },
];

export function ParagraphEditor({
  title = "Paragraph",
  value,
  onChange,
  hideAlign,
  defaultOpen,
}: {
  title?: string;
  value: ParagraphStyle;
  onChange: (v: ParagraphStyle) => void;
  /** Alignment is driven by another setting (header layout / letterhead). */
  hideAlign?: boolean;
  defaultOpen?: boolean;
}) {
  const set = patcher(value, onChange);
  const multiple = value.line_spacing_mode === "multiple";
  return (
    <Collapsible title={title} defaultOpen={defaultOpen}>
      <Grid cols={4}>
        {!hideAlign && (
          <Field label="Align">
            <SelectField value={value.align} options={ALIGN_OPTIONS} onChange={(v) => set("align", v)} />
          </Field>
        )}
        <Field label="Space before (pt)">
          <NumberField value={value.space_before} min={0} max={200} step={0.5} onChange={(v) => set("space_before", v)} />
        </Field>
        <Field label="Space after (pt)">
          <NumberField value={value.space_after} min={0} max={200} step={0.5} onChange={(v) => set("space_after", v)} />
        </Field>
        <Field label="Line spacing">
          <SelectField
            value={value.line_spacing_mode}
            options={LINE_MODE_OPTIONS}
            onChange={(v) => set("line_spacing_mode", v)}
          />
        </Field>
        <Field label={multiple ? "Line multiple" : "Line height (pt)"}>
          <NumberField
            value={value.line_spacing}
            min={0.5}
            max={200}
            step={multiple ? 0.05 : 0.5}
            onChange={(v) => set("line_spacing", v)}
          />
        </Field>
        <Field label="Left indent (in)">
          <NumberField value={value.left_indent} min={0} max={5} step={0.05} onChange={(v) => set("left_indent", v)} />
        </Field>
        <Field label="Right indent (in)">
          <NumberField value={value.right_indent} min={0} max={5} step={0.05} onChange={(v) => set("right_indent", v)} />
        </Field>
        <Field label="First line (in, − = hanging)">
          <NumberField
            value={value.first_line_indent}
            min={-5}
            max={5}
            step={0.05}
            onChange={(v) => set("first_line_indent", v)}
          />
        </Field>
      </Grid>
      {hideAlign && <HintText>{ALIGN_IGNORED_HINT}</HintText>}
      <div className="flex flex-wrap gap-5">
        <SwitchField label="Keep with next" checked={value.keep_with_next} onChange={(v) => set("keep_with_next", v)} />
        <SwitchField label="Keep lines together" checked={value.keep_together} onChange={(v) => set("keep_together", v)} />
      </div>
      <div className="max-w-xs">
        <ColorField
          label="Shading (background)"
          hint={<WarnIcon text={ATS_WARNING_TEXT} />}
          nullable
          noneLabel="none"
          value={value.shading}
          onChange={(v) => set("shading", v)}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Borders</p>
        <BordersEditor value={value.borders} onChange={(v) => set("borders", v)} />
      </div>
    </Collapsible>
  );
}
