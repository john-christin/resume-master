import { Award, Plus, Trash2 } from "lucide-react";
import type { Certification } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Props {
  certifications: Certification[];
  onChange: (certifications: Certification[]) => void;
  readOnly?: boolean;
}

const emptyCertification: Certification = {
  name: "",
  issuer: "",
  issue_date: "",
  expiry_date: "",
};

export default function CertificationForm({
  certifications,
  onChange,
  readOnly,
}: Props) {
  const add = () => onChange([...certifications, { ...emptyCertification }]);
  const remove = (index: number) =>
    onChange(certifications.filter((_, i) => i !== index));
  const update = (index: number, field: keyof Certification, value: string) =>
    onChange(
      certifications.map((cert, i) =>
        i === index ? { ...cert, [field]: value } : cert
      )
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Certifications</h3>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
            Add Certification
          </Button>
        )}
      </div>

      {certifications.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
          No certifications yet.
        </p>
      )}

      {certifications.map((cert, index) => (
        <div
          key={index}
          className="rounded-lg border bg-muted/30 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Certification {index + 1}
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
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="AWS Certified Solutions Architect"
                value={cert.name}
                onChange={(e) => update(index, "name", e.target.value)}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issuer (optional)</Label>
              <Input
                placeholder="Amazon Web Services"
                value={cert.issuer || ""}
                onChange={(e) => update(index, "issuer", e.target.value)}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issued (optional)</Label>
              <Input
                placeholder="YYYY-MM"
                value={cert.issue_date || ""}
                onChange={(e) => update(index, "issue_date", e.target.value)}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expires (optional)</Label>
              <Input
                placeholder="YYYY-MM (leave empty if none)"
                value={cert.expiry_date || ""}
                onChange={(e) => update(index, "expiry_date", e.target.value)}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
