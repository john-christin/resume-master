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

  // Build stacked bar data for per-user daily chart
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

  const dailyCountData = daily.map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  }));

  const handleApplyRange = () => loadAll(from, to);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <Link
          to="/admin/settings"
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Settings →
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Today's Applications" value={overview.today_count} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Today's Cost" value={`$${overview.today_cost.toFixed(4)}`} color="text-green-600 dark:text-green-400" />
          <StatCard label="Active Users" value={overview.active_users} color="text-gray-900 dark:text-white" />
          <StatCard
            label="Pending Approvals"
            value={overview.pending_users}
            color={overview.pending_users > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}
            sub={overview.pending_users > 0 ? "→ Settings to review" : undefined}
          />
          <StatCard
            label="Calls Scheduled"
            value={overview.calls_scheduled}
            sub="all users · all time"
            color={overview.calls_scheduled > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"}
          />
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

      {/* Charts grid */}
      <div className="space-y-8">
        {/* Daily Applications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Applications</h2>
          {dailyCountData.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyCountData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Applications" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Per-User Daily */}
        {usernames.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Applications by User (Daily)</h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedUser(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedUser === null
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  All
                </button>
                {usernames.map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setSelectedUser(u === selectedUser ? null : u)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedUser === u
                        ? "text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                    style={selectedUser === u ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              {selectedUser ? (
                <BarChart data={singleUserChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {usernames.map((u, i) => (
                    <Bar key={u} dataKey={u} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === usernames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily Calls Scheduled */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Daily Calls Scheduled</h2>
            {callUsernames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCallUser(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCallUser === null
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  All
                </button>
                {callUsernames.map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setSelectedCallUser(u === selectedCallUser ? null : u)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCallUser === u ? "text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                    style={selectedCallUser === u ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(selectedCallUser ? singleCallUserChartData : callUsernames.length > 1 ? perUserCallChartData : dailyCallsChartData).length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No calls scheduled in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              {selectedCallUser ? (
                <BarChart data={singleCallUserChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name={selectedCallUser} fill={CHART_COLORS[callUsernames.indexOf(selectedCallUser) % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : callUsernames.length > 1 ? (
                <BarChart data={perUserCallChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Calls Scheduled" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Daily Cost */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Daily Cost ($)</h2>
            {dailyCostData.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyCostData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`$${v}`, "Cost"]} />
                  <Bar dataKey="cost" name="Cost ($)" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Profiles */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Top Profiles (by Applications)</h2>
            {profileChartData.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profileChartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
          </div>
        </div>

        {/* Per-User Cost Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">User Cost Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">User</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Today Apps</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Today Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">7d Apps</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">7d Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">30d Apps</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">30d Cost</th>
                </tr>
              </thead>
              <tbody>
                {userCosts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No users.</td>
                  </tr>
                ) : (
                  userCosts.map((u) => (
                    <tr key={u.user_id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.username}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{u.today_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">${u.today_cost.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{u.week_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">${u.week_cost.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{u.month_count}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">${u.month_cost.toFixed(4)}</td>
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
