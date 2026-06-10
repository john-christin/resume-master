import { AlertCircle, Loader2, Plus } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import { useEffect, useState } from "react";
import {
  createTechStack,
  deleteTechStack,
  getTechStacks,
  updateTechStack,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { TechStack } from "../../types";

export default function TechStacksPage() {
  const [stacks, setStacks] = useState<TechStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getTechStacks();
      setStacks(res.data);
    } catch {
      setError("Failed to load tech stacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (stack?: TechStack) => {
    setEditingId(stack?.id ?? null);
    setName(stack?.name ?? "");
    setDesc(stack?.description ?? "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateTechStack(editingId, { name, description: desc || undefined });
      } else {
        await createTechStack(name, desc || undefined);
      }
      setModalOpen(false);
      setError(null);
      await load();
    } catch {
      setError(editingId ? "Failed to update tech stack" : "Failed to create tech stack");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (stack: TechStack) => {
    try {
      await updateTechStack(stack.id, { is_active: !stack.is_active });
      await load();
    } catch {
      setError("Failed to toggle tech stack");
    }
  };

  const handleDelete = async (stack: TechStack) => {
    if (
      !window.confirm(
        `Delete tech stack "${stack.name}"? Profiles and KBs using it will lose the association.`
      )
    )
      return;
    try {
      await deleteTechStack(stack.id);
      await load();
    } catch {
      setError("Failed to delete tech stack");
    }
  };

  if (loading) return <LoadingSpinner message="Loading tech stacks..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tech Stacks"
        description="Manage technology stack configurations"
        actions={<Button onClick={() => openModal()}><Plus className="h-4 w-4" />Create Tech Stack</Button>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stacks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tech stacks yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one to start organizing profiles and knowledge bases.
            </p>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stacks.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "success" : "secondary"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openModal(s)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={s.is_active ? "warning" : "success"}
                          onClick={() => handleToggle(s)}
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(s)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Tech Stack" : "Create Tech Stack"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. .Net / C#"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Short description"
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
