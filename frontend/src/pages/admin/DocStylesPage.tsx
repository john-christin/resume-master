import axios from "axios";
import {
  AlertCircle,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Upload,
  ZoomIn,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createDocStyle, deleteDocStyle, getDocStyles, updateDocStyle } from "../../api/doc_styles";
import LoadingSpinner from "../../components/LoadingSpinner";
import StylePreview, { type PreviewDoc } from "../../components/StylePreview";
import { defaultStyleConfig, mergeWithDefaults, parseImportedConfig } from "../../components/docstyle/defaults";
import StyleEditor, { type EditorTab } from "../../components/docstyle/StyleEditor";
import PageHeader from "../../components/shared/PageHeader";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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

const PREVIEW_PANEL_W = 480;
const PREVIEW_PANEL_PAD = 32;
const PREVIEW_W = PREVIEW_PANEL_W - PREVIEW_PANEL_PAD;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

// ── ZoomControls ────────────────────────────────────────────────────────────

function ZoomControls({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const dec = () => onChange(Math.max(ZOOM_MIN, parseFloat((zoom - ZOOM_STEP).toFixed(2))));
  const inc = () => onChange(Math.min(ZOOM_MAX, parseFloat((zoom + ZOOM_STEP).toFixed(2))));
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={dec} disabled={zoom <= ZOOM_MIN}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="text-xs tabular-nums w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={inc} disabled={zoom >= ZOOM_MAX}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── Preview-only dialog ─────────────────────────────────────────────────────

function PreviewBody({ style }: { style: DocStyle }) {
  const [zoom, setZoom] = useState(1);
  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-4 pr-6">
          <div>
            <DialogTitle>{style.name} — Preview</DialogTitle>
            {style.description && <p className="text-sm text-muted-foreground mt-0.5">{style.description}</p>}
          </div>
          <ZoomControls zoom={zoom} onChange={setZoom} />
        </div>
      </DialogHeader>
      <div className="flex justify-center py-2 overflow-auto">
        <StylePreview config={style.config} containerWidth={540} zoom={zoom} />
      </div>
    </>
  );
}

function PreviewDialog({ style, onClose }: { style: DocStyle | null; onClose: () => void }) {
  return (
    <Dialog open={!!style} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {style && <PreviewBody key={style.id} style={style} />}
      </DialogContent>
    </Dialog>
  );
}

// ── Edit / Create dialog ────────────────────────────────────────────────────

function EditorBody({
  editingId, name, desc, config, saving, error,
  onNameChange, onDescChange, onConfigChange, onSave, onClose,
}: {
  editingId: string | null;
  name: string;
  desc: string;
  config: StyleConfig;
  saving: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onConfigChange: (c: StyleConfig) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc>("resume");
  const [importError, setImportError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const onTabChange = (tab: EditorTab) => {
    if (tab === "cover_letter") setPreviewDoc("cover_letter");
    else if (tab !== "document") setPreviewDoc("resume");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "doc-style").trim().replace(/[^\w.-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const result = parseImportedConfig(await file.text());
    if ("error" in result) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    onConfigChange(result.config);
    setEditorKey((k) => k + 1);
  };

  const reset = () => {
    if (!window.confirm("Reset all options in this editor to the defaults?")) return;
    onConfigChange(defaultStyleConfig());
    setEditorKey((k) => k + 1);
  };

  const shownError = error ?? importError;

  return (
        <div className="flex h-full" style={{ maxHeight: "94vh" }}>
          {/* ── Left: form ──────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto p-6">
            <DialogHeader className="mb-4">
              <DialogTitle>{editingId ? "Edit Doc Style" : "Create Doc Style"}</DialogTitle>
            </DialogHeader>

            {shownError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{shownError}</AlertDescription>
              </Alert>
            )}

            <form id="style-form" onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Modern" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={desc} onChange={(e) => onDescChange(e.target.value)} placeholder="Short description" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={reset}>
                  <RotateCcw className="h-3.5 w-3.5" />Reset to defaults
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />Import JSON
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={exportJson}>
                  <Download className="h-3.5 w-3.5" />Export JSON
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importJson(f);
                    e.target.value = "";
                  }}
                />
              </div>

              <StyleEditor key={editorKey} config={config} onChange={onConfigChange} onTabChange={onTabChange} />
            </form>

            <div className="flex justify-end gap-2 pt-6 mt-auto">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="style-form" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>

          {/* ── Right: live preview ──────────────────── */}
          <div className="hidden lg:flex flex-col shrink-0 border-l bg-muted/30" style={{ width: PREVIEW_PANEL_W }}>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ZoomIn className="h-3.5 w-3.5" />
                Live Preview
              </div>
              <ZoomControls zoom={zoom} onChange={setZoom} />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="sticky top-0">
                <StylePreview
                  config={config}
                  containerWidth={PREVIEW_W}
                  zoom={zoom}
                  doc={previewDoc}
                  onDocChange={setPreviewDoc}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Approximation of the DOCX. Dashed lines mark page breaks; final output may differ slightly in Word / PDF.
                </p>
              </div>
            </div>
          </div>
        </div>
  );
}

function EditDialog(props: {
  open: boolean;
  editingId: string | null;
  name: string;
  desc: string;
  config: StyleConfig;
  saving: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onConfigChange: (c: StyleConfig) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { open, ...rest } = props;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-w-[96vw] w-[1320px] p-0 overflow-hidden" style={{ maxHeight: "94vh" }}>
        <EditorBody {...rest} />
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DocStylesPage() {
  const [styles, setStyles] = useState<DocStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [config, setConfig] = useState<StyleConfig>(() => defaultStyleConfig());
  const [saving, setSaving] = useState(false);
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

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDesc("");
    setConfig(defaultStyleConfig());
    setFormError(null);
    setEditOpen(true);
  };

  const openEdit = (style: DocStyle) => {
    setEditingId(style.id);
    setName(style.name);
    setDesc(style.description ?? "");
    setConfig(mergeWithDefaults(style.config));
    setFormError(null);
    setEditOpen(true);
  };

  const handleDuplicate = async (style: DocStyle) => {
    try {
      await createDocStyle({
        name: `${style.name} (copy)`,
        description: style.description ?? null,
        config: mergeWithDefaults(style.config),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to duplicate style"));
    }
  };

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
    } catch (err) {
      setFormError(errorMessage(err, editingId ? "Failed to update style" : "Failed to create style"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (style: DocStyle) => {
    if (!window.confirm(`Delete style "${style.name}"? Profiles using it will fall back to the default.`)) return;
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
      <PageHeader
        title="Document Styles"
        description="Manage resume and cover letter templates"
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />Create Style</Button>}
      />

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
                    <TableCell className="text-sm" style={{ fontFamily: s.config.fonts?.family }}>
                      {s.config.fonts?.family ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{s.config.header?.layout ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_system ? "secondary" : "outline"}>{s.is_system ? "System" : "Custom"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewStyle(s)}>
                          <Eye className="h-4 w-4" />
                          Preview
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDuplicate(s)}>
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                        {!s.is_system && (
                          <Button size="sm" variant="destructive" onClick={() => void handleDelete(s)}>
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
        onConfigChange={setConfig}
        onSave={() => void handleSave()}
        onClose={() => setEditOpen(false)}
      />

      <PreviewDialog style={previewStyle} onClose={() => setPreviewStyle(null)} />
    </div>
  );
}
