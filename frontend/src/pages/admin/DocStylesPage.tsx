import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Eye, FileText, GripVertical, Loader2, Minus, Plus, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { createDocStyle, deleteDocStyle, getDocStyles, updateDocStyle } from "../../api/doc_styles";
import LoadingSpinner from "../../components/LoadingSpinner";
import StylePreview from "../../components/StylePreview";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { DocStyle, SectionItem, StyleConfig } from "../../types";

// ── constants ───────────────────────────────────────────────────────────────

const PREVIEW_PANEL_W   = 420;
const PREVIEW_PANEL_PAD = 32;
const PREVIEW_W         = PREVIEW_PANEL_W - PREVIEW_PANEL_PAD;

const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 3.0;
const ZOOM_STEP = 0.25;

const SANS_FONTS  = ["Calibri", "Arial", "Helvetica", "Verdana", "Trebuchet MS", "Century Gothic", "Tahoma"];
const SERIF_FONTS = ["Cambria", "Georgia", "Garamond", "Times New Roman", "Book Antiqua", "Palatino Linotype"];

const BULLET_OPTIONS = [
  { label: "• Filled circle", value: "•" },
  { label: "– En dash",       value: "–" },
  { label: "▸ Triangle",      value: "▸" },
  { label: "◦ Open circle",   value: "◦" },
  { label: "→ Arrow",         value: "→" },
  { label: "* Asterisk",      value: "*" },
];

const CONTACT_SEP_OPTIONS = [
  { label: "| Pipe",       value: "|" },
  { label: "· Middle dot", value: "·" },
  { label: "• Bullet",     value: "•" },
  { label: "/ Slash",      value: "/" },
  { label: "— Em dash",    value: "—" },
];

const LINE_SPACING_OPTIONS = [
  { label: "0.5",          value: "0.5"  },
  { label: "0.75",         value: "0.75" },
  { label: "Single (1.0)", value: "1"    },
  { label: "1.15",         value: "1.15" },
  { label: "1.25",         value: "1.25" },
  { label: "1.5",          value: "1.5"  },
];

const SECTION_HEADING_STYLE_OPTIONS = [
  { label: "Plain (no decoration)",  value: "plain" },
  { label: "Underline",              value: "underline" },
  { label: "Line below",             value: "line_below" },
  { label: "Thick line below",       value: "thick_line_below" },
  { label: "Double line below",      value: "double_line_below" },
  { label: "Boxed (full border)",    value: "boxed" },
  { label: "Bar (left stripe)",      value: "bar" },
];

const ENTRY_SUBTITLE_STYLE_OPTIONS = [
  { label: "Normal",      value: "normal" },
  { label: "Bold",        value: "bold" },
  { label: "Italic",      value: "italic" },
  { label: "Bold Italic", value: "bold_italic" },
];

const ENTRY_LIST_STYLE_OPTIONS = [
  { label: "Bullet",  value: "bullet" },
  { label: "Dash",    value: "dash" },
  { label: "None",    value: "none" },
];

const EXPERIENCE_LAYOUT_OPTIONS = [
  { label: "Employer → Title (default)", value: "employer-title" },
  { label: "Title → Employer",           value: "title-employer" },
  { label: "Combined (Title | Employer)", value: "combined" },
];

const EDUCATION_LAYOUT_OPTIONS = [
  { label: "Degree → School (default)", value: "degree-school" },
  { label: "School → Degree",           value: "school-degree" },
];

const SECTION_LABELS: Record<string, string> = {
  summary:    "Summary",
  skills:     "Skills",
  experience: "Experience",
  education:  "Education",
};

const DEFAULT_SECTIONS: SectionItem[] = [
  { key: "summary",    visible: true },
  { key: "skills",     visible: true },
  { key: "experience", visible: true },
  { key: "education",  visible: true },
];

