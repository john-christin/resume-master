import {
  AlertCircle,
  Calendar,
  DollarSign,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAdminDailyCallStats,
  getAdminDailyStats,
  getAdminOverview,
  getAdminPerProfile,
  getAdminPerUserDaily,
  getAdminPerUserDailyCallStats,
  getAdminUsageByModel,
  getAdminUserCosts,
} from "../api/admin";
import type {
  AdminOverview,
  DailyStatPoint,
  ProfileStatPoint,
  UserCostStat,
  UserDailyPoint,
} from "../api/admin";
import type { ModelUsageStat } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PageHeader from "../components/shared/PageHeader";
import StatCard from "../components/shared/StatCard";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const COLORS = [
  "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

type Preset = "7d" | "30d" | "90d" | "custom";

const ROLE_LABELS: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  jd_parse: "JD Parse",
  chat: "Chat",
  utility: "Utility",
};

function getPresetDates(preset: Preset, customFrom: string, customTo: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const to = fmt(today);
  if (preset === "7d") return { from: fmt(new Date(Date.now() - 6 * 86400000)), to };
  if (preset === "30d") return { from: fmt(new Date(Date.now() - 29 * 86400000)), to };
  if (preset === "90d") return { from: fmt(new Date(Date.now() - 89 * 86400000)), to };
  return { from: customFrom, to: customTo };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl text-sm">
      <p className="text-xs text-muted-foreground mb-1.5 font-medium">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground text-xs">{p.name}:</span>
          <span className="font-semibold">
            {p.name === "Cost ($)" ? `$${p.value}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [daily, setDaily] = useState<DailyStatPoint[]>([]);
  const [perUserDaily, setPerUserDaily] = useState<UserDailyPoint[]>([]);
  const [perProfile, setPerProfile] = useState<ProfileStatPoint[]>([]);
  const [userCosts, setUserCosts] = useState<UserCostStat[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyStatPoint[]>([]);
  const [perUserDailyCalls, setPerUserDailyCalls] = useState<UserDailyPoint[]>([]);
  const [usageByModel, setUsageByModel] = useState<ModelUsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedCallUser, setSelectedCallUser] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("30d");
  const today = new Date().toISOString().split("T")[0];
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = getPresetDates(preset, customFrom, customTo);

  const loadAll = async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, dailyRes, puRes, ppRes, ucRes, dcRes, pucRes, umRes] = await Promise.all([
        getAdminOverview(),
        getAdminDailyStats(f, t),
        getAdminPerUserDaily(f, t),
        getAdminPerProfile(f, t),
        getAdminUserCosts(),
        getAdminDailyCallStats(f, t),
        getAdminPerUserDailyCallStats(f, t),
        getAdminUsageByModel(f, t),
      ]);
      setOverview(ovRes.data);
      setDaily(dailyRes.data);
      setPerUserDaily(puRes.data);
      setPerProfile(ppRes.data);
      setUserCosts(ucRes.data);
      setDailyCalls(dcRes.data);
      setPerUserDailyCalls(pucRes.data);
      setUsageByModel(umRes.data);
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(from, to);
  }, []);

  const usernames = useMemo(() => {
    const s = new Set(perUserDaily.map((r) => r.username));
    return Array.from(s).sort();
  }, [perUserDaily]);

  const perUserChartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of perUserDaily) {
      if (!byDate[row.date]) byDate[row.date] = {};
      byDate[row.date][row.username] = row.count;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date: date.slice(5), ...users }));
  }, [perUserDaily]);

  const singleUserChartData = useMemo(() => {
    if (!selectedUser) return [];
    return perUserDaily
      .filter((r) => r.username === selectedUser)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date.slice(5), count: r.count }));
  }, [perUserDaily, selectedUser]);

  const callUsernames = useMemo(() => {
    const s = new Set(perUserDailyCalls.map((r) => r.username));
    return Array.from(s).sort();
  }, [perUserDailyCalls]);

  const perUserCallChartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of perUserDailyCalls) {
      if (!byDate[row.date]) byDate[row.date] = {};
      byDate[row.date][row.username] = row.count;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date: date.slice(5), ...users }));
  }, [perUserDailyCalls]);

  const singleCallUserChartData = useMemo(() => {
    if (!selectedCallUser) return [];
    return perUserDailyCalls
      .filter((r) => r.username === selectedCallUser)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date.slice(5), count: r.count }));
  }, [perUserDailyCalls, selectedCallUser]);

  const dailyCallsChartData = dailyCalls.map((d) => ({ date: d.date.slice(5), count: d.count }));
  const profileChartData = perProfile.slice(0, 15).map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
    count: p.count,
  }));
  const dailyCostData = daily.map((d) => ({
    date: d.date.slice(5),
    cost: parseFloat(d.cost.toFixed(4)),
  }));
  const dailyCountData = daily.map((d) => ({ date: d.date.slice(5), count: d.count }));

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const axisProps = {
    tick: { fontSize: 11 },
    axisLine: false as const,
    tickLine: false as const,
  };

  const activeCallData = selectedCallUser
    ? singleCallUserChartData
    : callUsernames.length > 1
      ? perUserCallChartData
      : dailyCallsChartData;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System overview and analytics" />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview stat cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Today's Applications" value={overview.today_count}
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-violet-100 dark:bg-violet-900/40" iconColor="text-violet-600 dark:text-violet-400" />
          <StatCard label="Today's Cost" value={`$${overview.today_cost.toFixed(4)}`}
            icon={<DollarSign className="h-5 w-5" />}
            iconBg="bg-emerald-100 dark:bg-emerald-900/40" iconColor="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Active Users" value={overview.active_users}
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-blue-100 dark:bg-blue-900/40" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard label="Pending Approvals" value={overview.pending_users}
            sub={overview.pending_users > 0 ? "Review in admin" : undefined}
            icon={<Calendar className="h-5 w-5" />}
            iconBg="bg-amber-100 dark:bg-amber-900/40" iconColor="text-amber-600 dark:text-amber-400" />
          <StatCard label="Calls Scheduled" value={overview.calls_scheduled} sub="all users · all time"
            icon={<Phone className="h-5 w-5" />}
            iconBg="bg-pink-100 dark:bg-pink-900/40" iconColor="text-pink-600 dark:text-pink-400" />
        </div>
      )}

      {/* Date range selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Range:</span>
            {(["7d", "30d", "90d", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  preset === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {p === "7d" ? "7 days" : p === "30d" ? "30 days" : p === "90d" ? "90 days" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto h-8 text-sm" />
                <span className="text-muted-foreground">→</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto h-8 text-sm" />
              </>
            )}
            <Button size="sm" onClick={() => loadAll(from, to)}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {/* Daily Applications — Area */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Daily Applications</CardTitle>
            <p className="text-xs text-muted-foreground">Platform-wide submissions per day</p>
          </CardHeader>
          <CardContent>
            {dailyCountData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyCountData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminGradApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis {...axisProps} dataKey="date" dy={4} />
                  <YAxis {...axisProps} allowDecimals={false} width={36} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#7c3aed", strokeWidth: 1, strokeOpacity: 0.3 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Applications"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    fill="url(#adminGradApps)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-User Daily — stacked bar or filtered area */}
        {usernames.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Applications by User</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Daily breakdown per user</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedUser === null
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {usernames.map((u, i) => (
                    <button
                      key={u}
                      onClick={() => setSelectedUser(u === selectedUser ? null : u)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        selectedUser === u ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      style={selectedUser === u ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                {selectedUser ? (
                  <AreaChart data={singleUserChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSingleUser" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[usernames.indexOf(selectedUser) % COLORS.length]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS[usernames.indexOf(selectedUser) % COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis {...axisProps} dataKey="date" dy={4} />
                    <YAxis {...axisProps} allowDecimals={false} width={36} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLORS[usernames.indexOf(selectedUser) % COLORS.length], strokeWidth: 1, strokeOpacity: 0.3 }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name={selectedUser}
                      stroke={COLORS[usernames.indexOf(selectedUser) % COLORS.length]}
                      strokeWidth={2.5}
                      fill="url(#gradSingleUser)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={perUserChartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                    <XAxis {...axisProps} dataKey="date" dy={4} />
                    <YAxis {...axisProps} allowDecimals={false} width={36} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    {usernames.map((u, i) => (
                      <Bar
                        key={u}
                        dataKey={u}
                        stackId="a"
                        fill={COLORS[i % COLORS.length]}
                        radius={i === usernames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        maxBarSize={40}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Daily Calls — Area or stacked bar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Daily Calls Scheduled</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Call scheduling activity across users</p>
              </div>
              {callUsernames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCallUser(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedCallUser === null
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {callUsernames.map((u, i) => (
                    <button
                      key={u}
                      onClick={() => setSelectedCallUser(u === selectedCallUser ? null : u)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        selectedCallUser === u ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      style={selectedCallUser === u ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeCallData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No calls scheduled in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                {selectedCallUser || callUsernames.length <= 1 ? (
                  <AreaChart
                    data={selectedCallUser ? singleCallUserChartData : dailyCallsChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="adminGradCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis {...axisProps} dataKey="date" dy={4} />
                    <YAxis {...axisProps} allowDecimals={false} width={36} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#10b981", strokeWidth: 1, strokeOpacity: 0.3 }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name={selectedCallUser ?? "Calls Scheduled"}
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#adminGradCalls)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={perUserCallChartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                    <XAxis {...axisProps} dataKey="date" dy={4} />
                    <YAxis {...axisProps} allowDecimals={false} width={36} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    {callUsernames.map((u, i) => (
                      <Bar
                        key={u}
                        dataKey={u}
                        stackId="c"
                        fill={COLORS[i % COLORS.length]}
                        radius={i === callUsernames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        maxBarSize={40}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Cost — Area */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Daily Cost</CardTitle>
              <p className="text-xs text-muted-foreground">AI spend per day</p>
            </CardHeader>
            <CardContent>
              {dailyCostData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyCostData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminGradCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis {...axisProps} dataKey="date" dy={4} />
                    <YAxis {...axisProps} width={52} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#10b981", strokeWidth: 1, strokeOpacity: 0.3 }} />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      name="Cost ($)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#adminGradCost)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Profiles — horizontal bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Top Profiles</CardTitle>
              <p className="text-xs text-muted-foreground">By application count</p>
            </CardHeader>
            <CardContent>
              {profileChartData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={profileChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={110} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Bar dataKey="count" name="Applications" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {profileChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Cost Summary table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">User Cost Summary</CardTitle>
            <p className="text-xs text-muted-foreground">Spend and activity breakdown by user</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">User</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Today Apps</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Today Cost</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">7d Apps</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">7d Cost</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">30d Apps</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">30d Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No users.</TableCell>
                  </TableRow>
                ) : (
                  userCosts.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="text-right">{u.today_count}</TableCell>
                      <TableCell className="text-right">${u.today_cost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{u.week_count}</TableCell>
                      <TableCell className="text-right">${u.week_cost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{u.month_count}</TableCell>
                      <TableCell className="text-right font-medium">${u.month_cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Usage & Cost by Model */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Usage &amp; Cost by Model</CardTitle>
            <p className="text-xs text-muted-foreground">AI spend broken down by task role and model, for the selected range</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Model</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Calls</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Tokens</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageByModel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No AI usage in this range.</TableCell>
                  </TableRow>
                ) : (
                  usageByModel.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.display_name ?? u.model_id}
                        <span className="ml-1.5 text-xs">· {u.provider}</span>
                      </TableCell>
                      <TableCell className="text-right">{u.call_count}</TableCell>
                      <TableCell className="text-right">{(u.prompt_tokens + u.completion_tokens).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">${u.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
