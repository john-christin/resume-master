import {
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  History,
  Phone,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getApplications } from "../api/applications";
import { getMyStats } from "../api/stats";
import type { MyProfileStat, MyStackStat, MyStatsResponse } from "../api/stats";
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
import type { ApplicationSummary } from "../types";

const COLORS = [
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
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function BidderDashboard() {
  const [stats, setStats] = useState<MyStatsResponse | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("30d");
  const today = new Date().toISOString().split("T")[0];
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = getPresetDates(preset, customFrom, customTo);

  const loadData = async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, appsRes] = await Promise.all([
        getMyStats(f, t),
        getApplications(1, 10, undefined, "created_at", "desc"),
      ]);
      setStats(statsRes.data);
      setRecentApps(appsRes.data.items);
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(from, to);
  }, []);

  const dailyData =
    stats?.daily.map((d) => ({ date: d.date.slice(5), count: d.count })) ?? [];
  const profileData: MyProfileStat[] = stats?.profiles ?? [];
  const stackData: MyStackStat[] = stats?.stacks ?? [];
  const callData =
    stats?.daily_calls?.map((d) => ({ date: d.date.slice(5), count: d.count })) ?? [];

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const axisProps = {
    tick: { fontSize: 11 },
    axisLine: false as const,
    tickLine: false as const,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Dashboard"
        description="Your application activity overview"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/history">
                <History className="h-4 w-4" />
                History
              </Link>
            </Button>
            <Button asChild>
              <Link to="/generate">
                <Wand2 className="h-4 w-4" />
                New Application
              </Link>
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Today" value={stats.summary.today_count} sub="applications"
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-violet-100 dark:bg-violet-900/40" iconColor="text-violet-600 dark:text-violet-400" />
          <StatCard label="This Week" value={stats.summary.week_count} sub="last 7 days"
            icon={<Calendar className="h-5 w-5" />}
            iconBg="bg-blue-100 dark:bg-blue-900/40" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard label="This Month" value={stats.summary.month_count} sub="last 30 days"
            icon={<Calendar className="h-5 w-5" />}
            iconBg="bg-indigo-100 dark:bg-indigo-900/40" iconColor="text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Month Cost" value={`$${stats.summary.month_cost.toFixed(4)}`} sub="last 30 days"
            icon={<DollarSign className="h-5 w-5" />}
            iconBg="bg-emerald-100 dark:bg-emerald-900/40" iconColor="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Calls Scheduled" value={stats.summary.calls_scheduled} sub="all time"
            icon={<Phone className="h-5 w-5" />}
            iconBg="bg-amber-100 dark:bg-amber-900/40" iconColor="text-amber-600 dark:text-amber-400" />
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
            <Button size="sm" onClick={() => loadData(from, to)}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {/* Daily Applications — Area chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Daily Applications</CardTitle>
            <p className="text-xs text-muted-foreground">Submissions over the selected period</p>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No applications in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#gradApps)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Profile — horizontal bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">By Profile</CardTitle>
              <p className="text-xs text-muted-foreground">Applications per profile</p>
            </CardHeader>
            <CardContent>
              {profileData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, profileData.length * 40)}>
                  <BarChart
                    data={profileData.map((p) => ({
                      name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
                      count: p.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={100} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Bar dataKey="count" name="Applications" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {profileData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* By Tech Stack — donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">By Tech Stack</CardTitle>
              <p className="text-xs text-muted-foreground">Distribution across stacks</p>
            </CardHeader>
            <CardContent>
              {stackData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stackData.map((s) => ({ name: s.stack_name, value: s.count }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      stroke="none"
                    >
                      {stackData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Calls — Area chart */}
        {callData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Daily Calls Scheduled</CardTitle>
              <p className="text-xs text-muted-foreground">Call scheduling activity</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={callData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
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
                    name="Calls"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradCalls)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Recent Applications</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Your latest submissions</p>
            </div>
            <Link to="/history" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Job Title</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Company</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No applications yet.{" "}
                      <Link to="/generate" className="text-primary hover:underline">Create one!</Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentApps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        <Link to={`/preview/${app.id}`} className="hover:text-primary transition-colors">
                          {app.job_title ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{app.company ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(app.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {app.total_cost != null ? `$${app.total_cost.toFixed(4)}` : "—"}
                      </TableCell>
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
