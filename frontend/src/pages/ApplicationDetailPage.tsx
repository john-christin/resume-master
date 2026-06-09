import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getApplication } from "../api/applications";
import { getUserRole } from "../auth";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import type { ApplicationDetail } from "../types";

async function smartDownload(url: string, filename: string): Promise<void> {
  if ("showSaveFilePicker" in window) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const blob = await response.blob();
      const ext = filename.endsWith(".docx") ? ".docx" : ".pdf";
      const mimeType =
        ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Document", accept: { [mimeType]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
      }
      className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

type FormatPicker = {
  type: "resume" | "cover";
  file: string;
  profileName: string;
};

export default function ApplicationDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const role = getUserRole();

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formatPicker, setFormatPicker] = useState<FormatPicker | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    getApplication(appId)
      .then((res) => setDetail(res.data))
      .catch(() => setError("Application not found or you don't have access."))
      .finally(() => setLoading(false));
  }, [appId]);

  if (loading) return <LoadingSpinner message="Loading application..." />;

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/history")}>
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? "Application not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const showCost = role === "admin";
  const shareUrl = `${window.location.origin}/history/${detail.id}`;

  let bullets: string[] = [];
  if (detail.tailored_bullets) {
    try {
      bullets = JSON.parse(detail.tailored_bullets);
    } catch {}
  }

  const toFile = (raw: string, label: string, ext: string) => {
    const base = raw.replace(/\.(pdf|docx)$/, "");
    const sn = (detail.profile_name ?? "Resume").trim().replace(/\s+/g, "_");
    return {
      url: `/api/download/${base}.${ext}?name=${sn}_${label}.${ext}`,
      name: `${sn}_${label}.${ext}`,
    };
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            setToast("Link copied!");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Link
        </Button>
      </div>

      {/* Title + downloads */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{detail.job_title}</CardTitle>
              {detail.company && (
                <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{detail.company}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {detail.resume_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                  onClick={() => {
                    const file = detail.resume_path!.split("/").pop()!;
                    setFormatPicker({
                      type: "resume",
                      file,
                      profileName: (detail.profile_name ?? "Resume")
                        .trim()
                        .replace(/\s+/g, "_"),
                    });
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Resume
                </Button>
              )}
              {detail.cover_letter_path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800"
                  onClick={() => {
                    const file = detail.cover_letter_path!.split("/").pop()!;
                    setFormatPicker({
                      type: "cover",
                      file,
                      profileName: (detail.profile_name ?? "Resume")
                        .trim()
                        .replace(/\s+/g, "_"),
                    });
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Cover Letter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Date</p>
              <span>{new Date(detail.created_at).toLocaleDateString()}</span>
            </div>
            {detail.profile_name && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Profile</p>
                <span>{detail.profile_name}</span>
              </div>
            )}
            {detail.tech_stack_name && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Tech Stack</p>
                <Badge variant="purple">{detail.tech_stack_name}</Badge>
              </div>
            )}
            {detail.location && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Work Mode</p>
                <span>{detail.location}</span>
              </div>
            )}
            {(role === "caller" || role === "admin") && detail.user_username && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">User</p>
                <span>{detail.user_username}</span>
              </div>
            )}
            {showCost && detail.total_cost != null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cost</p>
                <span>${detail.total_cost.toFixed(4)}</span>
              </div>
            )}
            {detail.salary_range && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Salary Range</p>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {detail.salary_range}
                </span>
                <CopyBtn value={detail.salary_range} />
              </div>
            )}
          </div>

          {/* Required Skills */}
          {(detail.required_skills?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Required Skills</p>
                <CopyBtn value={(detail.required_skills ?? []).join(", ")} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(detail.required_skills ?? []).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs font-medium">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Profile Info */}
          {(detail.profile_email ||
            detail.profile_phone ||
            detail.profile_location ||
            detail.profile_linkedin ||
            detail.profile_university) && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Profile Info</p>
              {detail.profile_email && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground w-20 text-xs shrink-0">Email</span>
                  <span>{detail.profile_email}</span>
                  <CopyBtn value={detail.profile_email} />
                </div>
              )}
              {detail.profile_phone && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground w-20 text-xs shrink-0">Phone</span>
                  <span>{detail.profile_phone}</span>
                  <CopyBtn value={detail.profile_phone} />
                </div>
              )}
              {detail.profile_location && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground w-20 text-xs shrink-0">Address</span>
                  <span>{detail.profile_location}</span>
                  <CopyBtn value={detail.profile_location} />
                </div>
              )}
              {detail.profile_linkedin && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground w-20 text-xs shrink-0">LinkedIn</span>
                  <a
                    href={detail.profile_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate max-w-[300px]"
                  >
                    {detail.profile_linkedin}
                  </a>
                  <CopyBtn value={detail.profile_linkedin} />
                </div>
              )}
              {detail.profile_university && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground w-20 text-xs shrink-0">University</span>
                  <span>{detail.profile_university}</span>
                  <CopyBtn value={detail.profile_university} />
                </div>
              )}
            </div>
          )}

          {/* Job URL */}
          {detail.job_url && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Job Link</p>
              <a
                href={detail.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {detail.job_url}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tailored Bullets */}
      {bullets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tailored Bullets</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Cover Letter */}
      {detail.cover_letter_text && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cover Letter</CardTitle>
              <CopyBtn value={detail.cover_letter_text} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {detail.cover_letter_text}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-foreground/80 whitespace-pre-wrap bg-background border rounded-md p-3 max-h-80 overflow-y-auto leading-relaxed">
            {detail.job_description}
          </div>
        </CardContent>
      </Card>

      {/* Format picker */}
      <Dialog open={!!formatPicker} onOpenChange={(o) => !o && setFormatPicker(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Choose Format</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                if (!formatPicker) return;
                const label = formatPicker.type === "resume" ? "Resume" : "Cover_Letter";
                const r = toFile(formatPicker.file, label, "pdf");
                smartDownload(r.url, r.name);
                setFormatPicker(null);
              }}
            >
              <FileText className="h-5 w-5" />
              PDF
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-primary border-primary/30 hover:bg-primary/10"
              onClick={() => {
                if (!formatPicker) return;
                const label = formatPicker.type === "resume" ? "Resume" : "Cover_Letter";
                const r = toFile(formatPicker.file, label, "docx");
                smartDownload(r.url, r.name);
                setFormatPicker(null);
              }}
            >
              <FileText className="h-5 w-5" />
              DOCX
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm bg-foreground text-background animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
