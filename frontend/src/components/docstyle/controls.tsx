import { AlertTriangle, Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ATS_FONTS } from "./constants";

// ── Layout helpers ──────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label className="text-xs flex items-center gap-1">
        {label}
        {hint}
      </Label>
      {children}
    </div>
  );
}

export function Grid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const c = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return <div className={cn("grid grid-cols-2 gap-3", c)}>{children}</div>;
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">{children}</p>
  );
}

export function Block({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 space-y-3", className)}>
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/** Native <details> based collapsible block. */
export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-md border bg-muted/20">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        {title}
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  );
}

// ── Hints ───────────────────────────────────────────────────────────────────

export function WarnIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex text-amber-500 cursor-help" aria-label="Warning">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

export function HintText({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ── NumberField ─────────────────────────────────────────────────────────────

interface NumberFieldBase {
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberField(props: NumberFieldBase & { value: number; onChange: (v: number) => void }): ReactNode;
export function NumberField(
  props: NumberFieldBase & { value: number | null; nullable: true; onChange: (v: number | null) => void },
): ReactNode;
export function NumberField(
  props: NumberFieldBase & {
    value: number | null;
    nullable?: boolean;
    onChange: ((v: number) => void) | ((v: number | null) => void);
  },
): ReactNode {
  const { value, min, max, step = 0.5, className, placeholder, disabled, nullable } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  const emit = props.onChange as (v: number | null) => void;

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  return (
    <Input
      type="number"
      inputMode="decimal"
      className={cn("h-8 text-xs", className)}
      value={shown}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw === "") {
          if (nullable) emit(null);
          return;
        }
        const n = parseFloat(raw);
        if (Number.isFinite(n)) emit(clamp(n));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

// ── ColorField ──────────────────────────────────────────────────────────────

const HEX_RE = /^[0-9a-fA-F]{6}$/;

function normalizeHex(raw: string): string | null {
  const h = raw.replace("#", "").trim();
  if (/^[0-9a-fA-F]{3}$/.test(h)) return h.split("").map((c) => c + c).join("").toUpperCase();
  if (HEX_RE.test(h)) return h.toUpperCase();
  return null;
}

export function ColorField(props: {
  label?: string;
  hint?: ReactNode;
  value: string | null;
  onChange: (v: string | null) => void;
  /** Allow a "none" (null) state. */
  nullable?: boolean;
  noneLabel?: string;
}) {
  const { label, hint, value, onChange, nullable, noneLabel = "none" } = props;
  const [draft, setDraft] = useState<string | null>(null);

  const body = (
    <div className="flex gap-1.5 items-center">
      {value === null ? (
        <button
          type="button"
          onClick={() => onChange("000000")}
          className="h-8 flex-1 rounded-md border border-dashed px-2 text-left text-xs text-muted-foreground hover:bg-accent"
        >
          {noneLabel} — click to set
        </button>
      ) : (
        <>
          <Input
            value={draft ?? value}
            onChange={(e) => {
              const raw = e.target.value.replace("#", "").slice(0, 6);
              setDraft(raw);
              const n = normalizeHex(raw);
              if (n && raw.length >= 3) onChange(n);
            }}
            onBlur={() => setDraft(null)}
            placeholder="000000"
            maxLength={7}
            className="h-8 text-xs font-mono"
          />
          <input
            type="color"
            aria-label={label ? `${label} colour` : "Colour"}
            className="h-8 w-9 rounded border cursor-pointer shrink-0 bg-transparent"
            value={`#${value.padEnd(6, "0").slice(0, 6)}`}
            onChange={(e) => {
              setDraft(null);
              onChange(e.target.value.replace("#", "").toUpperCase());
            }}
          />
          {nullable && (
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                onChange(null);
              }}
              className="h-8 shrink-0 rounded-md border px-2 text-xs text-muted-foreground hover:bg-accent"
              title={`Clear (${noneLabel})`}
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  );
  return label ? (
    <Field label={label} hint={hint}>
      {body}
    </Field>
  ) : (
    body
  );
}

// ── Select / toggles ────────────────────────────────────────────────────────

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const body = (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return label ? (
    <Field label={label} hint={hint}>
      {body}
    </Field>
  ) : (
    body
  );
}

const INHERIT = "__inherit__";

export function FontSelect({
  label = "Font",
  value,
  onChange,
  allowInherit = true,
  inheritLabel = "Inherit (document font)",
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowInherit?: boolean;
  inheritLabel?: string;
}) {
  const extra = value && !(ATS_FONTS as readonly string[]).includes(value) ? value : null;
  return (
    <Field label={label}>
      <Select
        value={value ?? INHERIT}
        onValueChange={(v) => onChange(v === INHERIT ? null : v)}
      >
        <SelectTrigger className="h-8 text-xs" style={value ? { fontFamily: value } : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowInherit && (
            <SelectItem value={INHERIT} className="text-xs">
              {inheritLabel}
            </SelectItem>
          )}
          {ATS_FONTS.map((f) => (
            <SelectItem key={f} value={f} style={{ fontFamily: f }} className="text-xs">
              {f}
            </SelectItem>
          ))}
          {extra && (
            <SelectItem value={extra} className="text-xs">
              {extra} (custom)
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="flex items-center gap-1">
        {label}
        {hint}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        className="h-8 text-xs"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
