import { AlertCircle, BookOpen, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBases,
  getTechStacks,
  updateKnowledgeBase,
} from "../../api/admin";
import LoadingSpinner from "../../components/LoadingSpinner";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import type { KnowledgeBase, TechStack } from "../../types";
import { cn } from "@/lib/utils";

export default function KnowledgeBasePage() {
  const [kbList, setKbList] = useState<KnowledgeBase[]>([]);
  const [stacks, setStacks] = useState<TechStack[]>([]);
  const [filterStack, setFilterStack] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kbName, setKbName] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbStackId, setKbStackId] = useState<string>("__general__");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [kbRes, stackRes] = await Promise.all([
        getKnowledgeBases(),
        getTechStacks(),
      ]);
      setKbList(kbRes.data);
      setStacks(stackRes.data);
    } catch {
      setError("Failed to load knowledge bases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (kb?: KnowledgeBase) => {
    setEditingId(kb?.id ?? null);
    setKbName(kb?.name ?? "");
    setKbContent(kb?.content ?? "");
    setKbStackId(kb?.tech_stack_id ?? (filterStack || "__general__"));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const stackIdVal = kbStackId === "__general__" ? null : kbStackId;
    try {
      if (editingId) {
        await updateKnowledgeBase(editingId, {
          name: kbName,
          content: kbContent,
          tech_stack_id: stackIdVal,
        });
      } else {
        await createKnowledgeBase(kbName, kbContent, stackIdVal);
      }
      setModalOpen(false);
      setError(null);
      await load();
    } catch {
      setError(editingId ? "Failed to update knowledge base" : "Failed to create knowledge base");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (kb: KnowledgeBase) => {
    try {
      await updateKnowledgeBase(kb.id, { is_active: !kb.is_active });
      await load();
    } catch {
      setError("Failed to toggle knowledge base");
    }
  };

  const handleDelete = async (kb: KnowledgeBase) => {
    if (!window.confirm(`Delete knowledge base "${kb.name}"?`)) return;
    try {
      await deleteKnowledgeBase(kb.id);
      await load();
    } catch {
      setError("Failed to delete knowledge base");
    }
  };

  const filtered = kbList.filter((kb) =>
    filterStack === ""
      ? kb.tech_stack_id === null || kb.tech_stack_id === undefined
      : kb.tech_stack_id === filterStack
  );

  if (loading) return <LoadingSpinner message="Loading knowledge bases..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <BookOpen className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              AI instructions and guidelines per tech stack
            </p>
          </div>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Create KB
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stack filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {[{ id: "", name: "General" }, ...stacks].map((s) => (
          <button
            key={s.id}
            onClick={() => setFilterStack(s.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              filterStack === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No knowledge bases here</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one for this stack or switch the filter above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((kb) => (
            <Card key={kb.id} className={!kb.is_active ? "opacity-60" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{kb.name}</h3>
                      <Badge variant="secondary">
                        {kb.tech_stack_id
                          ? (stacks.find((s) => s.id === kb.tech_stack_id)?.name ?? "Stack")
                          : "General"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(kb.created_at).toLocaleDateString()}
                      {kb.updated_at &&
                        ` · Updated ${new Date(kb.updated_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={kb.is_active ? "success" : "secondary"} className="shrink-0">
                    {kb.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto mb-4">
                  {kb.content}
                </pre>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openModal(kb)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={kb.is_active ? "warning" : "success"}
                    onClick={() => handleToggle(kb)}
                  >
                    {kb.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(kb)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Knowledge Base" : "Create Knowledge Base"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={kbName}
                onChange={(e) => setKbName(e.target.value)}
                placeholder="e.g. Resume Bullet Guidelines"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tech Stack</Label>
              <Select value={kbStackId} onValueChange={setKbStackId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__general__">General (all stacks)</SelectItem>
                  {stacks.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                value={kbContent}
                onChange={(e) => setKbContent(e.target.value)}
                rows={12}
                placeholder="Enter knowledge base rules and guidelines…"
                className="font-mono text-sm"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
