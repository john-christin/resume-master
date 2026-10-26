import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Table2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getJobSheetStatus, retryJobSheet, testJobSheet } from "../api/jobSheet";
import type { JobSheetCheck, JobSheetStatus } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Props {
  /** Saved profile id; undefined while the profile is still being created. */
  profileId?: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  readOnly?: boolean;
}

const errorText = (err: unknown, fallback: string): string => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

export default function JobSheetSettings({ profileId, value, onChange, readOnly }: Props) {
  const [status, setStatus] = useState<JobSheetStatus | null>(null);
  const [check, setCheck] = useState<JobSheetCheck | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"test" | "retry" | null>(null);

  const loadStatus = useCallback(() => {
    if (!profileId) return;
    getJobSheetStatus(profileId)
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, [profileId]);

  useEffect(loadStatus, [loadStatus]);

  const handleTest = async () => {
    if (!profileId) return;
    setBusy("test");
    setMessage("");
    setCheck(null);
    try {
      setCheck((await testJobSheet(profileId)).data);
    } catch (err) {
      setMessage(errorText(err, "Could not reach the sheet."));
    } finally {
      setBusy(null);
    }
  };

  const handleRetry = async () => {
    if (!profileId) return;
    setBusy("retry");
    try {
      await retryJobSheet(profileId);
      loadStatus();
    } finally {
      setBusy(null);
    }
  };

  const savedUrl = status?.sheet_url ?? null;
  const unsaved = (value ?? null) !== savedUrl;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Table2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <Label className="text-sm font-medium">Job Tracking Sheet</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Queued jobs are added to this Google Sheet, and ticking Applied in History ticks the
            Applied? column.
          </p>
        </div>
      </div>

      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder="https://docs.google.com/spreadsheets/d/…"
        disabled={readOnly}
      />

      {status && !status.configured && (
        <p className="text-xs text-amber-500">
          Google access isn&apos;t set up on the server yet, so nothing will be written until an
          admin adds the service account.
        </p>
      )}
      {status?.configured && status.service_account_email && (
        <p className="text-xs text-muted-foreground">
          Share the sheet with <span className="font-mono">{status.service_account_email}</span> as
          Editor.
        </p>
      )}

      {profileId && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={busy !== null || !value || unsaved}
          >
            {busy === "test" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Test connection
          </Button>
          {unsaved && <span className="text-xs text-muted-foreground">Save the profile first.</span>}
        </div>
      )}

      {check && (
        <p className="text-xs text-green-500 flex items-start gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Connected to tab &ldquo;{check.tab}&rdquo;: {check.filled_rows} jobs so far, next row{" "}
            {check.next_row}.
            {check.missing_columns.length > 0 && (
              <span className="text-amber-500">
                {" "}
                Missing columns (skipped): {check.missing_columns.join(", ")}.
              </span>
            )}
          </span>
        </p>
      )}
      {message && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {message}
        </p>
      )}

      {status && (status.pending > 0 || status.failed > 0) && (
        <div className="text-xs space-y-1.5">
          <p className="text-muted-foreground">
            {status.pending} update{status.pending === 1 ? "" : "s"} waiting
            {status.failed > 0 && <span className="text-destructive">, {status.failed} failed</span>}
            {status.last_error && <span> — {status.last_error}</span>}
          </p>
          {status.failed > 0 && !readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={handleRetry} disabled={busy !== null}>
              {busy === "retry" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Retry failed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
