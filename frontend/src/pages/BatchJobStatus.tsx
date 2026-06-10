import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBatchJob } from "../api/batch_jobs";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import type { BatchJobStatus } from "../types";

const POLL_INTERVAL_MS = 2500;
const ACTIVE_STATUSES = new Set(["pending", "running"]);

function StatusBadge({ status }: { status: BatchJobStatus["status"] }) {
  const cfg = {
    pending: { variant: "secondary" as const, label: "Queued", icon: <Clock className="h-3 w-3" /> },
    running: { variant: "info" as const, label: "Running", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { variant: "success" as const, label: "Completed", icon: <CheckCircle2 className="h-3 w-3" /> },
    partial: { variant: "warning" as const, label: "Partially Completed", icon: <AlertCircle className="h-3 w-3" /> },
    failed: { variant: "destructive" as const, label: "Failed", icon: <XCircle className="h-3 w-3" /> },
  } as const;

  const c = cfg[status] ?? cfg.pending;
  return (
    <Badge variant={c.variant} className="flex items-center gap-1">
      {c.icon}
      {c.label}
    </Badge>
  );
}

export default function BatchJobStatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<BatchJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJob = async () => {
    if (!jobId) return;
    try {
      const res = await getBatchJob(jobId);
      setJob(res.data);
      if (!ACTIVE_STATUSES.has(res.data.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {
      setError("Failed to load batch job status.");
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  useEffect(() => {
    fetchJob();
    pollRef.current = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  if (!job && !error) return <LoadingSpinner message="Loading batch job..." />;

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const isActive = job && ACTIVE_STATUSES.has(job.status);
  const processed = (job?.completed_jobs ?? 0) + (job?.failed_jobs ?? 0);
  const progressPct =
    job && job.total_jobs > 0
      ? Math.round((processed / job.total_jobs) * 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Batch Generation"
          description={job?.profile_name ? `Profile: ${job.profile_name}` : undefined}
          className="mb-0"
        />
        {job && <StatusBadge status={job.status} />}
      </div>

      {job && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold">{processed}</span>
                <span className="text-lg text-muted-foreground">
                  {" "}
                  / {job.total_jobs} jobs
                </span>
              </div>
              <div className="text-right text-sm space-y-0.5">
                {job.completed_jobs > 0 && (
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 justify-end">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {job.completed_jobs} succeeded
                  </p>
                )}
                {job.failed_jobs > 0 && (
                  <p className="text-destructive font-medium flex items-center gap-1 justify-end">
                    <XCircle className="h-3.5 w-3.5" />
                    {job.failed_jobs} failed
                  </p>
                )}
              </div>
            </div>

            <Progress value={progressPct} className="h-2.5" />

            {job.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Queued — waiting for the worker to pick this up...
              </p>
            )}
            {job.status === "running" && (
              <p className="text-sm text-muted-foreground">
                Generating resumes and cover letters. This page updates
                automatically.
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-3 border-t">
              <span>
                Submitted {new Date(job.created_at).toLocaleTimeString()}
              </span>
              {job.started_at && (
                <span>
                  Started {new Date(job.started_at).toLocaleTimeString()}
                </span>
              )}
              {job.completed_at && (
                <span>
                  Finished {new Date(job.completed_at).toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {job && !isActive && job.total_cost > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Generation Cost
            </p>
            <div className="flex gap-6 text-sm">
              <span>
                Total:{" "}
                <span className="font-semibold">${job.total_cost.toFixed(4)}</span>
              </span>
              <span>
                {(
                  job.total_prompt_tokens + job.total_completion_tokens
                ).toLocaleString()}{" "}
                tokens
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {job && job.error_details.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed Jobs ({job.error_details.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.error_details.map((e) => (
              <div
                key={e.index}
                className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
              >
                <p className="text-sm font-medium">
                  #{e.index + 1} — {e.job_title || "Untitled"}
                </p>
                <p className="text-xs text-destructive mt-1 break-words">
                  {e.error}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {job && !isActive && (
        <div className="flex gap-3">
          {(job.status === "completed" || job.status === "partial") && (
            <Button onClick={() => navigate("/history")}>
              <ChevronRight className="h-4 w-4" />
              View in History
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/generate")}>
            Generate More
          </Button>
        </div>
      )}
    </div>
  );
}