const DEFAULT_CONFIG: StyleConfig = {
  font_name: "Calibri",
  font_size_name: 16,
  font_size_section: 10,
  font_size_body: 9.5,
  font_size_contact: 9,
  header_layout: "centered",
  accent_color: "000000",
  name_color: "000000",
  section_separator: "line",
  name_bold: true,
  name_uppercase: true,
  section_caps: false,
  section_bold: true,
  margin_top: 0.5,
  margin_bottom: 0.5,
  margin_left: 0.5,
  margin_right: 0.5,
  space_before_section: 4,
  space_after_section: 3,
  line_spacing: 1.0,
  bullet_char: "•",
  contact_separator: "|",
  // New fields
  sections: DEFAULT_SECTIONS,
  section_heading_style: "line_below",
  space_between_entries: 3.0,
  entry_title_size: 10.0,
  entry_subtitle_size: 9.5,
  entry_subtitle_style: "bold",
  entry_list_style: "bullet",
  entry_indent_body: true,
  color_heading: "000000",
  color_heading_line: "000000",
  color_job_title: "000000",
  color_employer: "000000",
  color_dates: "555555",
  color_subtitle: "000000",
  color_contact: "444444",
  name_italic: false,
  name_letter_spacing: 0.0,
  experience_layout: "employer-title",
  education_layout: "degree-school",
};

// ── ZoomControls ────────────────────────────────────────────────────────────

function ZoomControls({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const dec = () => onChange(Math.max(ZOOM_MIN, parseFloat((zoom - ZOOM_STEP).toFixed(2))));
  const inc = () => onChange(Math.min(ZOOM_MAX, parseFloat((zoom + ZOOM_STEP).toFixed(2))));
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={dec} disabled={zoom <= ZOOM_MIN}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="text-xs tabular-nums w-10 text-center text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={inc} disabled={zoom >= ZOOM_MAX}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── ColorField ──────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5 items-center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.replace("#", ""))}
          placeholder="000000"
          maxLength={6}
          className="h-8 text-xs font-mono"
        />
        <input
          type="color"
          className="h-8 w-9 rounded border cursor-pointer shrink-0"
          value={`#${value.padEnd(6, "0")}`}
          onChange={(e) => onChange(e.target.value.replace("#", ""))}
        />
      </div>
    </div>
  );
}

// ── SectionOrderEditor (drag-to-reorder) ────────────────────────────────────

function SortableSection({
  item,
  onToggle,
}: {
  item: SectionItem;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{SECTION_LABELS[item.key] ?? item.key}</span>
      <Switch checked={item.visible} onCheckedChange={onToggle} />
    </div>
  );
}

