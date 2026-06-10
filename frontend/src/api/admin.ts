import api from "./client";
import type { AIModelConfig, BannedCompany, KnowledgeBase, TechStack, TokenPricing, UserListItem } from "../types";

export const getUsers = (status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  return api.get<UserListItem[]>(`/api/admin/users${qs ? `?${qs}` : ""}`);
};

export const approveUser = (userId: string, role: string) =>
  api.post(`/api/admin/users/${userId}/approve`, { role });

export const rejectUser = (userId: string) =>
  api.post(`/api/admin/users/${userId}/reject`);

export const suspendUser = (userId: string) =>
  api.post(`/api/admin/users/${userId}/suspend`);

export const unsuspendUser = (userId: string) =>
  api.post(`/api/admin/users/${userId}/unsuspend`);

export const deleteUser = (userId: string) =>
  api.delete(`/api/admin/users/${userId}`);

export const updateUserRole = (userId: string, role: string) =>
  api.patch(`/api/admin/users/${userId}/role`, { role });

export interface SystemLogItem {
  id: string;
  level: string;
  category: string;
  user_id: string | null;
  ip_address: string | null;
  endpoint: string | null;
  message: string;
  details: string | null;
  error_type: string | null;
  stack_trace: string | null;
  duration_ms: number | null;
  created_at: string;
}

export const getLogs = (params: {
  level?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) => {
  const p = new URLSearchParams();
  if (params.level) p.set("level", params.level);
  if (params.category) p.set("category", params.category);
  if (params.from_date) p.set("from_date", params.from_date);
  if (params.to_date) p.set("to_date", params.to_date);
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.offset != null) p.set("offset", String(params.offset));
  const qs = p.toString();
  return api.get<SystemLogItem[]>(`/api/admin/logs${qs ? `?${qs}` : ""}`);
};

export const getLogCount = (params: {
  level?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
}) => {
  const p = new URLSearchParams();
  if (params.level) p.set("level", params.level);
  if (params.category) p.set("category", params.category);
  if (params.from_date) p.set("from_date", params.from_date);
  if (params.to_date) p.set("to_date", params.to_date);
  const qs = p.toString();
  return api.get<{ count: number }>(`/api/admin/logs/count${qs ? `?${qs}` : ""}`);
};

export interface DashboardStats {
  total_users: number;
  pending_users: number;
  total_applications: number;
  total_cost: number;
  users: UserStatItem[];
}

export interface ProfileStat {
  profile_id: string;
  name: string;
  application_count: number;
  total_cost: number;
}

export interface UserStatItem {
  id: string;
  username: string;
  role: string;
  profile_count: number;
  application_count: number;
  total_cost: number;
  profiles: ProfileStat[];
}

export const getDashboardStats = (fromDate?: string, toDate?: string) => {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const qs = params.toString();
  return api.get<DashboardStats>(`/api/admin/stats${qs ? `?${qs}` : ""}`);
};

export const getUserStats = (userId: string) =>
  api.get(`/api/admin/stats/user/${userId}`);

export const getPricing = () => api.get<TokenPricing | null>("/api/admin/pricing");

export const setPricing = (inputPrice: number, outputPrice: number) =>
  api.post<TokenPricing>("/api/admin/pricing", {
    input_price_per_1k: inputPrice,
    output_price_per_1k: outputPrice,
  });

export const recalculateCosts = () =>
  api.post<{ detail: string }>("/api/admin/pricing/recalculate");

// Tech Stacks
export const getTechStacks = () =>
  api.get<TechStack[]>("/api/admin/tech-stacks");

export const createTechStack = (name: string, description?: string) =>
  api.post<TechStack>("/api/admin/tech-stacks", { name, description });

export const updateTechStack = (
  id: string,
  data: { name?: string; description?: string; is_active?: boolean }
) => api.put<TechStack>(`/api/admin/tech-stacks/${id}`, data);

export const deleteTechStack = (id: string) =>
  api.delete(`/api/admin/tech-stacks/${id}`);

// Knowledge Base
export const getKnowledgeBases = () =>
  api.get<KnowledgeBase[]>("/api/admin/knowledge-bases");

export const createKnowledgeBase = (name: string, content: string, tech_stack_id?: string | null) =>
  api.post<KnowledgeBase>("/api/admin/knowledge-bases", { name, content, tech_stack_id: tech_stack_id ?? null });

export const updateKnowledgeBase = (
  id: string,
  data: { name?: string; content?: string; is_active?: boolean; tech_stack_id?: string | null }
) => api.put<KnowledgeBase>(`/api/admin/knowledge-bases/${id}`, data);

