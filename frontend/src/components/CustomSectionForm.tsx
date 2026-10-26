import { LayoutList, Plus, Trash2 } from "lucide-react";
import type { CustomSection } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Props {
  customSections: CustomSection[];
  onChange: (sections: CustomSection[]) => void;
  readOnly?: boolean;
}

export default function CustomSectionForm({ customSections, onChange, readOnly }: Props) {
  const addSection = () =>
    onChange([...customSections, { title: "", items: [""] }]);

  const removeSection = (si: number) =>
    onChange(customSections.filter((_, i) => i !== si));

  const updateTitle = (si: number, title: string) =>
    onChange(customSections.map((s, i) => (i === si ? { ...s, title } : s)));

  const addItem = (si: number) =>
    onChange(
      customSections.map((s, i) =>
        i === si ? { ...s, items: [...s.items, ""] } : s
      )
    );

  const removeItem = (si: number, ii: number) =>
    onChange(
      customSections.map((s, i) =>
        i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s
      )
    );

  const updateItem = (si: number, ii: number, value: string) =>
    onChange(
      customSections.map((s, i) =>
        i === si
          ? { ...s, items: s.items.map((item, j) => (j === ii ? value : item)) }
          : s
      )
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutList className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Custom Sections</h3>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            Add Section
          </Button>
        )}
      </div>

      {customSections.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          No custom sections yet. Use this to add things like &ldquo;Selected Projects&rdquo;, &ldquo;Publications&rdquo;, etc.
        </p>
      )}

      {customSections.map((section, si) => (
        <div key={si} className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Section {si + 1}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeSection(si)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Section Title *</Label>
            <Input
              placeholder="Selected Projects"
              value={section.title}
              onChange={(e) => updateTitle(si, e.target.value)}
              readOnly={readOnly}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Bullet Points</Label>
            {section.items.map((item, ii) => (
              <div key={ii} className="flex gap-2 items-center">
                <Input
                  placeholder={`Bullet point ${ii + 1}`}
                  value={item}
                  onChange={(e) => updateItem(si, ii, e.target.value)}
                  readOnly={readOnly}
                  className="flex-1"
                />
                {!readOnly && section.items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(si, ii)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={() => addItem(si)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add bullet
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
