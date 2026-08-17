import { Briefcase, Plus, Trash2 } from "lucide-react";
import type { Experience } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Props {
  experiences: Experience[];
  onChange: (experiences: Experience[]) => void;
  readOnly?: boolean;
}

const emptyExperience: Experience = {
  company: "",
  title: "",
  start_date: "",
  end_date: "",
};

export default function ExperienceForm({
  experiences,
  onChange,
  readOnly,
}: Props) {
  const add = () => onChange([...experiences, { ...emptyExperience }]);
  const remove = (index: number) =>
    onChange(experiences.filter((_, i) => i !== index));
  const update = (index: number, field: keyof Experience, value: string) =>
    onChange(
      experiences.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp))
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Experience</h3>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
            Add Experience
          </Button>
        )}
      </div>

      {experiences.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          No experience entries yet.
        </p>
      )}

      {experiences.map((exp, index) => (
        <div
          key={index}
          className="rounded-lg border bg-muted/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Experience {index + 1}
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
              <Label className="text-xs">Company *</Label>
              <Input
                placeholder="Company name"
                value={exp.company}
                onChange={(e) => update(index, "company", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title *</Label>
              <Input
                placeholder="Software Engineer"
                value={exp.title}
                onChange={(e) => update(index, "title", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input
                  placeholder="YYYY-MM"
                  value={exp.start_date}
                  onChange={(e) => update(index, "start_date", e.target.value)}
                  readOnly={readOnly}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  placeholder="YYYY-MM or Present"
                  value={exp.end_date || ""}
                  onChange={(e) => update(index, "end_date", e.target.value)}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
