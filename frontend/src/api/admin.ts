import api from "./client";
import type { AIModelConfig, KnowledgeBase, TokenPricing, UserListItem } from "../types";

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

// Knowledge Base
export const getKnowledgeBases = () =>
  api.get<KnowledgeBase[]>("/api/admin/knowledge-bases");

export const createKnowledgeBase = (name: string, content: string) =>
  api.post<KnowledgeBase>("/api/admin/knowledge-bases", { name, content });

export const updateKnowledgeBase = (
  id: string,
  data: { name?: string; content?: string; is_active?: boolean }
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
