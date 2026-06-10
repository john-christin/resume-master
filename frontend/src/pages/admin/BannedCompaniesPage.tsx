import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import { useEffect, useState } from "react";
import {
  createBannedCompany,
  deleteBannedCompany,
  getBannedCompanies,
  updateBannedCompany,
} from "../../api/admin";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Alert, AlertDescription } from "../../components/ui/alert";
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
import { Textarea } from "../../components/ui/textarea";
import type { BannedCompany } from "../../types";

export default function BannedCompaniesPage() {
  const [entries, setEntries] = useState<BannedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await getBannedCompanies();
      setEntries(res.data);
    } catch {
      setError("Failed to load banned companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (entry?: BannedCompany) => {
    setEditingId(entry?.id ?? null);
    setName(entry?.name ?? "");
    setDesc(entry?.description ?? "");
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateBannedCompany(editingId, { name: name.trim(), description: desc.trim() || undefined });
      } else {
        await createBannedCompany(name.trim(), desc.trim() || undefined);
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("already banned") ? `"${name.trim()}" is already in the banned list.` : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: BannedCompany) => {
    if (!window.confirm(`Remove "${entry.name}" from the banned list?`)) return;
    try {
      await deleteBannedCompany(entry.id);
      await load();
    } catch {
      setError("Failed to delete entry");
    }
  };

  if (loading) return <LoadingSpinner message="Loading banned companies..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banned Companies"
        description="Companies on this list cannot be used in job applications"
        actions={<Button onClick={() => openModal()}><Plus className="h-4 w-4" />Add Company</Button>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No banned companies yet. Add one to block it from applications.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Reason / Description</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {entry.description || <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openModal(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Banned Company" : "Ban a Company"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label>Company Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Partial matches are blocked — "Acme" will also block "Acme Corp".
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Reason / Description</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Why is this company banned? (shown to users when blocked)"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()} variant="destructive">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editingId ? "Save Changes" : "Ban Company"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
