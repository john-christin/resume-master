import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { patcher } from "./patcher";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { EntrySettings, ListSettings, SectionItem } from "../../types";
import { SECTION_LABELS } from "./constants";
import {
  Block,
  ColorField,
  Field,
  Grid,
  HintText,
  NumberField,
  SelectField,
  SubHeading,
  TextField,
} from "./controls";
import { SeparatorField } from "./HeaderTabs";
import { ParagraphEditor, TextStyleEditor } from "./StyleBlocks";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

export function EntriesTab({ value, onChange }: { value: EntrySettings; onChange: (v: EntrySettings) => void }) {
  const set = patcher(value, onChange);
  return (
    <div className="space-y-4">
      <SubHeading>Experience</SubHeading>
      <Block>
        <Grid cols={2}>
          <Field label="Experience layout">
            <SelectField
              value={value.experience_layout}
              onChange={(v) => set("experience_layout", v)}
              options={[
                { label: "Employer → Title (dates on title line)", value: "employer-title" },
                { label: "Title → Employer (dates on title line)", value: "title-employer" },
                { label: "Combined (Title | Employer … dates)", value: "combined" },
              ]}
            />
          </Field>
          {value.experience_layout === "combined" && (
            <SeparatorField label="Title / employer separator" value={value.combined_separator} onChange={(v) => set("combined_separator", v)} />
          )}
        </Grid>
      </Block>
      <TextStyleEditor title="Job title" value={value.job_title} onChange={(v) => set("job_title", v)} />
      <TextStyleEditor title="Employer" value={value.employer} onChange={(v) => set("employer", v)} />

      <SubHeading>Education</SubHeading>
      <Block>
        <div className="max-w-sm">
          <Field label="Education layout">
            <SelectField
              value={value.education_layout}
              onChange={(v) => set("education_layout", v)}
              options={[
                { label: "Degree, School … dates", value: "degree-school" },
                { label: "School … dates / Degree", value: "school-degree" },
              ]}
            />
          </Field>
        </div>
      </Block>
      <TextStyleEditor title="Degree" value={value.degree} onChange={(v) => set("degree", v)} />
      <TextStyleEditor title="School" value={value.school} onChange={(v) => set("school", v)} />
      <TextStyleEditor title="GPA" value={value.gpa} onChange={(v) => set("gpa", v)} />

      <SubHeading>Certifications</SubHeading>
      <Block>
        <div className="max-w-sm">
          <Field label="Certification layout">
            <SelectField
              value={value.certification_layout}
              onChange={(v) => set("certification_layout", v)}
              options={[
                { label: "Name … dates / Issuer", value: "name-issuer" },
                { label: "Name, Issuer … dates (inline)", value: "inline" },
              ]}
            />
          </Field>
        </div>
      </Block>
      <TextStyleEditor title="Certification name" value={value.cert_name} onChange={(v) => set("cert_name", v)} />
      <TextStyleEditor title="Certification issuer" value={value.cert_issuer} onChange={(v) => set("cert_issuer", v)} />

      <SubHeading>Dates &amp; entry lines</SubHeading>
      <TextStyleEditor title="Dates" value={value.dates} onChange={(v) => set("dates", v)} />
      <Block>
        <Grid cols={3}>
          <Field label="Date format">
            <SelectField
              value={value.date_format}
              onChange={(v) => set("date_format", v)}
              options={[
                { label: "As entered", value: "as_entered" },
                { label: "Mar 2021", value: "mon_yyyy" },
                { label: "March 2021", value: "month_yyyy" },
                { label: "03/2021", value: "mm_yyyy" },
                { label: "2021", value: "yyyy" },
              ]}
            />
          </Field>
          <TextField label="Date separator" value={value.date_separator} onChange={(v) => set("date_separator", v)} />
          <TextField label="“Present” label" value={value.present_label} onChange={(v) => set("present_label", v)} />
        </Grid>
      </Block>
      <ParagraphEditor title="First line paragraph" defaultOpen value={value.first_line_para} onChange={(v) => set("first_line_para", v)} />
      <ParagraphEditor title="Second line paragraph" value={value.second_line_para} onChange={(v) => set("second_line_para", v)} />
    </div>
  );
}

export function ListsTab({ value, onChange }: { value: ListSettings; onChange: (v: ListSettings) => void }) {
  const set = patcher(value, onChange);
  const showChar = value.kind === "bullet" || value.kind === "custom";
  return (
    <div className="space-y-4">
      <Block title="Bullet list">
        <Grid cols={3}>
          <Field label="List type">
            <SelectField
              value={value.kind}
              onChange={(v) => set("kind", v)}
              options={[
                { label: "Bullet", value: "bullet" },
                { label: "Dash", value: "dash" },
                { label: "Numbered (1.)", value: "numbered" },
                { label: "Lettered (a.)", value: "lettered" },
                { label: "Custom character", value: "custom" },
                { label: "None", value: "none" },
              ]}
            />
          </Field>
          {showChar && (
            <TextField label={value.kind === "custom" ? "Custom character" : "Bullet glyph"} value={value.char} maxLength={4} onChange={(v) => set("char", v)} />
          )}
          <Field label="Text indent (in)">
            <NumberField value={value.indent} min={0} max={3} step={0.05} onChange={(v) => set("indent", v)} />
          </Field>
          <Field label="Hanging (in)">
            <NumberField value={value.hanging} min={0} max={3} step={0.05} onChange={(v) => set("hanging", v)} />
          </Field>
          <ColorField label="Marker colour" nullable noneLabel="same as text" value={value.color} onChange={(v) => set("color", v)} />
        </Grid>
        <HintText>
          Indent is where the text starts; the marker hangs this much further left. Numbered lists restart at 1 for each job.
        </HintText>
      </Block>
      <ParagraphEditor title="Bullet paragraph" defaultOpen value={value.para} onChange={(v) => set("para", v)} />
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

function SortableSection({
  item,
  index,
  count,
  onToggle,
  onMove,
}: {
  item: SectionItem;
  index: number;
  count: number;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
    >
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </span>
      <span className={`flex-1 text-sm font-medium ${item.visible ? "" : "text-muted-foreground line-through"}`}>
        {SECTION_LABELS[item.key]}
      </span>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Switch checked={item.visible} onCheckedChange={onToggle} aria-label={`Show ${SECTION_LABELS[item.key]}`} />
    </div>
  );
}

export function SectionsTab({ value, onChange }: { value: SectionItem[]; onChange: (v: SectionItem[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = value.findIndex((s) => s.key === active.id);
      const to = value.findIndex((s) => s.key === over.id);
      onChange(arrayMove(value, from, to));
    }
  };
  const move = (index: number, dir: -1 | 1) => onChange(arrayMove(value, index, index + dir));
  const toggle = (key: string) => onChange(value.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)));

  return (
    <Block title="Section order">
      <p className="text-xs text-muted-foreground">Drag or use the arrows to reorder. Toggle to show or hide a section.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {value.map((item, i) => (
              <SortableSection
                key={item.key}
                item={item}
                index={i}
                count={value.length}
                onToggle={() => toggle(item.key)}
                onMove={(d) => move(i, d)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Block>
  );
}
