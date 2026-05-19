import {
  AlertCircle,
  Calendar,
  DollarSign,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  getAdminUserCosts,
} from "../api/admin";
import type {
  AdminOverview,
  DailyStatPoint,
  ProfileStatPoint,
  UserCostStat,
  UserDailyPoint,
} from "../api/admin";
import LoadingSpinner from "../components/LoadingSpinner";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const CHART_COLORS = [
  "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

type Preset = "7d" | "30d" | "90d" | "custom";

function getPresetDates(preset: Preset, customFrom: string, customTo: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const to = fmt(today);
  if (preset === "7d") return { from: fmt(new Date(Date.now() - 6 * 86400000)), to };
  if (preset === "30d") return { from: fmt(new Date(Date.now() - 29 * 86400000)), to };
  if (preset === "90d") return { from: fmt(new Date(Date.now() - 89 * 86400000)), to };
  return { from: customFrom, to: customTo };
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ?? "bg-primary/10"}`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [daily, setDaily] = useState<DailyStatPoint[]>([]);
  const [perUserDaily, setPerUserDaily] = useState<UserDailyPoint[]>([]);
  const [perProfile, setPerProfile] = useState<ProfileStatPoint[]>([]);
  const [userCosts, setUserCosts] = useState<UserCostStat[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyStatPoint[]>([]);
  const [perUserDailyCalls, setPerUserDailyCalls] = useState<UserDailyPoint[]>([]);
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
      const [ovRes, dailyRes, puRes, ppRes, ucRes, dcRes, pucRes] = await Promise.all([
        getAdminOverview(),
        getAdminDailyStats(f, t),
        getAdminPerUserDaily(f, t),
        getAdminPerProfile(f, t),
        getAdminUserCosts(),
        getAdminDailyCallStats(f, t),
        getAdminPerUserDailyCallStats(f, t),
      ]);
      setOverview(ovRes.data);
      setDaily(dailyRes.data);
      setPerUserDaily(puRes.data);
      setPerProfile(ppRes.data);
      setUserCosts(ucRes.data);
      setDailyCalls(dcRes.data);
      setPerUserDailyCalls(pucRes.data);
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
  const dailyCostData = daily.map((d) => ({ date: d.date.slice(5), cost: parseFloat(d.cost.toFixed(4)) }));
  const dailyCountData = daily.map((d) => ({ date: d.date.slice(5), count: d.count }));

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform-wide analytics</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/settings">Settings →</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Today's Applications"
            value={overview.today_count}
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            accent="bg-primary/10"
          />
          <StatCard
            label="Today's Cost"
            value={`$${overview.today_cost.toFixed(4)}`}
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            accent="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <StatCard
            label="Active Users"
            value={overview.active_users}
            icon={<Users className="h-4 w-4 text-blue-600" />}
            accent="bg-blue-100 dark:bg-blue-900/30"
          />
          <StatCard
            label="Pending Approvals"
            value={overview.pending_users}
            sub={overview.pending_users > 0 ? "Settings → review" : undefined}
            icon={<Calendar className="h-4 w-4 text-amber-600" />}
            accent="bg-amber-100 dark:bg-amber-900/30"
          />
          <StatCard
            label="Calls Scheduled"
            value={overview.calls_scheduled}
            sub="all users · all time"
            icon={<Phone className="h-4 w-4 text-violet-600" />}
            accent="bg-violet-100 dark:bg-violet-900/30"
          />
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
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "7d" ? "7 days" : p === "30d" ? "30 days" : p === "90d" ? "90 days" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-auto h-8 text-sm"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-auto h-8 text-sm"
                />
              </>
            )}
            <Button size="sm" onClick={() => loadAll(from, to)}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Daily Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCountData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyCountData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Applications" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-User Daily */}
        {usernames.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Applications by User (Daily)</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedUser === null
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {usernames.map((u, i) => (
                    <button
                      key={u}
                      onClick={() => setSelectedUser(u === selectedUser ? null : u)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-colors text-white"
                      style={{ backgroundColor: selectedUser === u ? CHART_COLORS[i % CHART_COLORS.length] : undefined }}
                    >
                      <span
                        className={selectedUser === u ? "" : "text-muted-foreground hover:text-foreground"}
                        style={selectedUser !== u ? { backgroundColor: "var(--muted)", color: "var(--muted-foreground)", padding: "4px 12px", borderRadius: "9999px" } : undefined}
                      >
                        {u}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                {selectedUser ? (
                  <BarChart data={singleUserChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name={selectedUser}
                      fill={CHART_COLORS[usernames.indexOf(selectedUser) % CHART_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <BarChart data={perUserChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {usernames.map((u, i) => (
                      <Bar
                        key={u}
                        dataKey={u}
                        stackId="a"
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === usernames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Daily Calls */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Daily Calls Scheduled</CardTitle>
              {callUsernames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCallUser(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCallUser === null
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {callUsernames.map((u, i) => (
                    <button
                      key={u}
                      onClick={() => setSelectedCallUser(u === selectedCallUser ? null : u)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedCallUser === u ? "text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      style={selectedCallUser === u ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(selectedCallUser ? singleCallUserChartData : callUsernames.length > 1 ? perUserCallChartData : dailyCallsChartData).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No calls scheduled in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                {selectedCallUser ? (
                  <BarChart data={singleCallUserChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name={selectedCallUser} fill={CHART_COLORS[callUsernames.indexOf(selectedCallUser) % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                ) : callUsernames.length > 1 ? (
                  <BarChart data={perUserCallChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {callUsernames.map((u, i) => (
                      <Bar key={u} dataKey={u} stackId="c" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === callUsernames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                ) : (
                  <BarChart data={dailyCallsChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Calls Scheduled" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Cost */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Cost ($)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyCostData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyCostData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`$${v}`, "Cost"]} />
                    <Bar dataKey="cost" name="Cost ($)" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Profiles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Profiles (by Applications)</CardTitle>
            </CardHeader>
            <CardContent>
              {profileChartData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={profileChartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Applications" radius={[0, 3, 3, 0]}>
                      {profileChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Cost Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Cost Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Today Apps</TableHead>
                  <TableHead className="text-right">Today Cost</TableHead>
                  <TableHead className="text-right">7d Apps</TableHead>
                  <TableHead className="text-right">7d Cost</TableHead>
                  <TableHead className="text-right">30d Apps</TableHead>
                  <TableHead className="text-right">30d Cost</TableHead>
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
      </div>
    </div>
  );
}
