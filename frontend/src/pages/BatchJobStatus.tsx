import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBatchJob } from "../api/batch_jobs";
import LoadingSpinner from "../components/LoadingSpinner";
import type { BatchJobStatus } from "../types";

const POLL_INTERVAL_MS = 2500;
const ACTIVE_STATUSES = new Set(["pending", "running"]);

function StatusBadge({ status }: { status: BatchJobStatus["status"] }) {
  const styles: Record<string, string> = {
    pending:   "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
    running:   "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    completed: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    partial:   "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
    failed:    "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  };
  const labels: Record<string, string> = {
    pending: "Queued", running: "Running", completed: "Completed",
    partial: "Partially Completed", failed: "Failed",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === "running" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 mr-1.5 animate-pulse" />
      )}
      {labels[status]}
    </span>
  );
}

function ProgressBar({ completed, failed, total }: { completed: number; failed: number; total: number }) {
  const successPct = total > 0 ? (completed / total) * 100 : 0;
  const failedPct  = total > 0 ? (failed  / total) * 100 : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
      <div className="h-full flex">
        <div
          className="bg-green-500 dark:bg-green-400 transition-all duration-500"
          style={{ width: `${successPct}%` }}
        />
        <div
          className="bg-red-400 dark:bg-red-500 transition-all duration-500"
          style={{ width: `${failedPct}%` }}
        />
      </div>
    </div>
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
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  if (!job && !error) return <LoadingSpinner message="Loading batch job..." />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  const isActive = job && ACTIVE_STATUSES.has(job.status);
  const processed = (job?.completed_jobs ?? 0) + (job?.failed_jobs ?? 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Generation</h1>
          {job?.profile_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Profile: <span className="font-medium">{job.profile_name}</span>
            </p>
          )}
        </div>
        {job && <StatusBadge status={job.status} />}
      </div>

      {/* Progress card */}
      {job && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {/* Counts */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {processed}
                <span className="text-lg font-normal text-gray-400 dark:text-gray-500">
                  {" "}/ {job.total_jobs}
                </span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">jobs processed</p>
            </div>
            <div className="text-right text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
              {job.completed_jobs > 0 && (
                <p className="text-green-600 dark:text-green-400 font-medium">
                  ✓ {job.completed_jobs} succeeded
                </p>
              )}
              {job.failed_jobs > 0 && (
                <p className="text-red-500 dark:text-red-400 font-medium">
                  ✗ {job.failed_jobs} failed
                </p>
              )}
            </div>
          </div>

          <ProgressBar completed={job.completed_jobs} failed={job.failed_jobs} total={job.total_jobs} />

          {/* Status message */}
          {job.status === "pending" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Queued — waiting for the worker to pick this up...
            </p>
          )}
          {job.status === "running" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generating resumes and cover letters. This page updates automatically.
            </p>
          )}

          {/* Timing */}
          <div className="flex gap-6 text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Submitted {new Date(job.created_at).toLocaleTimeString()}</span>
            {job.started_at && <span>Started {new Date(job.started_at).toLocaleTimeString()}</span>}
            {job.completed_at && <span>Finished {new Date(job.completed_at).toLocaleTimeString()}</span>}
          </div>
        </div>
      )}

      {/* Cost summary — shown once done */}
      {job && !isActive && job.total_cost > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Generation Cost
          </p>
          <div className="flex gap-6 text-sm text-gray-700 dark:text-gray-300">
            <span>Total: <span className="font-semibold">${job.total_cost.toFixed(4)}</span></span>
            <span>{(job.total_prompt_tokens + job.total_completion_tokens).toLocaleString()} tokens</span>
          </div>
        </div>
      )}

      {/* Failed jobs detail */}
      {job && job.error_details.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Failed Jobs
          </p>
          {job.error_details.map((e) => (
            <div
              key={e.index}
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                #{e.index + 1} — {e.job_title || "Untitled"}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{e.error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {job && !isActive && (
        <div className="flex gap-3">
          {(job.status === "completed" || job.status === "partial") && (
            <button
              onClick={() => navigate("/history")}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              View in History
            </button>
          )}
          <button
            onClick={() => navigate("/generate")}
            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Generate More
          </button>
        </div>
      )}
    </div>
  );
}
