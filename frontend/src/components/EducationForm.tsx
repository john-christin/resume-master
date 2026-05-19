import { GraduationCap, Plus, Trash2 } from "lucide-react";
import type { Education } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Props {
  educations: Education[];
  onChange: (educations: Education[]) => void;
  readOnly?: boolean;
}

const emptyEducation: Education = {
  school: "",
  degree: "",
  field: "",
  gpa: "",
  start_date: "",
  end_date: "",
};

export default function EducationForm({
  educations,
  onChange,
  readOnly,
}: Props) {
  const add = () => onChange([...educations, { ...emptyEducation }]);
  const remove = (index: number) =>
    onChange(educations.filter((_, i) => i !== index));
  const update = (index: number, field: keyof Education, value: string) =>
    onChange(educations.map((edu, i) => (i === index ? { ...edu, [field]: value } : edu)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Education</h3>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
            Add Education
          </Button>
        )}
      </div>

      {educations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          No education entries yet.
        </p>
      )}

      {educations.map((edu, index) => (
        <div
          key={index}
          className="rounded-lg border bg-muted/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Education {index + 1}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">School *</Label>
              <Input
                placeholder="University of..."
                value={edu.school}
                onChange={(e) => update(index, "school", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Degree *</Label>
              <Input
                placeholder="Bachelor of Science"
                value={edu.degree}
                onChange={(e) => update(index, "degree", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Field of Study *</Label>
              <Input
                placeholder="Computer Science"
                value={edu.field}
                onChange={(e) => update(index, "field", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GPA (optional)</Label>
              <Input
                placeholder="3.9"
                value={edu.gpa || ""}
                onChange={(e) => update(index, "gpa", e.target.value)}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date *</Label>
              <Input
                placeholder="YYYY-MM"
                value={edu.start_date}
                onChange={(e) => update(index, "start_date", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input
                placeholder="YYYY-MM (leave empty if current)"
                value={edu.end_date || ""}
                onChange={(e) => update(index, "end_date", e.target.value)}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
