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
import type { MyProfileStat, MyStackStat, MyStatsResponse } from "../api/stats";
import type { ApplicationSummary } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-gray-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
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

  const dailyData = stats?.daily.map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  })) ?? [];

  const profileData: MyProfileStat[] = stats?.profiles ?? [];
  const stackData: MyStackStat[] = stats?.stacks ?? [];

  const handleApplyRange = () => loadData(from, to);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            to="/generate"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            + New Application
          </Link>
          <Link
            to="/history"
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            View History
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Today" value={stats.summary.today_count} sub="applications" color="text-blue-600 dark:text-blue-400" />
          <StatCard label="This Week" value={stats.summary.week_count} sub="last 7 days" color="text-indigo-600 dark:text-indigo-400" />
          <StatCard label="This Month" value={stats.summary.month_count} sub="last 30 days" color="text-purple-600 dark:text-purple-400" />
          <StatCard label="Month Cost" value={`$${stats.summary.month_cost.toFixed(4)}`} sub="last 30 days" color="text-green-600 dark:text-green-400" />
          <StatCard label="Calls Scheduled" value={stats.summary.calls_scheduled} sub="all time" color={stats.summary.calls_scheduled > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"} />
        </div>
      )}

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2 mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Range:</span>
        {(["7d", "30d", "90d", "custom"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              preset === p
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {p === "7d" ? "7 days" : p === "30d" ? "30 days" : p === "90d" ? "90 days" : "Custom"}
          </button>
        ))}
        {preset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
            />
          </>
        )}
        <button
          onClick={handleApplyRange}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      <div className="space-y-8">
        {/* Daily Applications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Applications</h2>
          {dailyData.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No applications in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Applications" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* By Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">By Profile</h2>
            {profileData.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profileData.map((p) => ({ name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name, count: p.count }))} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Applications" radius={[0, 3, 3, 0]}>
                    {profileData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By Tech Stack */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">By Tech Stack</h2>
            {stackData.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stackData.map((s) => ({ name: s.stack_name, value: s.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {stackData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Calls Scheduled */}
        {(() => {
          const callData = stats?.daily_calls?.map((d) => ({ date: d.date.slice(5), count: d.count })) ?? [];
          return callData.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Calls Scheduled</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={callData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Calls Scheduled" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null;
        })()}

        {/* Recent Applications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Recent Applications</h2>
            <Link to="/history" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Job Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      No applications yet.{" "}
                      <Link to="/generate" className="text-blue-600 dark:text-blue-400 hover:underline">Create one!</Link>
                    </td>
                  </tr>
                ) : (
                  recentApps.map((app) => (
                    <tr key={app.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        <Link to={`/preview/${app.id}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                          {app.job_title ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{app.company_name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {app.total_cost != null ? `$${app.total_cost.toFixed(4)}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
