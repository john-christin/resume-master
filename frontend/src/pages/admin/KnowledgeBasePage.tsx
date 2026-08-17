import { AlertCircle, BookOpen, Loader2, Plus } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import { useEffect, useState } from "react";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBases,
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
import { Textarea } from "../../components/ui/textarea";
import type { KnowledgeBase } from "../../types";

export default function KnowledgeBasePage() {
  const [kbList, setKbList] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kbName, setKbName] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getKnowledgeBases();
      setKbList(res.data);
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
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateKnowledgeBase(editingId, {
          name: kbName,
          content: kbContent,
        });
      } else {
        await createKnowledgeBase(kbName, kbContent);
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

  if (loading) return <LoadingSpinner message="Loading knowledge bases..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Manage knowledge base guidelines — every active entry applies to all resume generation"
        actions={<Button onClick={() => openModal()}><Plus className="h-4 w-4" />Create KB</Button>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {kbList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No knowledge bases yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one to guide resume/cover-letter generation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {kbList.map((kb) => (
            <Card key={kb.id} className={!kb.is_active ? "opacity-60" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{kb.name}</h3>
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
