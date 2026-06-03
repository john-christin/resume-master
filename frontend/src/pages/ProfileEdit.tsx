import { AlertCircle, ArrowLeft, Loader2, Save, SlidersHorizontal, Sparkles, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDocStyles } from "../api/doc_styles";
import {
  createProfile,
  getProfile,
  getTechStacksPublic,
  updateProfile,
} from "../api/profile";
import { getUserRole } from "../auth";
import EducationForm from "../components/EducationForm";
import ExperienceForm from "../components/ExperienceForm";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import type { DocStyle, Education, Experience, ProfileCreate, TechStack } from "../types";

const emptyProfile: ProfileCreate = {
  name: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  summary: "",
  tech_stack_id: null,
  creativity_factor: 0.7,
  custom_prompt: null,
  doc_style_id: null,
  show_skills: true,
  educations: [],
  experiences: [],
};

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { profileId } = useParams<{ profileId: string }>();
  const isNew = !profileId;

  const [profile, setProfile] = useState<ProfileCreate>(emptyProfile);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [docStyles, setDocStyles] = useState<DocStyle[]>([]);

  useEffect(() => {
    getTechStacksPublic()
      .then((res) => setTechStacks(res.data))
      .catch(() => {});
    getDocStyles()
      .then((res) => setDocStyles(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!profileId) return;
    getProfile(profileId)
      .then((res) => {
        const p = res.data;
        setProfile({
          name: p.name,
          location: p.location || "",
          phone: p.phone || "",
          email: p.email || "",
          linkedin: p.linkedin || "",
          summary: p.summary || "",
          tech_stack_id: p.tech_stack_id ?? null,
          creativity_factor: p.creativity_factor ?? 0.7,
          custom_prompt: p.custom_prompt ?? null,
          doc_style_id: p.doc_style_id ?? null,
          show_skills: p.show_skills ?? true,
          educations: p.educations,
          experiences: p.experiences,
        });
        setReadOnly(p.is_shared && !p.is_owner && getUserRole() !== "admin");
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);

    try {
      if (isNew) {
        await createProfile(profile);
      } else {
        await updateProfile(profileId!, profile);
      }
      navigate("/profiles");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/profiles")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {readOnly
                ? "View Profile"
                : isNew
                  ? "New Profile"
                  : "Edit Profile"}
            </h1>
            {readOnly && (
              <Badge variant="secondary" className="mt-1">
                Read Only
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                  placeholder="John Doe"
                  required
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={profile.location || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, location: e.target.value })
                  }
                  placeholder="San Francisco, CA"
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                  placeholder="john@example.com"
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                  placeholder="+1 (555) 000-0000"
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>LinkedIn URL</Label>
                <Input
                  type="url"
                  value={profile.linkedin || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, linkedin: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/..."
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tech Stack</Label>
                <Select
                  value={profile.tech_stack_id ?? "__none__"}
                  onValueChange={(v) =>
                    setProfile({ ...profile, tech_stack_id: v === "__none__" ? null : v })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— None selected —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None selected —</SelectItem>
                    {techStacks.map((ts) => (
                      <SelectItem key={ts.id} value={ts.id}>
                        {ts.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resume Doc Style</Label>
                <Select
                  value={profile.doc_style_id ?? "__default__"}
                  onValueChange={(v) =>
                    setProfile({ ...profile, doc_style_id: v === "__default__" ? null : v })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— Default (Classic) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">— Default (Classic) —</SelectItem>
                    {docStyles.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        {ds.name}{ds.is_system ? " ✦" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile.doc_style_id && (
                  <p className="text-xs text-muted-foreground">
                    {docStyles.find((d) => d.id === profile.doc_style_id)?.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Technical Skills Section</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Include a skills section in generated resumes
                </p>
              </div>
              <Switch
                checked={profile.show_skills ?? true}
                onCheckedChange={(v) => setProfile({ ...profile, show_skills: v })}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Professional Summary</Label>
              <Textarea
                value={profile.summary || ""}
                onChange={(e) =>
                  setProfile({ ...profile, summary: e.target.value })
                }
                rows={3}
                placeholder="Brief professional summary..."
                readOnly={readOnly}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Creativity Factor</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls how creative and varied the AI-generated resumes will be
                  </p>
                </div>
                <div className="flex items-center gap-1.5 min-w-[4rem] justify-end">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {Math.round((profile.creativity_factor ?? 0.7) * 100)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12 text-right">Safe</span>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[profile.creativity_factor ?? 0.7]}
                  onValueChange={([v]) =>
                    setProfile({ ...profile, creativity_factor: v })
                  }
                  disabled={readOnly}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-14">Creative</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-0">
                <span>Consistent &amp; focused</span>
                <span>Varied &amp; expressive</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Profile Prompt Override
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Always sent alongside tech-stack and general knowledge-base prompts.
              Takes precedence over other KB entries for this profile.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={profile.custom_prompt || ""}
              onChange={(e) =>
                setProfile({ ...profile, custom_prompt: e.target.value || null })
              }
              rows={6}
              placeholder="e.g. Always emphasize leadership experience. Avoid passive voice. Focus on measurable outcomes and quantified achievements..."
              readOnly={readOnly}
              className="font-mono text-xs resize-y"
            />
            {profile.custom_prompt && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <SlidersHorizontal className="h-3 w-3" />
                <span>Active — sent with all KB prompts during generation</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <EducationForm
              educations={profile.educations}
              onChange={(educations: Education[]) =>
                setProfile({ ...profile, educations })
              }
              readOnly={readOnly}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ExperienceForm
              experiences={profile.experiences}
              onChange={(experiences: Experience[]) =>
                setProfile({ ...profile, experiences })
              }
              readOnly={readOnly}
            />
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/profiles")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isNew ? "Create Profile" : "Save Changes"}
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
