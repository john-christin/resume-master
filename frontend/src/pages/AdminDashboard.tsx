import axios from "axios";
import { useEffect, useState } from "react";
import {
  activateModel,
  approveUser,
  createKnowledgeBase,
  createModel,
  deactivateModel,
  testModel,
  deleteKnowledgeBase,
  deleteModel,
  getDashboardStats,
  getKnowledgeBases,
  getModels,
  getPricing,
  getUsers,
  recalculateCosts,
  rejectUser,
  setPricing,
  updateKnowledgeBase,
  updateModel,
} from "../api/admin";
import type { DashboardStats } from "../api/admin";
import LoadingSpinner from "../components/LoadingSpinner";
import type { AIModelConfig, KnowledgeBase, TokenPricing, UserListItem } from "../types";

type Tab = "pending" | "stats" | "pricing" | "kb" | "models";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("stats");
  const [pendingUsers, setPendingUsers] = useState<UserListItem[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pricing, setPricingState] = useState<TokenPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range — default to today
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  // Pricing form
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [pricingSaving, setPricingSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);

  // Pending user approval
  const [roleSelections, setRoleSelections] = useState<
    Record<string, string>
  >({});

  // Knowledge Base
  const [kbList, setKbList] = useState<KnowledgeBase[]>([]);
  const [kbName, setKbName] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbSaving, setKbSaving] = useState(false);
  const [editingKbId, setEditingKbId] = useState<string | null>(null);

  // AI Models
  const [modelList, setModelList] = useState<AIModelConfig[]>([]);
  const [modelProvider, setModelProvider] = useState("openai");
  const [modelDisplayName, setModelDisplayName] = useState("");
  const [modelModelId, setModelModelId] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");
  const [modelEndpoint, setModelEndpoint] = useState("");
  const [modelApiVersion, setModelApiVersion] = useState("");
  const [modelInputPrice, setModelInputPrice] = useState("");
  const [modelOutputPrice, setModelOutputPrice] = useState("");
  const [modelSaving, setModelSaving] = useState(false);
  const [modelTesting, setModelTesting] = useState(false);
  const [modelTestError, setModelTestError] = useState<string | null>(null);
  const [modelTestSuccess, setModelTestSuccess] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  // Expanded user rows
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, statsRes, pricingRes, kbRes, modelsRes] = await Promise.all([
        getUsers("pending"),
        getDashboardStats(fromDate || undefined, toDate || undefined),
        getPricing(),
        getKnowledgeBases(),
        getModels(),
      ]);
      setPendingUsers(pendingRes.data);
      setStats(statsRes.data);
      setPricingState(pricingRes.data);
      setKbList(kbRes.data);
      setModelList(modelsRes.data);
      if (pricingRes.data) {
        setInputPrice(String(pricingRes.data.input_price_per_1k));
        setOutputPrice(String(pricingRes.data.output_price_per_1k));
      }
    } catch {
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDateFilter = () => {
    loadData();
  };

  const handleClearDateFilter = () => {
    setFromDate("");
    setToDate("");
    // Reload with no filters after state update
    setTimeout(() => loadData(), 0);
  };

  const handleApprove = async (userId: string) => {
    const role = roleSelections[userId] || "bidder";
    try {
      await approveUser(userId, role);
      await loadData();
    } catch {
      setError("Failed to approve user");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await rejectUser(userId);
      await loadData();
    } catch {
      setError("Failed to reject user");
    }
  };

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    try {
      const res = await setPricing(
        parseFloat(inputPrice),
        parseFloat(outputPrice)
      );
      setPricingState(res.data);
      setError(null);
    } catch {
      setError("Failed to update pricing");
    } finally {
      setPricingSaving(false);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (loading) return <LoadingSpinner message="Loading admin dashboard..." />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Admin Dashboard
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_users}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending Approval</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pending_users}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Applications{(fromDate || toDate) ? " (filtered)" : ""}
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.total_applications}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Cost{(fromDate || toDate) ? " (filtered)" : ""}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${stats.total_cost.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex space-x-6">
          {(
            [
              ["stats", "Usage & Cost"],
              ["pending", `Pending (${pendingUsers.length})`],
              ["pricing", "Token Pricing"],
              ["kb", "Knowledge Base"],
              ["models", "AI Models"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Usage & Cost tab */}
      {tab === "stats" && stats && (
        <div>
          {/* Date range filter */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              onClick={handleDateFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Apply
            </button>
            {(fromDate || toDate) && (
              <button
                onClick={handleClearDateFilter}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Per-user table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    User
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Role
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Profiles
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Applications
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.users.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => toggleExpand(user.id)}
                    >
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                        {user.profiles.length > 0 && (
                          <span className="text-xs">
                            {expandedUsers.has(user.id) ? "\u25BC" : "\u25B6"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        {user.username}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                              : user.role === "caller"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {user.profile_count}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {user.application_count}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium">
                        ${user.total_cost.toFixed(4)}
                      </td>
                    </tr>
                    {expandedUsers.has(user.id) &&
                      user.profiles.map((p) => (
                        <tr
                          key={`${user.id}-${p.profile_id}`}
                          className="bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700"
                        >
                          <td className="px-4 py-2"></td>
                          <td
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs pl-8"
                            colSpan={2}
                          >
                            {p.name}
                          </td>
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-xs">
                            {p.application_count}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400 text-xs">
                            ${p.total_cost.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                  </>
                ))}
                {stats.users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400 dark:text-gray-500"
                    >
                      No approved users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending tab */}
      {tab === "pending" && (
        <div>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center">
              No pending users.
            </p>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      User ID
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Registered
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Assign Role
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{user.username}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={roleSelections[user.id] || "bidder"}
                          onChange={(e) =>
                            setRoleSelections((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
                        >
                          <option value="bidder">Bidder</option>
                          <option value="caller">Caller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Token Pricing tab */}
      {tab === "pricing" && (
        <div className="max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Token Pricing Configuration
            </h2>

            {pricing && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Current: ${pricing.input_price_per_1k}/1K input, $
                  {pricing.output_price_per_1k}/1K output
                </p>
                <p>
                  Effective from:{" "}
                  {new Date(pricing.effective_from).toLocaleString()}
                </p>
              </div>
            )}

            <form onSubmit={handlePricingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Input Price per 1K Tokens ($)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Output Price per 1K Tokens ($)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={pricingSaving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {pricingSaving ? "Saving..." : "Update Pricing"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recalculate Existing Costs
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Recompute total_cost for all existing applications using the current pricing.
              </p>
              {recalcMsg && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded text-sm">
                  {recalcMsg}
                </div>
              )}
              <button
                onClick={async () => {
                  setRecalculating(true);
                  setRecalcMsg(null);
                  try {
                    const res = await recalculateCosts();
                    setRecalcMsg(res.data.detail);
                    await loadData();
                  } catch {
                    setError("Failed to recalculate costs");
                  } finally {
                    setRecalculating(false);
                  }
                }}
                disabled={recalculating}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                {recalculating ? "Recalculating..." : "Recalculate All Costs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base tab */}
      {tab === "kb" && (
        <div>
          {/* Create / Edit form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {editingKbId ? "Edit Knowledge Base" : "Create Knowledge Base"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setKbSaving(true);
                try {
                  if (editingKbId) {
                    await updateKnowledgeBase(editingKbId, {
                      name: kbName,
                      content: kbContent,
                    });
                  } else {
                    await createKnowledgeBase(kbName, kbContent);
                  }
                  setKbName("");
                  setKbContent("");
                  setEditingKbId(null);
                  setError(null);
                  const res = await getKnowledgeBases();
                  setKbList(res.data);
                } catch {
                  setError(
                    editingKbId
                      ? "Failed to update knowledge base"
                      : "Failed to create knowledge base"
                  );
                } finally {
                  setKbSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={kbName}
                  onChange={(e) => setKbName(e.target.value)}
                  placeholder="e.g. Resume Bullet Guidelines"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content
                </label>
                <textarea
                  value={kbContent}
                  onChange={(e) => setKbContent(e.target.value)}
                  rows={10}
                  placeholder="Enter knowledge base rules and guidelines..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white font-mono"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={kbSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {kbSaving
                    ? "Saving..."
                    : editingKbId
                      ? "Update"
                      : "Create"}
                </button>
                {editingKbId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKbId(null);
                      setKbName("");
                      setKbContent("");
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* KB list */}
          {kbList.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center">
              No knowledge bases yet. Create one above.
            </p>
          ) : (
            <div className="space-y-4">
              {kbList.map((kb) => (
                <div
                  key={kb.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-5 ${
                    kb.is_active
                      ? "border-green-300 dark:border-green-700"
                      : "border-gray-200 dark:border-gray-700 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                        {kb.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Created{" "}
                        {new Date(kb.created_at).toLocaleDateString()}
                        {kb.updated_at &&
                          ` · Updated ${new Date(kb.updated_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          kb.is_active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {kb.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 rounded p-3 max-h-48 overflow-y-auto mb-3 font-mono">
                    {kb.content}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingKbId(kb.id);
                        setKbName(kb.name);
                        setKbContent(kb.content);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updateKnowledgeBase(kb.id, {
                            is_active: !kb.is_active,
                          });
                          const res = await getKnowledgeBases();
                          setKbList(res.data);
                        } catch {
                          setError("Failed to toggle knowledge base");
                        }
                      }}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        kb.is_active
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                      }`}
                    >
                      {kb.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete knowledge base "${kb.name}"?`
                          )
                        )
                          return;
                        try {
                          await deleteKnowledgeBase(kb.id);
                          const res = await getKnowledgeBases();
                          setKbList(res.data);
                        } catch {
                          setError("Failed to delete knowledge base");
                        }
                      }}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* AI Models tab */}
      {tab === "models" && (
        <div>
          {/* Active model indicators */}
          {(() => {
            const primary = modelList.find((m) => m.is_active && m.role === "primary");
            const utility = modelList.find((m) => m.is_active && m.role === "utility");
            return (
              <div className="mb-6 space-y-2">
                {primary ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">
                      <span className="font-semibold">Primary Model</span> (resume, summary, skills, cover letter):{" "}
                      {primary.display_name}
                      <span className="ml-2 text-green-600 dark:text-green-400 text-xs">
                        ({primary.provider} / {primary.model_id})
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      No primary model configured. Using environment variable fallback.
                    </p>
                  </div>
                )}
                {utility ? (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <span className="font-semibold">Utility Model</span> (company extraction, location, duplicate check):{" "}
                      {utility.display_name}
                      <span className="ml-2 text-blue-600 dark:text-blue-400 text-xs">
                        ({utility.provider} / {utility.model_id})
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No utility model configured. Extraction tasks will use the primary model.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Create / Edit form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              {editingModelId ? "Edit Model" : "Add Model"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModelTestError(null);
                setModelTestSuccess(false);

                // For new models, require API key; for edits, use existing if blank
                const apiKeyForTest = modelApiKey || "";
                if (!editingModelId && !apiKeyForTest) return;

                // Step 1: Test connection
                setModelTesting(true);
                const testPayload = {
                  provider: modelProvider,
                  display_name: modelDisplayName,
                  model_id: modelModelId,
                  api_key: apiKeyForTest,
                  endpoint: modelEndpoint || undefined,
                  api_version: modelApiVersion || undefined,
                };

                // For edits without new API key, skip test
                const shouldTest = !editingModelId || !!modelApiKey;
                if (shouldTest) {
                  try {
                    await testModel(testPayload);
                  } catch (err) {
                    let msg = "Connection test failed";
                    if (axios.isAxiosError(err) && err.response?.data?.detail) {
                      msg = String(err.response.data.detail);
                    }
                    setModelTestError(msg);
                    setModelTesting(false);
                    return;
                  }
                }
                setModelTesting(false);

                // Step 2: Save
                setModelSaving(true);
                try {
                  if (editingModelId) {
                    await updateModel(editingModelId, {
                      display_name: modelDisplayName,
                      model_id: modelModelId,
                      ...(modelApiKey ? { api_key: modelApiKey } : {}),
                      endpoint: modelEndpoint || undefined,
                      api_version: modelApiVersion || undefined,
                      input_price_per_1k: parseFloat(modelInputPrice) || 0,
                      output_price_per_1k: parseFloat(modelOutputPrice) || 0,
                    });
                  } else {
                    await createModel({
                      provider: modelProvider,
                      display_name: modelDisplayName,
                      model_id: modelModelId,
                      api_key: modelApiKey,
                      endpoint: modelEndpoint || undefined,
                      api_version: modelApiVersion || undefined,
                      input_price_per_1k: parseFloat(modelInputPrice) || 0,
                      output_price_per_1k: parseFloat(modelOutputPrice) || 0,
                    });
                  }
                  setModelProvider("openai");
                  setModelDisplayName("");
                  setModelModelId("");
                  setModelApiKey("");
                  setModelEndpoint("");
                  setModelApiVersion("");
                  setModelInputPrice("");
                  setModelOutputPrice("");
                  setEditingModelId(null);
                  setError(null);
                  const res = await getModels();
                  setModelList(res.data);
                } catch {
                  setError(
                    editingModelId
                      ? "Failed to update model"
                      : "Failed to create model"
                  );
                } finally {
                  setModelSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Provider
                  </label>
                  <select
                    value={modelProvider}
                    onChange={(e) => setModelProvider(e.target.value)}
                    disabled={!!editingModelId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white disabled:opacity-60"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={modelDisplayName}
                    onChange={(e) => setModelDisplayName(e.target.value)}
                    placeholder="e.g. GPT-4o, Claude Sonnet 4"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={modelModelId}
                    onChange={(e) => setModelModelId(e.target.value)}
                    placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key{editingModelId && " (leave blank to keep)"}
                  </label>
                  <input
                    type="password"
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    placeholder={editingModelId ? "********" : "sk-..."}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                    required={!editingModelId}
                  />
                </div>
              </div>
              <div className={modelProvider === "azure_openai" ? "grid grid-cols-2 gap-4" : ""}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Endpoint
                    {modelProvider !== "azure_openai" && (
                      <span className="text-gray-400 dark:text-gray-500 font-normal"> (optional)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={modelEndpoint}
                    onChange={(e) => setModelEndpoint(e.target.value)}
                    placeholder={
                      modelProvider === "azure_openai"
                        ? "https://your-resource.openai.azure.com"
                        : modelProvider === "anthropic"
                          ? "https://your-resource.services.ai.azure.com/anthropic/v1"
                          : modelProvider === "google"
                            ? "https://your-resource.services.ai.azure.com"
                            : "https://api.openai.com/v1"
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                {modelProvider === "azure_openai" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Version
                    </label>
                    <input
                      type="text"
                      value={modelApiVersion}
                      onChange={(e) => setModelApiVersion(e.target.value)}
                      placeholder="2024-10-21"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
                </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Input Price per 1K Tokens ($)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={modelInputPrice}
                    onChange={(e) => setModelInputPrice(e.target.value)}
                    placeholder="0.003"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Output Price per 1K Tokens ($)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={modelOutputPrice}
                    onChange={(e) => setModelOutputPrice(e.target.value)}
                    placeholder="0.015"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              {/* Connection test result */}
              {modelTestError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">
                        Connection Failed
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1 break-all">
                        {modelTestError}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                        Please check your API key, endpoint, and model ID.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {modelTestSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Connection successful! Model is reachable.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={modelSaving || modelTesting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {modelSaving ? "Saving..." : editingModelId ? "Update" : "Add Model"}
                </button>
                <button
                  type="button"
                  disabled={modelTesting || modelSaving || (!modelApiKey && !editingModelId)}
                  onClick={async () => {
                    setModelTestError(null);
                    setModelTestSuccess(false);
                    setModelTesting(true);
                    try {
                      await testModel({
                        provider: modelProvider,
                        display_name: modelDisplayName || "test",
                        model_id: modelModelId,
                        api_key: modelApiKey,
                        endpoint: modelEndpoint || undefined,
                        api_version: modelApiVersion || undefined,
                      });
                      setModelTestSuccess(true);
                    } catch (err) {
                      let msg = "Connection test failed";
                      if (axios.isAxiosError(err) && err.response?.data?.detail) {
                        msg = String(err.response.data.detail);
                      }
                      setModelTestError(msg);
                    } finally {
                      setModelTesting(false);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  {modelTesting ? "Testing..." : "Test Connection"}
                </button>
                {editingModelId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingModelId(null);
                      setModelProvider("openai");
                      setModelDisplayName("");
                      setModelModelId("");
                      setModelApiKey("");
                      setModelEndpoint("");
                      setModelApiVersion("");
                      setModelInputPrice("");
                      setModelOutputPrice("");
                      setModelTestError(null);
                      setModelTestSuccess(false);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Model list */}
          {modelList.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center">
              No AI models configured. Add one above.
            </p>
          ) : (
            <div className="space-y-3">
              {modelList.map((m) => (
                <div
                  key={m.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4 flex items-center justify-between ${
                    m.is_active
                      ? "border-green-300 dark:border-green-700 ring-1 ring-green-200 dark:ring-green-800"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        m.role === "primary"
                          ? "bg-green-500"
                          : m.role === "utility"
                            ? "bg-blue-500"
                            : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {m.display_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            m.provider === "openai"
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                              : m.provider === "azure_openai"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                : m.provider === "anthropic"
                                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                          }`}
                        >
                          {m.provider === "azure_openai"
                            ? "Azure OpenAI"
                            : m.provider === "openai"
                              ? "OpenAI"
                              : m.provider === "anthropic"
                                ? "Anthropic"
                                : "Google"}
                        </span>
                        {m.role === "primary" && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Primary
                          </span>
                        )}
                        {m.role === "utility" && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Utility
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Model: {m.model_id}
                        {m.endpoint && ` · ${m.endpoint}`}
                        {(m.input_price_per_1k > 0 || m.output_price_per_1k > 0) &&
                          ` · $${m.input_price_per_1k}/1K in, $${m.output_price_per_1k}/1K out`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {m.role !== "primary" && (
                      <button
                        onClick={async () => {
                          try {
                            await activateModel(m.id, "primary");
                            const res = await getModels();
                            setModelList(res.data);
                          } catch {
                            setError("Failed to set as primary");
                          }
                        }}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50"
                      >
                        Set Primary
                      </button>
                    )}
                    {m.role !== "utility" && (
                      <button
                        onClick={async () => {
                          try {
                            await activateModel(m.id, "utility");
                            const res = await getModels();
                            setModelList(res.data);
                          } catch {
                            setError("Failed to set as utility");
                          }
                        }}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        Set Utility
                      </button>
                    )}
                    {m.is_active && (
                      <button
                        onClick={async () => {
                          try {
                            await deactivateModel(m.id);
                            const res = await getModels();
                            setModelList(res.data);
                          } catch {
                            setError("Failed to deactivate model");
                          }
                        }}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingModelId(m.id);
                        setModelProvider(m.provider);
                        setModelDisplayName(m.display_name);
                        setModelModelId(m.model_id);
                        setModelApiKey("");
                        setModelEndpoint(m.endpoint || "");
                        setModelApiVersion(m.api_version || "");
                        setModelInputPrice(String(m.input_price_per_1k || ""));
                        setModelOutputPrice(String(m.output_price_per_1k || ""));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    >
                      Edit
                    </button>
                    {!m.is_active && (
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete model "${m.display_name}"?`
                            )
                          )
                            return;
                          try {
                            await deleteModel(m.id);
                            const res = await getModels();
                            setModelList(res.data);
                          } catch {
                            setError("Failed to delete model");
                          }
                        }}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
