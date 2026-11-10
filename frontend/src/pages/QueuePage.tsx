import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ListFilter,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SkipForward,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
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
import { getProfiles } from "../api/profile";
import { getUserId } from "../auth";
import Pagination from "../components/Pagination";
import PageHeader from "../components/shared/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import type { Profile } from "../types";

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

// "YYYY-MM-DD" in the user's local timezone, as <input type="date"> expects
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Start of that local day (plus offset days) as a real instant for the API
function localDayToISO(day: string, offsetDays = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + offsetDays).toISOString();
}

// The API returns naive UTC timestamps (no "Z"); read them as UTC, not local
function parseUtc(ts: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(ts) ? ts : `${ts}Z`);
}

// A column title that opens a filter; highlighted while its filter is active.
// Radix triggers (asChild) hand it a ref and handlers, so both must reach the <button>.
const FilterTrigger = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    hint?: string;
    active: boolean;
    icon: React.ReactNode;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(({ label, hint, active, icon, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    {...props}
    className={`inline-flex flex-col items-start rounded px-1 -mx-1 py-0.5 font-medium transition-colors hover:bg-muted ${
      active ? "text-primary" : ""
    } ${className ?? ""}`}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {icon}
    </span>
    {hint && <span className="text-[10px] font-normal opacity-80">{hint}</span>}
  </button>
));
FilterTrigger.displayName = "FilterTrigger";

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
  // Tasks queued by someone else on a shared profile are view-only
  const mine = task.user_id === getUserId();

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
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {mine ? "You" : task.username || "—"}
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
        {task.created_at ? parseUtc(task.created_at).toLocaleString() : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {mine && task.status === "needs_review" && (
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
          {mine && (task.status === "failed" || task.status === "needs_review") && (
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
          {mine &&
            task.status !== "processing" &&
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
          {mine && task.status !== "processing" && (
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
  // Default to today's tasks; clear both dates to see everything
  const [dateFrom, setDateFrom] = useState(() => toDateInput(new Date()));
  const [dateTo, setDateTo] = useState(() => toDateInput(new Date()));
  // Empty = every profile I can see (owned or shared); otherwise only these
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingControl, setLoadingControl] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getQueueStatus({
        profile_id: profileIds,
        created_from: dateFrom ? localDayToISO(dateFrom) : undefined,
        created_to: dateTo ? localDayToISO(dateTo, 1) : undefined,
      });
      setStatus(res.data);
    } catch {}
  }, [profileIds, dateFrom, dateTo]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await listTasks({
        status: activeTab === "all" ? undefined : activeTab,
        profile_id: profileIds,
        created_from: dateFrom ? localDayToISO(dateFrom) : undefined,
        created_to: dateTo ? localDayToISO(dateTo, 1) : undefined,
        page,
        page_size: pageSize,
      });
      setTasks(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
      // Deleting/skipping the last row of a page can leave us past the end
      if (page > res.data.total_pages) setPage(res.data.total_pages);
    } catch {}
  }, [activeTab, profileIds, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    getProfiles(true)
      .then((res) => setProfiles(res.data))
      .catch(() => {});
  }, []);

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

  const changeDates = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };

  const toggleProfile = (id: string, on: boolean) => {
    setProfileIds((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
    setPage(1);
  };

  const today = toDateInput(new Date());
  const isToday = dateFrom === today && dateTo === today;
  const isAllTime = !dateFrom && !dateTo;
  const dateHint = isToday
    ? "Today"
    : isAllTime
      ? "All time"
      : dateFrom === dateTo
        ? dateFrom
        : `${dateFrom || "…"} – ${dateTo || "…"}`;

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
                onClick={() => {
                  setActiveTab(tab.value);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
                {tab.value !== "all" && (status?.list_counts?.[tab.value as QueueTaskStatus] ?? 0) > 0 && (
                  <span className="ml-1.5 opacity-70">
                    {status?.list_counts?.[tab.value as QueueTaskStatus]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Job</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <FilterTrigger
                          label="Profile"
                          hint={
                            profileIds.length
                              ? `${profileIds.length} selected`
                              : "All profiles"
                          }
                          active={profileIds.length > 0}
                          icon={<ListFilter className="h-3 w-3" />}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                        {profiles.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No profiles
                          </div>
                        )}
                        {profiles.map((p) => (
                          <DropdownMenuCheckboxItem
                            key={p.id}
                            checked={profileIds.includes(p.id)}
                            onCheckedChange={(on) => toggleProfile(p.id, on)}
                            onSelect={(e) => e.preventDefault()} // stay open to pick several
                          >
                            {p.name}
                            {p.is_shared && p.owner_username && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                · {p.owner_username}
                              </span>
                            )}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {profileIds.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => {
                                setProfileIds([]);
                                setPage(1);
                              }}
                            >
                              Clear selection
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Added by</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Key</th>
                  <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FilterTrigger
                          label="Added"
                          hint={dateHint}
                          active={!isToday}
                          icon={<CalendarDays className="h-3 w-3" />}
                        />
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">From</div>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => {
                              const from = e.target.value;
                              // keep the range valid: pushing From past To drags To along
                              changeDates(from, from && dateTo && from > dateTo ? from : dateTo);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">To</div>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => {
                              const to = e.target.value;
                              changeDates(to && dateFrom && to < dateFrom ? to : dateFrom, to);
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isToday ? "default" : "outline"}
                            className="h-8 flex-1 text-xs"
                            onClick={() => changeDates(today, today)}
                          >
                            Today
                          </Button>
                          <Button
                            size="sm"
                            variant={isAllTime ? "default" : "outline"}
                            className="h-8 flex-1 text-xs"
                            onClick={() => changeDates("", "")}
                          >
                            All time
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                      {isToday
                        ? "No tasks today. Use the Added filter to look at earlier days."
                        : "No tasks in this view."}
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onAction={handleAction}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </div>
  );
}
