import {
  AlertTriangle,
  ChevronDown,
  Layers,
  Plus,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { submitBatchJob } from "../api/batch_jobs";
import { checkCompanies, generateApplication } from "../api/generate";
import { getProfiles } from "../api/profile";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import type { ExistingApplicationInfo, JobDescriptionEntry, Profile } from "../types";

interface JobMatch {
  jobIndex: number;
  jobTitle: string;
  jobCompany: string;
  existingApplications: ExistingApplicationInfo[];
}

const emptyJob: JobDescriptionEntry = {
  job_title: "",
  company: "",
  job_url: "",
  job_description: "",
};

const BATCH_LIMIT = 10;

function jobTitleWarning(value: string): string | null {
  if (!value) return null;
  if (value.includes("\n"))
    return "Job titles don't have line breaks — did you paste the job description here by mistake?";
  if (value.length > 150)
    return "This looks too long for a job title — double-check you're filling in the right field.";
  return null;
}

function companyWarning(value: string): string | null {
  if (!value) return null;
  if (value.includes("\n"))
    return "Company names don't have line breaks — check this field.";
  if (value.length > 100)
    return "This looks too long for a company name — check this field.";
  return null;
}

function FieldWarning({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {msg}
    </p>
  );
}

export default function JobInput() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedProfileId = (location.state as { profileId?: string })
    ?.profileId;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState(
    preselectedProfileId || ""
  );
  const [batchMode, setBatchMode] = useState(false);
  const [jobs, setJobs] = useState<JobDescriptionEntry[]>([{ ...emptyJob }]);
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workModeWarning, setWorkModeWarning] = useState<{
    label: string;
    jobIndex: number;
    jobTitle: string;
    company: string;
  } | null>(null);
  const [pendingMatches, setPendingMatches] = useState<JobMatch[]>([]);
  const [markedForRemoval, setMarkedForRemoval] = useState<Set<number>>(
    new Set()
  );
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    getProfiles(true)
      .then((res) => {
        setProfiles(res.data);
        if (!selectedProfileId && res.data.length > 0) {
          setSelectedProfileId(res.data[0].id);
        }
      })
      .catch(() => setError("Failed to load profiles"))
      .finally(() => setProfilesLoading(false));
  }, []);

  const updateJob = (
    index: number,
    field: keyof JobDescriptionEntry,
    value: string
  ) =>
    setJobs((prev) =>
      prev.map((j, i) => (i === index ? { ...j, [field]: value } : j))
    );

  const addJob = () => {
    if (jobs.length >= BATCH_LIMIT) return;
    setJobs((prev) => [...prev, { ...emptyJob }]);
  };

  const removeJob = (index: number) =>
    setJobs((prev) => prev.filter((_, i) => i !== index));

  const detectWorkMode = (text: string): string | null => {
    const lower = text.toLowerCase();
    const hybridPatterns = [
      /\bhybrid\b/,
      /\bin[- ]office\s+\d/,
      /\d\s+days?\s+in[- ]office/,
      /\d\s+days?\s+on[- ]?site/,
    ];
    const onsitePatterns = [
      /\bon[- ]?site\b/,
      /\bin[- ]office\b/,
      /\bin[- ]person\b/,
      /\breturn to office\b/,
      /\bno remote\b/,
      /\bnot remote\b/,
      /\boffice[- ]based\b/,
      /\bwork from office\b/,
      /\bmust be located\b/,
      /\brelocation required\b/,
    ];
    for (const p of hybridPatterns) {
      if (p.test(lower)) return "hybrid";
    }
    for (const p of onsitePatterns) {
      if (p.test(lower)) return "onsite";
    }
    return null;
  };

  const doGenerate = async (activeJobs: JobDescriptionEntry[]) => {
    setLoading(true);
    setError(null);
    try {
      if (batchMode && activeJobs.length > 1) {
        const res = await submitBatchJob({
          profile_id: selectedProfileId,
          jobs: activeJobs.map((j) => ({
            job_title: j.job_title,
            company: j.company || undefined,
            job_url: j.job_url || undefined,
            job_description: j.job_description,
          })),
        });
        navigate(`/batch-jobs/${res.data.job_id}`);
      } else {
        const job = activeJobs[0];
        const res = await generateApplication({
          profile_id: selectedProfileId,
          job_title: job.job_title,
          company: job.company || undefined,
          job_url: job.job_url || undefined,
          job_description: job.job_description,
        });
        navigate(`/preview/${res.data.application_id}`, { state: res.data });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate application"
      );
    } finally {
      setLoading(false);
    }
  };

  const runCompanyCheckThenGenerate = async (
    activeJobs: JobDescriptionEntry[]
  ) => {
    const companies = activeJobs
      .map((j) => j.company?.trim())
      .filter((c): c is string => !!c);

    if (companies.length > 0) {
      try {
        const res = await checkCompanies(selectedProfileId, companies);
        if (res.data.matches.length > 0) {
          const matchByCompany = new Map(
            res.data.matches.map((m) => [
              m.company.toLowerCase().trim(),
              m,
            ])
          );
          const jobMatches: JobMatch[] = [];
          activeJobs.forEach((job, idx) => {
            if (!job.company) return;
            const key = job.company.toLowerCase().trim();
            const match = matchByCompany.get(key);
            if (match) {
              jobMatches.push({
                jobIndex: idx,
                jobTitle: job.job_title,
                jobCompany: job.company,
                existingApplications: match.existing_applications,
              });
            }
          });
          if (jobMatches.length > 0) {
            setPendingMatches(jobMatches);
            setMarkedForRemoval(new Set());
            return;
          }
        }
      } catch {
        // proceed silently if check fails
      }
    }
    await doGenerate(activeJobs);
  };

  const handleContinueDespiteMatches = async () => {
    const filteredJobs = jobs.filter((_, i) => !markedForRemoval.has(i));
    setJobs(filteredJobs);
    setPendingMatches([]);
    setMarkedForRemoval(new Set());
    setExpandedMatches(new Set());
    await doGenerate(filteredJobs);
  };

  const dismissMatchModal = () => {
    setPendingMatches([]);
    setMarkedForRemoval(new Set());
    setExpandedMatches(new Set());
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProfileId) {
      setError("Please select a profile");
      return;
    }
    for (let i = 0; i < jobs.length; i++) {
      const workMode = detectWorkMode(jobs[i].job_description);
      if (workMode) {
        setWorkModeWarning({
          label:
            workMode === "hybrid"
              ? "hybrid (partially in-office)"
              : "onsite (in-office)",
          jobIndex: i,
          jobTitle: jobs[i].job_title || `Job #${i + 1}`,
          company: jobs[i].company || "",
        });
        return;
      }
    }
    await runCompanyCheckThenGenerate(jobs);
  };

  if (profilesLoading) return <LoadingSpinner message="Loading profiles..." />;
  if (loading) {
    return (
      <LoadingSpinner
        message={
          batchMode && jobs.length > 1
            ? "Submitting batch job..."
            : "Tailoring your resume and generating cover letter… This may take 10–15 seconds."
        }
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate Application</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Tailor your resume and generate a cover letter for a job
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {profiles.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              You need a profile before generating applications.
            </p>
            <Button onClick={() => navigate("/profiles/new")}>
              <Plus className="h-4 w-4" />
              Create a Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile + Batch toggle */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Profile *</Label>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="batch-mode"
                    className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Batch Mode
                  </Label>
                  <Switch
                    id="batch-mode"
                    checked={batchMode}
                    onCheckedChange={(checked) => {
                      setBatchMode(checked);
                      if (!checked && jobs.length > 1) setJobs([jobs[0]]);
                    }}
                  />
                </div>
              </div>
              <Select
                value={selectedProfileId}
                onValueChange={setSelectedProfileId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a profile…" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_shared ? " (shared)" : ""}
                      {p.email ? ` — ${p.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Batch job cards or single form */}
          {batchMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Job Descriptions ({jobs.length})
                </h2>
                <div className="flex items-center gap-2">
                  {jobs.length >= BATCH_LIMIT && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Max {BATCH_LIMIT} per batch
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addJob}
                    disabled={jobs.length >= BATCH_LIMIT}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Job
                  </Button>
                </div>
              </div>

              {jobs.map((job, index) => {
                const titleWarn = jobTitleWarning(job.job_title);
                const compWarn = companyWarning(job.company || "");
                return (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-muted-foreground">
                          Job #{index + 1}
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeJob(index)}
                          disabled={jobs.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Input
                            placeholder="Job Title *"
                            value={job.job_title}
                            onChange={(e) =>
                              updateJob(index, "job_title", e.target.value)
                            }
                            maxLength={300}
                            required
                            className={titleWarn ? "border-amber-400" : ""}
                          />
                          <FieldWarning msg={titleWarn} />
                        </div>
                        <div>
                          <Input
                            placeholder="Company (optional)"
                            value={job.company || ""}
                            onChange={(e) =>
                              updateJob(index, "company", e.target.value)
                            }
                            maxLength={300}
                            className={compWarn ? "border-amber-400" : ""}
                          />
                          <FieldWarning msg={compWarn} />
                        </div>
                        <Input
                          type="url"
                          placeholder="Job URL (optional)"
                          value={job.job_url || ""}
                          onChange={(e) =>
                            updateJob(index, "job_url", e.target.value)
                          }
                        />
                      </div>
                      <Textarea
                        placeholder="Paste the full job description here..."
                        value={job.job_description}
                        onChange={(e) =>
                          updateJob(index, "job_description", e.target.value)
                        }
                        rows={6}
                        required
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Job Title *</Label>
                    <Input
                      value={jobs[0].job_title}
                      onChange={(e) => updateJob(0, "job_title", e.target.value)}
                      placeholder="Senior Software Engineer"
                      maxLength={300}
                      required
                      className={
                        jobTitleWarning(jobs[0].job_title)
                          ? "border-amber-400"
                          : ""
                      }
                    />
                    <FieldWarning msg={jobTitleWarning(jobs[0].job_title)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company (optional)</Label>
                    <Input
                      value={jobs[0].company || ""}
                      onChange={(e) => updateJob(0, "company", e.target.value)}
                      placeholder="Acme Corp"
                      maxLength={300}
                      className={
                        companyWarning(jobs[0].company || "")
                          ? "border-amber-400"
                          : ""
                      }
                    />
                    <FieldWarning msg={companyWarning(jobs[0].company || "")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Job URL (optional)</Label>
                  <Input
                    type="url"
                    value={jobs[0].job_url || ""}
                    onChange={(e) => updateJob(0, "job_url", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Job Description *</Label>
                  <Textarea
                    value={jobs[0].job_description}
                    onChange={(e) =>
                      updateJob(0, "job_description", e.target.value)
                    }
                    rows={12}
                    placeholder="Paste the full job description here..."
                    required
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="lg">
              <Wand2 className="h-4 w-4" />
              {batchMode && jobs.length > 1
                ? `Generate ${jobs.length} Applications`
                : "Generate Resume & Cover Letter"}
            </Button>
          </div>
        </form>
      )}

      {/* Work mode warning dialog */}
      <Dialog
        open={!!workModeWarning}
        onOpenChange={(o) => !o && setWorkModeWarning(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Work Mode Warning
            </DialogTitle>
            <DialogDescription>
              This job posting appears to require in-person attendance.
            </DialogDescription>
          </DialogHeader>
          {workModeWarning && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">{workModeWarning.jobTitle}</span>
                {workModeWarning.company && (
                  <span className="text-muted-foreground">
                    {" "}
                    @ {workModeWarning.company}
                  </span>
                )}{" "}
                — detected as{" "}
                <span className="font-semibold">{workModeWarning.label}</span>
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWorkModeWarning(null)}
            >
              Cancel
            </Button>
            {batchMode && jobs.length > 1 && workModeWarning && (
              <Button
                variant="destructive"
                onClick={() => {
                  removeJob(workModeWarning.jobIndex);
                  setWorkModeWarning(null);
                }}
              >
                Remove Job
              </Button>
            )}
            {workModeWarning && (
              <Button
                variant="warning"
                onClick={() => {
                  setWorkModeWarning(null);
                  runCompanyCheckThenGenerate(jobs);
                }}
              >
                Proceed Anyway
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Already-applied company dialog */}
      <Dialog
        open={pendingMatches.length > 0}
        onOpenChange={(o) => !o && dismissMatchModal()}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Already Applied to{" "}
              {pendingMatches.length === 1
                ? "This Company"
                : "These Companies"}
            </DialogTitle>
            <DialogDescription>
              {pendingMatches.length === 1
                ? "This profile has a previous application for this company."
                : `This profile has previous applications for ${pendingMatches.length} companies.`}{" "}
              Click a row to expand details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pendingMatches.map((match) => {
              const removing = markedForRemoval.has(match.jobIndex);
              const expanded = expandedMatches.has(match.jobIndex);
              const mostRecent = match.existingApplications[0];
              const jobData = jobs[match.jobIndex];
              return (
                <div
                  key={match.jobIndex}
                  className={`rounded-lg border transition-opacity ${
                    removing
                      ? "opacity-40 border-border bg-muted/30"
                      : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(expandedMatches);
                      if (next.has(match.jobIndex)) next.delete(match.jobIndex);
                      else next.add(match.jobIndex);
                      setExpandedMatches(next);
                    }}
                    className="w-full flex items-start justify-between gap-3 p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {match.jobTitle || "Untitled"}{" "}
                        <span className="font-normal text-muted-foreground">
                          @ {mostRecent.company}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Previously:{" "}
                        <span className="font-medium text-foreground">
                          {mostRecent.job_title}
                        </span>{" "}
                        · {new Date(mostRecent.created_at).toLocaleDateString()}
                        {match.existingApplications.length > 1 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            (+{match.existingApplications.length - 1} more)
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronDown
                      className={`shrink-0 h-4 w-4 mt-0.5 text-muted-foreground transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-amber-200 dark:border-amber-800/60 pt-2">
                      {jobData?.job_url && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">
                            Job URL
                          </p>
                          <a
                            href={jobData.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline break-all"
                          >
                            {jobData.job_url}
                          </a>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">
                          Job Description
                        </p>
                        <p className="text-xs text-foreground/80 whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed">
                          {jobData?.job_description || "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {batchMode && jobs.length > 1 && (
                    <div className="px-3 pb-3 flex justify-end">
                      <Button
                        type="button"
                        variant={removing ? "outline" : "destructive"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = new Set(markedForRemoval);
                          if (next.has(match.jobIndex))
                            next.delete(match.jobIndex);
                          else next.add(match.jobIndex);
                          setMarkedForRemoval(next);
                        }}
                      >
                        {removing ? "Undo" : "Remove"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={dismissMatchModal}>
              Cancel
            </Button>
            <Button variant="warning" onClick={handleContinueDespiteMatches}>
              Continue Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
