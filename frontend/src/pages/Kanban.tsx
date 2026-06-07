import { LayoutGrid, Settings } from "lucide-react";
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
    () => profileFilter === "all" ? calls : calls.filter((c) => c.profile_name === profileFilter),
    [calls, profileFilter]
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
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutGrid className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Call Board</h1>
            {!loading && visibleCalls.length > 0 && (
              <div className="flex items-center gap-2.5 mt-1">
                {(Object.entries(statusCounts) as [CallStatus, number][])
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <span key={status} className={`text-[11px] font-medium ${STATUS_SUMMARY_COLORS[status]}`}>
                      {count} {status}
                    </span>
                  ))}
              </div>
            )}
            {!loading && visibleCalls.length === 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">No active calls</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="overflow-x-auto -mx-1 px-1 pb-2">
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
