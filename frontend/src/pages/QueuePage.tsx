import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SkipForward,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteTask,
  getQueueStatus,
  listTasks,
  pauseQueue,
  startQueue,
  updateTask,
} from "../api/queue";
import type { QueueStatus, QueueTask, QueueTaskStatus } from "../api/queue";
import PageHeader from "../components/shared/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const STATUS_TABS: { value: QueueTaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "needs_review", label: "Needs Review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

const STATUS_COLORS: Record<QueueTaskStatus, string> = {
  queued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  needs_review: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  approved: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  skipped: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_ICONS: Record<QueueTaskStatus, React.ReactNode> = {
  queued: <Clock className="h-3 w-3" />,
  processing: <Loader2 className="h-3 w-3 animate-spin" />,
  needs_review: <AlertCircle className="h-3 w-3" />,
  approved: <ThumbsUp className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  skipped: <SkipForward className="h-3 w-3" />,
};

function StatusBadge({ status }: { status: QueueTaskStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}
    >
      {STATUS_ICONS[status]}
      {status.replace("_", " ")}
    </span>
  );
}

function TaskRow({
  task,
  onAction,
  onDelete,
}: {
  task: QueueTask;
  onAction: (id: string, action: "approve" | "retry" | "skip") => void;
  onDelete: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const act = async (action: "approve" | "retry" | "skip") => {
    setLoading(true);
    try {
      await onAction(task.id, action);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-sm truncate max-w-[200px]">
          {task.job_title || "—"}
        </div>
        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
          {task.company || "—"}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {task.profile_name || "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {task.used_key_label || "—"}
      </td>
      <td className="px-4 py-3">
        {task.warnings.length > 0 && (
          <div className="text-xs text-orange-400 max-w-[220px]">
            {task.warnings.map((w, i) => (
              <div key={i} className="truncate">• {w}</div>
            ))}
          </div>
        )}
        {task.error && (
          <div className="text-xs text-red-400 truncate max-w-[220px]">
            {task.error}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {task.created_at ? new Date(task.created_at).toLocaleString() : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {task.status === "needs_review" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={loading}
              onClick={() => act("approve")}
            >
              <ThumbsUp className="h-3 w-3 mr-1" />
              Approve
            </Button>
          )}
          {(task.status === "failed" || task.status === "needs_review") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={loading}
              onClick={() => act("retry")}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {task.status !== "processing" &&
            task.status !== "completed" &&
            task.status !== "skipped" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                disabled={loading}
                onClick={() => act("skip")}
              >
                <SkipForward className="h-3 w-3 mr-1" />
                Skip
              </Button>
            )}
          {task.application_id && (
            <Link to={`/history/${task.application_id}`}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
          {task.status !== "processing" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-400 hover:text-red-300"
              disabled={loading}
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function QueuePage() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [activeTab, setActiveTab] = useState<QueueTaskStatus | "all">("all");
  const [loadingControl, setLoadingControl] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getQueueStatus();
      setStatus(res.data);
    } catch {}
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await listTasks({
        status: activeTab === "all" ? undefined : activeTab,
      });
      setTasks(res.data.items);
    } catch {}
  }, [activeTab]);

  const refresh = useCallback(() => {
    fetchStatus();
    fetchTasks();
  }, [fetchStatus, fetchTasks]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const handleControl = async (action: "start" | "pause") => {
    setLoadingControl(true);
    try {
      if (action === "start") await startQueue();
      else await pauseQueue();
      await fetchStatus();
    } finally {
      setLoadingControl(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "retry" | "skip") => {
    await updateTask(id, action);
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    refresh();
  };

  const totalPending =
    (status?.counts.queued ?? 0) +
    (status?.counts.processing ?? 0) +
    (status?.counts.approved ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queue"
        subtitle="Manage your background application queue"
      />

      {/* Status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{totalPending}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-400">
              {status?.today_completed ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Done today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-400">
              {status?.counts.needs_review ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Needs review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1 text-2xl font-bold">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              {(status?.today_cost ?? 0).toFixed(4)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Today's cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Queue Control</CardTitle>
            <div className="flex items-center gap-2">
              {status && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    status.queue_running
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {status.queue_running ? "Running" : "Paused"}
                </span>
              )}
              <Button
                size="sm"
                variant={status?.queue_running ? "outline" : "default"}
                disabled={loadingControl || !status}
                onClick={() =>
                  handleControl(status?.queue_running ? "pause" : "start")
                }
              >
                {status?.queue_running ? (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Start
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {status?.current_task && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
              Processing:{" "}
              <span className="text-foreground font-medium">
                {status.current_task.job_title || "—"}
              </span>
              {status.current_task.company && (
                <span>at {status.current_task.company}</span>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Task list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
                {tab.value !== "all" && (status?.counts[tab.value as QueueTaskStatus] ?? 0) > 0 && (
                  <span className="ml-1.5 opacity-70">
                    {status?.counts[tab.value as QueueTaskStatus]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No tasks in this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Job</th>
                    <th className="px-4 py-2.5 text-left font-medium">Profile</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Key</th>
                    <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                    <th className="px-4 py-2.5 text-left font-medium">Added</th>
                    <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onAction={handleAction}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
