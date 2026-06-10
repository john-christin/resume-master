import { Calendar, Settings } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { getUserRole } from "../auth";
import { getCallStages } from "../api/callStages";
import { getCalls, updateCall } from "../api/calls";
import CallFormDialog from "../components/kanban/CallFormDialog";
import KanbanBoard from "../components/kanban/KanbanBoard";
import StageManagerDialog from "../components/kanban/StageManagerDialog";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { Call, CallStageConfig, CallStatus } from "../types";

type TimeRange = "today" | "7d" | "30d" | "all";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d",    label: "7 days" },
  { value: "30d",   label: "30 days" },
  { value: "all",   label: "All time" },
];

function isCallInRange(call: Call, range: TimeRange): boolean {
  if (range === "all") return true;
  // Calls with no scheduled_at are always shown (unscheduled)
  if (!call.scheduled_at) return true;
  const utc = /Z|[+-]\d{2}:?\d{2}$/.test(call.scheduled_at)
    ? call.scheduled_at
    : call.scheduled_at + "Z";
  const callDate = new Date(utc);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") {
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    return callDate >= startOfToday && callDate < endOfToday;
  }
  const days = range === "7d" ? 7 : 30;
  const cutoff = new Date(startOfToday.getTime() + days * 86400000);
  return callDate >= startOfToday && callDate < cutoff;
}

const STATUS_SUMMARY_COLORS: Record<CallStatus, string> = {
  scheduled: "text-blue-500",
  pending:   "text-amber-500",
  passed:    "text-emerald-500",
  failed:    "text-red-500",
  cancelled: "text-muted-foreground",
};

export default function Kanban() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [stages, setStages] = useState<CallStageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Call | null>(null);
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [stageManagerOpen, setStageManagerOpen] = useState(false);

  const role = getUserRole();
  const isAdmin = role === "admin";

  useEffect(() => {
    Promise.all([getCalls(), getCallStages()])
      .then(([callsRes, stagesRes]) => {
        setCalls(callsRes.data);
        setStages(stagesRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const profiles = useMemo(() => {
    const names = calls.map((c) => c.profile_name).filter((n): n is string => Boolean(n));
    return Array.from(new Set(names)).sort();
  }, [calls]);

  const visibleCalls = useMemo(
    () => calls
      .filter((c) => profileFilter === "all" || c.profile_name === profileFilter)
      .filter((c) => isCallInRange(c, timeRange)),
    [calls, profileFilter, timeRange]
  );

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<CallStatus, number>> = {};
    for (const c of visibleCalls) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [visibleCalls]);

  const handleClose = async (call: Call) => {
    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    try {
      await updateCall(call.id, { is_closed: true });
    } catch {
      setCalls((prev) => [...prev, call]);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Call Board</h1>
          {!loading && visibleCalls.length > 0 ? (
            <div className="flex items-center gap-2.5 mt-0.5">
              {(Object.entries(statusCounts) as [CallStatus, number][])
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <span key={status} className={`text-[11px] font-medium ${STATUS_SUMMARY_COLORS[status]}`}>
                    {count} {status}
                  </span>
                ))}
            </div>
          ) : !loading ? (
            <p className="text-xs text-muted-foreground mt-0.5">No active calls</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeline range buttons */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1.5 shrink-0" />
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeRange(opt.value)}
                className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all ${
                  timeRange === opt.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {profiles.length > 0 && (
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All Profiles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setStageManagerOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" />
              Stages
            </Button>
          )}
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-[272px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 pb-2 flex-1">
          <KanbanBoard
            calls={visibleCalls}
            stages={stages}
            onCallsChange={(updated) => {
              setCalls((prev) =>
                prev.map((c) => {
                  const u = updated.find((x) => x.id === c.id);
                  return u ?? c;
                })
              );
            }}
            onCardClick={setEditTarget}
            onCardClose={handleClose}
          />
        </div>
      )}

      {editTarget && (
        <CallFormDialog
          open={!!editTarget}
          onOpenChange={(o) => { if (!o) setEditTarget(null); }}
          applicationId={editTarget.application_id}
          jobTitle={editTarget.job_title ?? ""}
          company={editTarget.company ?? undefined}
          existingCall={editTarget}
          stages={stages}
          onSuccess={(updated) => {
            setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditTarget(null);
          }}
          onDelete={() => {
            setCalls((prev) => prev.filter((c) => c.id !== editTarget.id));
            setEditTarget(null);
          }}
        />
      )}

      {isAdmin && (
        <StageManagerDialog
          open={stageManagerOpen}
          onOpenChange={setStageManagerOpen}
          stages={stages}
          onStagesChange={setStages}
        />
      )}
    </div>
  );
}
