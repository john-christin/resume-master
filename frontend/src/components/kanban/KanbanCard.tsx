import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Calendar, ExternalLink, Phone, Video, X } from "lucide-react";
import type { Call, CallStatus } from "../../types";

const STATUS_CONFIG: Record<CallStatus, { label: string; color: string; bgClass: string }> = {
  scheduled: { label: "Scheduled", color: "#3B82F6", bgClass: "bg-blue-50 dark:bg-blue-950/40" },
  pending:   { label: "Pending",   color: "#F59E0B", bgClass: "bg-amber-50 dark:bg-amber-950/40" },
  passed:    { label: "Passed",    color: "#10B981", bgClass: "bg-emerald-50 dark:bg-emerald-950/40" },
  failed:    { label: "Failed",    color: "#EF4444", bgClass: "bg-red-50 dark:bg-red-950/40" },
  cancelled: { label: "Cancelled", color: "#9CA3AF", bgClass: "bg-muted" },
};

interface KanbanCardProps {
  call: Call;
  stageColor: string;
  onClick: () => void;
  onClose: () => void;
}

export default function KanbanCard({ call, stageColor, onClick, onClose }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: call.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const statusCfg = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.scheduled;

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const hasDetails = call.with_whom || call.scheduled_at || call.call_type;
  const interviewerInitial = call.with_whom?.[0]?.toUpperCase() ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group relative bg-card rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all duration-200 cursor-grab active:cursor-grabbing select-none border border-border/50 hover:-translate-y-0.5"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: stageColor }}
      />

      {/* Card body */}
      <div className="pl-4 pr-3 pt-3 pb-0">
        {/* Title + close */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold leading-snug line-clamp-2 flex-1 text-foreground">
            {call.job_title ?? "Untitled Position"}
          </p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Company */}
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground/80 truncate">
            {call.company ?? "—"}
          </span>
        </div>
      </div>

      {/* Details section */}
      {hasDetails && (
        <>
          <div className="mx-3 border-t border-border/40" />
          <div className="pl-4 pr-3 py-2 space-y-1.5">
            {call.with_whom && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: stageColor + "99" }}
                >
                  {interviewerInitial}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground leading-none truncate">
                    {call.with_whom}
                  </p>
                  {call.interviewer_role && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none truncate">
                      {call.interviewer_role}
                    </p>
                  )}
                </div>
              </div>
            )}

            {call.scheduled_at && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="tabular-nums">{formatDate(call.scheduled_at)}</span>
              </div>
            )}

            {call.call_type && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {call.call_type === "video" ? (
                  <Video className="h-3 w-3 shrink-0" />
                ) : (
                  <Phone className="h-3 w-3 shrink-0" />
                )}
                <span className="capitalize">{call.call_type}</span>
                {call.call_link && (
                  <ExternalLink className="h-2.5 w-2.5 ml-auto shrink-0 text-muted-foreground/50" />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Status footer */}
      <div className="pl-4 pr-3 py-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusCfg.bgClass}`}
          style={{ color: statusCfg.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: statusCfg.color }}
          />
          {statusCfg.label}
        </span>
      </div>
    </div>
  );
}
