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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { useState } from "react";
import {
  createCallStage,
  deleteCallStage,
  reorderCallStages,
  updateCallStage,
} from "../../api/callStages";
import type { CallStageConfig } from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

interface StageRowProps {
  stage: CallStageConfig;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function StageRow({ stage, onRename, onDelete }: StageRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === stage.name) {
      setEditing(false);
      setDraft(stage.name);
      return;
    }
    setSaving(true);
    try {
      await updateCallStage(stage.id, { name: trimmed });
      onRename(stage.id, trimmed);
      setEditing(false);
    } catch {
      setDraft(stage.name);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteCallStage(stage.id);
      onDelete(stage.id);
    } catch (err: unknown) {
      setConfirmDelete(false);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Cannot delete stage";
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setDraft(stage.name); }
          }}
          className="h-7 flex-1 text-sm"
          disabled={saving}
        />
      ) : (
        <span className="flex-1 text-sm font-medium">{stage.name}</span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={saving}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => { setEditing(false); setDraft(stage.name); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        {confirmDelete ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs px-2"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "..." : "Confirm"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setConfirmDelete(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface StageManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CallStageConfig[];
  onStagesChange: (stages: CallStageConfig[]) => void;
}

export default function StageManagerDialog({
  open,
  onOpenChange,
  stages,
  onStagesChange,
}: StageManagerDialogProps) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }));

    onStagesChange(reordered);
    try {
      await reorderCallStages({ ordered_ids: reordered.map((s) => s.id) });
    } catch {
      onStagesChange(stages);
    }
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await createCallStage({ name: trimmed });
      onStagesChange([...stages, res.data]);
      setNewName("");
    } finally {
      setAdding(false);
    }
  };

  const handleRename = (id: string, name: string) => {
    onStagesChange(stages.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleDelete = (id: string) => {
    onStagesChange(stages.filter((s) => s.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Manage Stages
            <Badge variant="secondary" className="text-xs font-normal">
              Admin
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {stages.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="New stage name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            disabled={adding}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
