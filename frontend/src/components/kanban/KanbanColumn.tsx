import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Phone } from "lucide-react";
import type { Call } from "../../types";
import KanbanCard from "./KanbanCard";

interface KanbanColumnProps {
  stage: string;
  label: string;
  color: string;
  calls: Call[];
  onCardClick: (call: Call) => void;
  onCardClose: (call: Call) => void;
}

export default function KanbanColumn({
  stage,
  label,
  color,
  calls,
  onCardClick,
  onCardClose,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col min-w-[272px] w-[272px]">
      {/* Colored top accent */}
      <div className="h-[3px] rounded-t-xl" style={{ backgroundColor: color }} />

      {/* Column shell */}
      <div
        className={`flex flex-col rounded-b-xl h-[calc(100vh-14rem)] transition-colors duration-150 ${
          isOver ? "bg-accent/60" : "bg-muted/30"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-[12px] font-semibold tracking-wide uppercase text-muted-foreground">
              {label}
            </h3>
          </div>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
            style={{
              backgroundColor: color + "20",
              color,
            }}
          >
            {calls.length}
          </span>
        </div>

        {/* Drop zone + cards */}
        <div
          ref={setNodeRef}
          className="flex flex-col gap-2 px-2.5 pb-3 flex-1 overflow-y-auto"
        >
          <SortableContext items={calls.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {calls.map((call) => (
              <KanbanCard
                key={call.id}
                call={call}
                stageColor={color}
                onClick={() => onCardClick(call)}
                onClose={() => onCardClose(call)}
              />
            ))}
          </SortableContext>

          {/* Empty state */}
          {calls.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color + "15" }}
              >
                <Phone className="h-4 w-4" style={{ color }} />
              </div>
              <p className="text-[11px] font-medium text-muted-foreground/50">No calls</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
