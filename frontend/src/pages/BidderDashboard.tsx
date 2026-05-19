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
  Bar,
  BarChart,
  CartesianGrid,
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
import type {
  MyProfileStat,
  MyStackStat,
  MyStatsResponse,
} from "../api/stats";
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
import type { ApplicationSummary } from "../types";

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

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your application activity at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/generate">
              <Wand2 className="h-4 w-4" />
              New Application
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/history">
              <History className="h-4 w-4" />
              History
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Today"
            value={stats.summary.today_count}
            sub="applications"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            accent="bg-primary/10"
          />
          <StatCard
            label="This Week"
            value={stats.summary.week_count}
            sub="last 7 days"
            icon={<Calendar className="h-4 w-4 text-violet-600" />}
            accent="bg-violet-100 dark:bg-violet-900/30"
          />
          <StatCard
            label="This Month"
            value={stats.summary.month_count}
            sub="last 30 days"
            icon={<Calendar className="h-4 w-4 text-blue-600" />}
            accent="bg-blue-100 dark:bg-blue-900/30"
          />
          <StatCard
            label="Month Cost"
            value={`$${stats.summary.month_cost.toFixed(4)}`}
            sub="last 30 days"
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            accent="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <StatCard
            label="Calls Scheduled"
            value={stats.summary.calls_scheduled}
            sub="all time"
            icon={<Phone className="h-4 w-4 text-amber-600" />}
            accent="bg-amber-100 dark:bg-amber-900/30"
          />
        </div>
      )}

      {/* Date range selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Range:
            </span>
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
                {p === "7d"
                  ? "7 days"
                  : p === "30d"
                    ? "30 days"
                    : p === "90d"
                      ? "90 days"
                      : "Custom"}
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
            <Button
              size="sm"
              onClick={() => loadData(from, to)}
            >
              Apply
            </Button>
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
            {dailyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No applications in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={dailyData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Applications"
                    fill={CHART_COLORS[0]}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {profileData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No data.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={profileData.map((p) => ({
                      name:
                        p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
                      count: p.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Applications" radius={[0, 3, 3, 0]}>
                      {profileData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Tech Stack</CardTitle>
            </CardHeader>
            <CardContent>
              {stackData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No data.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stackData.map((s) => ({
                        name: s.stack_name,
                        value: s.count,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {stackData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {callData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Calls Scheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={callData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Calls Scheduled"
                    fill="#10b981"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Applications</CardTitle>
            <Link
              to="/history"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentApps.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No applications yet.{" "}
                      <Link to="/generate" className="text-primary hover:underline">
                        Create one!
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentApps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/preview/${app.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {app.job_title ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.company ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(app.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {app.total_cost != null
                          ? `$${app.total_cost.toFixed(4)}`
                          : "—"}
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