export const deleteKnowledgeBase = (id: string) =>
  api.delete(`/api/admin/knowledge-bases/${id}`);

// AI Model Config
export const getModels = () =>
  api.get<AIModelConfig[]>("/api/admin/models");

export const testModel = (data: {
  provider: string;
  display_name: string;
  model_id: string;
  api_key: string;
  endpoint?: string;
  api_version?: string;
  input_price_per_1k?: number;
  output_price_per_1k?: number;
}) => api.post<{ success: boolean; reply: string }>("/api/admin/models/test", data);

export const createModel = (data: {
  provider: string;
  display_name: string;
  model_id: string;
  api_key: string;
  endpoint?: string;
  api_version?: string;
  input_price_per_1k?: number;
  output_price_per_1k?: number;
}) => api.post<AIModelConfig>("/api/admin/models", data);

export const updateModel = (
  id: string,
  data: {
    display_name?: string;
    model_id?: string;
    api_key?: string;
    endpoint?: string;
    api_version?: string;
    input_price_per_1k?: number;
    output_price_per_1k?: number;
  }
) => api.put<AIModelConfig>(`/api/admin/models/${id}`, data);

export const deleteModel = (id: string) =>
  api.delete(`/api/admin/models/${id}`);

export const activateModel = (id: string, role: string = "primary") =>
  api.post<AIModelConfig>(`/api/admin/models/${id}/activate`, { role });

export const deactivateModel = (id: string) =>
  api.post<AIModelConfig>(`/api/admin/models/${id}/deactivate`);

// Dashboard stat types
export interface AdminOverview {
  today_count: number;
  today_cost: number;
  active_users: number;
  pending_users: number;
  calls_scheduled: number;
}


export interface DailyStatPoint {
  date: string;
  count: number;
  cost: number;
}

export interface UserDailyPoint {
  date: string;
  user_id: string;
  username: string;
  count: number;
  cost: number;
}

export interface ProfileStatPoint {
  profile_id: string;
  name: string;
  username: string;
  count: number;
  cost: number;
}

export interface UserCostStat {
  user_id: string;
  username: string;
  today_count: number;
  today_cost: number;
  week_count: number;
  week_cost: number;
  month_count: number;
  month_cost: number;
}

const _buildDateParams = (from?: string, to?: string, userId?: string) => {
  const p = new URLSearchParams();
  if (from) p.set("from_date", from);
  if (to) p.set("to_date", to);
  if (userId) p.set("user_id", userId);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
};

export const getAdminOverview = () =>
  api.get<AdminOverview>("/api/admin/stats/overview");

export const getAdminDailyStats = (from?: string, to?: string, userId?: string) =>
  api.get<DailyStatPoint[]>(`/api/admin/stats/daily${_buildDateParams(from, to, userId)}`);

export const getAdminPerUserDaily = (from?: string, to?: string) =>
  api.get<UserDailyPoint[]>(`/api/admin/stats/per-user-daily${_buildDateParams(from, to)}`);

export const getAdminPerProfile = (from?: string, to?: string) =>
  api.get<ProfileStatPoint[]>(`/api/admin/stats/per-profile${_buildDateParams(from, to)}`);

export const getAdminUserCosts = () =>
  api.get<UserCostStat[]>("/api/admin/stats/user-costs");

export const getAdminDailyCallStats = (from?: string, to?: string) =>
  api.get<DailyStatPoint[]>(`/api/admin/stats/daily-calls${_buildDateParams(from, to)}`);

export const getAdminPerUserDailyCallStats = (from?: string, to?: string) =>
  api.get<UserDailyPoint[]>(`/api/admin/stats/per-user-daily-calls${_buildDateParams(from, to)}`);

// ── Banned Companies ──────────────────────────────────────────────────────────

export const getBannedCompanies = () =>
  api.get<BannedCompany[]>("/api/admin/banned-companies");

export const createBannedCompany = (name: string, description?: string) =>
  api.post<BannedCompany>("/api/admin/banned-companies", { name, description });

export const updateBannedCompany = (id: string, data: { name?: string; description?: string }) =>
  api.put<BannedCompany>(`/api/admin/banned-companies/${id}`, data);

export const deleteBannedCompany = (id: string) =>
  api.delete(`/api/admin/banned-companies/${id}`);

// ── System Settings ───────────────────────────────────────────────────────────

export interface SystemSetting {
  key: string;
  value: string | null;
}

export const getSystemSettings = () =>
  api.get<SystemSetting[]>("/api/admin/settings");

export const updateSystemSetting = (key: string, value: string | null) =>
  api.put<SystemSetting>(`/api/admin/settings/${key}`, { value });