function SectionOrderEditor({
  sections,
  onChange,
}: {
  sections: SectionItem[];
  onChange: (s: SectionItem[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.key === active.id);
      const newIndex = sections.findIndex((s) => s.key === over.id);
      onChange(arrayMove(sections, oldIndex, newIndex));
    }
  };

  const toggleVisible = (key: string) => {
    onChange(sections.map((s) => s.key === key ? { ...s, visible: !s.visible } : s));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {sections.map((item) => (
            <SortableSection key={item.key} item={item} onToggle={() => toggleVisible(item.key)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Preview-only dialog ─────────────────────────────────────────────────────

function PreviewDialog({ style, onClose }: { style: DocStyle | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => { setZoom(1); }, [style?.id]);

  return (
    <Dialog open={!!style} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{style?.name} — Preview</DialogTitle>
              {style?.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{style.description}</p>
              )}
            </div>
            <ZoomControls zoom={zoom} onChange={setZoom} />
          </div>
        </DialogHeader>
        {style && (
          <div className="flex justify-center py-2 overflow-auto">
            <StylePreview config={style.config} containerWidth={540} zoom={zoom} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Section label ────────────────────────────────────────────────────────────

function FormSection({ label }: { label: string }) {
  return (
    <>
      <hr />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </>
  );
}

// ── Edit / Create dialog ────────────────────────────────────────────────────

function EditDialog({
  open, editingId, name, desc, config, saving, error,
  onNameChange, onDescChange, onConfigChange, onSave, onClose,
}: {
  open: boolean;
  editingId: string | null;
  name: string;
  desc: string;
  config: StyleConfig;
  saving: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onConfigChange: (key: keyof StyleConfig, value: unknown) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => { if (open) setZoom(1); }, [open]);

  const cfg = (key: keyof StyleConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onConfigChange(key, parseFloat(e.target.value));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-[92vw] w-[1100px] p-0 overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        <div className="flex h-full" style={{ maxHeight: "92vh" }}>

          {/* ── Left: form ──────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto p-6">
            <DialogHeader className="mb-4">
              <DialogTitle>{editingId ? "Edit Doc Style" : "Create Doc Style"}</DialogTitle>
            </DialogHeader>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form id="style-form" onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-5">

              {/* Name & description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Modern" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={desc} onChange={(e) => onDescChange(e.target.value)} placeholder="Short description" />
                </div>
              </div>

              <FormSection label="Typography" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-1">
                  <Label>Font</Label>
                  <Select value={config.font_name} onValueChange={(v) => onConfigChange("font_name", v)}>
                    <SelectTrigger style={{ fontFamily: config.font_name }}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Sans-serif</SelectLabel>
                        {SANS_FONTS.map((f) => (
                          <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Serif</SelectLabel>
                        {SERIF_FONTS.map((f) => (
                          <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Name size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_name} onChange={cfg("font_size_name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Section size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_section} onChange={cfg("font_size_section")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Body size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_body} onChange={cfg("font_size_body")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_contact} onChange={cfg("font_size_contact")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Line spacing</Label>
                  <Select
                    value={String(config.line_spacing)}
                    onValueChange={(v) => onConfigChange("line_spacing", parseFloat(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LINE_SPACING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FormSection label="Header & Name" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Header layout</Label>
                  <Select value={config.header_layout} onValueChange={(v) => onConfigChange("header_layout", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="centered">Centered</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contact separator</Label>
                  <Select value={config.contact_separator} onValueChange={(v) => onConfigChange("contact_separator", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTACT_SEP_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Letter spacing (pt)</Label>
                  <Input type="number" step="0.5" value={config.name_letter_spacing} onChange={cfg("name_letter_spacing")} />
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                {([
                  ["name_bold",      "Bold name"],
                  ["name_uppercase", "Uppercase name"],
                  ["name_italic",    "Italic name"],
                ] as [keyof StyleConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={config[key] as boolean}
                      onChange={(e) => onConfigChange(key, e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <FormSection label="Section Headings" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Heading style</Label>
                  <Select
                    value={config.section_heading_style}
                    onValueChange={(v) => onConfigChange("section_heading_style", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTION_HEADING_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                {([
                  ["section_bold", "Bold headings"],
                  ["section_caps", "Uppercase headings"],
                ] as [keyof StyleConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={config[key] as boolean}
                      onChange={(e) => onConfigChange(key, e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <FormSection label="Entry Layout" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Title size (pt)</Label>
                  <Input type="number" step="0.5" value={config.entry_title_size} onChange={cfg("entry_title_size")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Subtitle size (pt)</Label>
                  <Input type="number" step="0.5" value={config.entry_subtitle_size} onChange={cfg("entry_subtitle_size")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Subtitle style</Label>
                  <Select
                    value={config.entry_subtitle_style}
                    onValueChange={(v) => onConfigChange("entry_subtitle_style", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTRY_SUBTITLE_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>List style</Label>
                  <Select
                    value={config.entry_list_style}
                    onValueChange={(v) => onConfigChange("entry_list_style", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTRY_LIST_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {config.entry_list_style === "bullet" && (
                  <div className="space-y-1.5">
                    <Label>Bullet character</Label>
                    <Select value={config.bullet_char} onValueChange={(v) => onConfigChange("bullet_char", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BULLET_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={config.entry_indent_body}
                    onChange={(e) => onConfigChange("entry_indent_body", e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Indent bullet body
                </label>
              </div>

              <FormSection label="Experience & Education" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Experience layout</Label>
                  <Select
                    value={config.experience_layout}
                    onValueChange={(v) => onConfigChange("experience_layout", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Education layout</Label>
                  <Select
                    value={config.education_layout}
                    onValueChange={(v) => onConfigChange("education_layout", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FormSection label="Margins & Spacing" />

              <div className="grid grid-cols-4 gap-4">
                {([
                  ["margin_top",    "Top (in)"],
                  ["margin_bottom", "Bottom (in)"],
                  ["margin_left",   "Left (in)"],
                  ["margin_right",  "Right (in)"],
                ] as [keyof StyleConfig, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="number" step="0.05" value={config[key] as number} onChange={cfg(key)} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Space before section (pt)</Label>
                  <Input type="number" step="0.5" value={config.space_before_section} onChange={cfg("space_before_section")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Space after section (pt)</Label>
                  <Input type="number" step="0.5" value={config.space_after_section} onChange={cfg("space_after_section")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Between entries (pt)</Label>
                  <Input type="number" step="0.5" value={config.space_between_entries} onChange={cfg("space_between_entries")} />
                </div>
              </div>

              <FormSection label="Element Colors" />

              <div className="grid grid-cols-4 gap-4">
                <ColorField label="Name" value={config.name_color} onChange={(v) => onConfigChange("name_color", v)} />
                <ColorField label="Contact" value={config.color_contact} onChange={(v) => onConfigChange("color_contact", v)} />
                <ColorField label="Heading text" value={config.color_heading} onChange={(v) => onConfigChange("color_heading", v)} />
                <ColorField label="Heading line/border" value={config.color_heading_line} onChange={(v) => onConfigChange("color_heading_line", v)} />
                <ColorField label="Job title" value={config.color_job_title} onChange={(v) => onConfigChange("color_job_title", v)} />
                <ColorField label="Employer/school" value={config.color_employer} onChange={(v) => onConfigChange("color_employer", v)} />
                <ColorField label="Dates" value={config.color_dates} onChange={(v) => onConfigChange("color_dates", v)} />
                <ColorField label="Subtitle" value={config.color_subtitle} onChange={(v) => onConfigChange("color_subtitle", v)} />
              </div>

              <FormSection label="Section Order" />

              <p className="text-xs text-muted-foreground">Drag to reorder. Toggle to show/hide.</p>
              <SectionOrderEditor
                sections={config.sections ?? DEFAULT_SECTIONS}
                onChange={(s) => onConfigChange("sections", s)}
              />

            </form>

            <div className="flex justify-end gap-2 pt-6 mt-auto">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="style-form" disabled={saving}>
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>

          {/* ── Right: live preview ──────────────────── */}
          <div
            className="hidden lg:flex flex-col shrink-0 border-l bg-muted/30"
            style={{ width: `${PREVIEW_PANEL_W}px` }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-muted/60 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ZoomIn className="h-3.5 w-3.5" />
                Live Preview
              </div>
              <ZoomControls zoom={zoom} onChange={setZoom} />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <StylePreview config={config} containerWidth={PREVIEW_W} zoom={zoom} />
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DocStylesPage() {
  const [styles, setStyles]   = useState<DocStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [editOpen, setEditOpen]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [desc, setDesc]           = useState("");
  const [config, setConfig]       = useState<StyleConfig>(DEFAULT_CONFIG);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [previewStyle, setPreviewStyle] = useState<DocStyle | null>(null);

  const load = async () => {
    try {
      const res = await getDocStyles();
      setStyles(res.data);
    } catch {
      setError("Failed to load doc styles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDesc("");
    setConfig(DEFAULT_CONFIG);
    setFormError(null);
    setEditOpen(true);
  };

  const openEdit = (style: DocStyle) => {
    setEditingId(style.id);
    setName(style.name);
    setDesc(style.description ?? "");
    setConfig({ ...DEFAULT_CONFIG, ...style.config });
    setFormError(null);
    setEditOpen(true);
  };

  const updateConfig = (key: keyof StyleConfig, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateDocStyle(editingId, { name, description: desc || null, config });
      } else {
        await createDocStyle({ name, description: desc || null, config });
      }
      setEditOpen(false);
      await load();
    } catch {
      setFormError(editingId ? "Failed to update style" : "Failed to create style");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (style: DocStyle) => {
    if (!window.confirm(`Delete style "${style.name}"? Profiles using it will fall back to the default.`))
      return;
    try {
      await deleteDocStyle(style.id);
      await load();
    } catch {
      setError("Failed to delete style");
    }
  };

  if (loading) return <LoadingSpinner message="Loading doc styles..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Document Styles</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage resume and cover letter templates</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Style
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {styles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No doc styles found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Font</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styles.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{s.description ?? "—"}</TableCell>
                    <TableCell className="text-sm" style={{ fontFamily: s.config.font_name }}>{s.config.font_name}</TableCell>
                    <TableCell className="text-sm capitalize">{s.config.header_layout}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_system ? "secondary" : "outline"}>
                        {s.is_system ? "System" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewStyle(s)}>
                          <Eye className="h-4 w-4" />
                          Preview
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                        {!s.is_system && (
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(s)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EditDialog
        open={editOpen}
        editingId={editingId}
        name={name}
        desc={desc}
        config={config}
        saving={saving}
        error={formError}
        onNameChange={setName}
        onDescChange={setDesc}
        onConfigChange={updateConfig}
        onSave={handleSave}
        onClose={() => setEditOpen(false)}
      />

      <PreviewDialog
        style={previewStyle}
        onClose={() => setPreviewStyle(null)}
      />
    </div>
  );
}
