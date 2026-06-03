import { AlertCircle, Eye, FileText, Loader2, Minus, Plus, ZoomIn } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { DocStyle, StyleConfig } from "../../types";

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
  { label: "Single (1.0)", value: "1"    },
  { label: "1.15",         value: "1.15" },
  { label: "1.25",         value: "1.25" },
  { label: "1.5",          value: "1.5"  },
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-[92vw] w-[1100px] p-0 overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        <div className="flex h-full" style={{ maxHeight: "92vh" }}>

          {/* ── Left: form ──────────────────────────── */}
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

              <hr />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Typography</p>

              <div className="grid grid-cols-3 gap-4">
                {/* Font — grouped by family type */}
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

                {/* Font sizes */}
                <div className="space-y-1.5">
                  <Label>Name size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_name}
                    onChange={(e) => onConfigChange("font_size_name", parseFloat(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Section size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_section}
                    onChange={(e) => onConfigChange("font_size_section", parseFloat(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Body size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_body}
                    onChange={(e) => onConfigChange("font_size_body", parseFloat(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact size (pt)</Label>
                  <Input type="number" step="0.5" value={config.font_size_contact}
                    onChange={(e) => onConfigChange("font_size_contact", parseFloat(e.target.value))} />
                </div>

                {/* Line spacing */}
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

              <hr />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layout & Style</p>

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
                  <Label>Section separator</Label>
                  <Select value={config.section_separator} onValueChange={(v) => onConfigChange("section_separator", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="thick_line">Thick line</SelectItem>
                      <SelectItem value="double_line">Double line</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Accent color (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={config.accent_color}
                      onChange={(e) => onConfigChange("accent_color", e.target.value.replace("#", ""))}
                      placeholder="000000"
                      maxLength={6}
                    />
                    <input
                      type="color"
                      className="h-9 w-10 rounded border cursor-pointer shrink-0"
                      value={`#${config.accent_color}`}
                      onChange={(e) => onConfigChange("accent_color", e.target.value.replace("#", ""))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Name color (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={config.name_color}
                      onChange={(e) => onConfigChange("name_color", e.target.value.replace("#", ""))}
                      placeholder="000000"
                      maxLength={6}
                    />
                    <input
                      type="color"
                      className="h-9 w-10 rounded border cursor-pointer shrink-0"
                      value={`#${config.name_color}`}
                      onChange={(e) => onConfigChange("name_color", e.target.value.replace("#", ""))}
                    />
                  </div>
                </div>

                {/* Bullet char */}
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

                {/* Contact separator */}
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
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-5">
                {([
                  ["name_bold",      "Bold name"],
                  ["name_uppercase", "Uppercase name"],
                  ["section_caps",   "Uppercase sections"],
                  ["section_bold",   "Bold section headings"],
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

              <hr />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margins & Spacing</p>

              <div className="grid grid-cols-4 gap-4">
                {([
                  ["margin_top",    "Top (in)"],
                  ["margin_bottom", "Bottom (in)"],
                  ["margin_left",   "Left (in)"],
                  ["margin_right",  "Right (in)"],
                ] as [keyof StyleConfig, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="number" step="0.05" value={config[key] as number}
                      onChange={(e) => onConfigChange(key, parseFloat(e.target.value))} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Space before section (pt)</Label>
                  <Input type="number" step="0.5" value={config.space_before_section}
                    onChange={(e) => onConfigChange("space_before_section", parseFloat(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Space after section (pt)</Label>
                  <Input type="number" step="0.5" value={config.space_after_section}
                    onChange={(e) => onConfigChange("space_after_section", parseFloat(e.target.value))} />
                </div>
              </div>
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
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Doc Styles</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage resume document formatting styles</p>
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
