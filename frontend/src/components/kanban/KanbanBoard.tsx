import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { updateCall } from "../../api/calls";
import type { Call, CallStageConfig, CallStatus } from "../../types";
import KanbanCard from "./KanbanCard";
import KanbanColumn from "./KanbanColumn";

const STAGE_COLORS = [
  "#5E5ADB", // indigo-violet
  "#0EA5E9", // sky blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // rose red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
];

function getStageColor(index: number): string {
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

interface KanbanBoardProps {
  calls: Call[];
  stages: CallStageConfig[];
  onCallsChange: (calls: Call[]) => void;
  onCardClick: (call: Call) => void;
  onCardClose: (call: Call) => void;
}

export default function KanbanBoard({
  calls,
  stages,
  onCallsChange,
  onCardClick,
  onCardClose,
}: KanbanBoardProps) {
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const stageColorMap = useMemo(
    () => Object.fromEntries(stages.map((s, i) => [s.value, getStageColor(i)])),
    [stages]
  );

  const stageValues = stages.map((s) => s.value);

  const callsByStage = stages.reduce<Record<string, Call[]>>((acc, { value }) => {
    acc[value] = calls.filter((c) => c.stage === value);
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    const call = calls.find((c) => c.id === event.active.id);
    setActiveCall(call ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedCall = activeCall;
    setActiveCall(null);

    const { active, over } = event;
    if (!over || !draggedCall) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeStage = calls.find((c) => c.id === activeId)?.stage;
    const newStage: string | undefined = stageValues.includes(overId)
      ? overId
      : calls.find((c) => c.id === overId)?.stage;

    if (!activeStage || !newStage || activeStage === newStage) return;

    const savedDetails = draggedCall.stage_statuses?.[newStage];
    const optimisticCall: Call = savedDetails
      ? {
          ...draggedCall,
          stage: newStage,
          status: (savedDetails.status ?? "scheduled") as CallStatus,
          scheduled_at: savedDetails.scheduled_at,
          recording_link: savedDetails.recording_link,
          with_whom: savedDetails.with_whom,
          interviewer_role: savedDetails.interviewer_role,
          call_type: savedDetails.call_type,
          call_link: savedDetails.call_link,
          additional_note: savedDetails.additional_note,
        }
      : {
          ...draggedCall,
          stage: newStage,
          status: "scheduled" as CallStatus,
          scheduled_at: null,
          recording_link: null,
          with_whom: null,
          interviewer_role: null,
          call_type: null,
          call_link: null,
          additional_note: null,
        };

    const snapshot = calls;
    onCallsChange(snapshot.map((c) => (c.id === activeId ? optimisticCall : c)));

    updateCall(activeId, { stage: newStage })
      .then((res) => {
        onCallsChange(snapshot.map((c) => (c.id === activeId ? res.data : c)));
      })
      .catch(() => {
        onCallsChange(snapshot);
      });
  };

  const activeColor = activeCall ? (stageColorMap[activeCall.stage] ?? STAGE_COLORS[0]) : STAGE_COLORS[0];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 h-full pb-4">
        {stages.map(({ value, name }, index) => (
          <KanbanColumn
            key={value}
            stage={value}
            label={name}
            color={getStageColor(index)}
            calls={callsByStage[value] ?? []}
            onCardClick={onCardClick}
            onCardClose={onCardClose}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeCall ? (
          <div className="rotate-2 scale-105">
            <KanbanCard
              call={activeCall}
              stageColor={activeColor}
              onClick={() => {}}
              onClose={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
