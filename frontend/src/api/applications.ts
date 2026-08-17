import api from "./client";
import type { ActiveModel, AppChatHistory, AppChatSendResponse, ApplicationDetail, PaginatedApplications } from "../types";

export const getApplications = (
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  sortBy: string = "created_at",
  sortDir: string = "desc",
  callStatus?: string,
  profileName?: string,
  username?: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  if (search) params.set("search", search);
  if (callStatus) params.set("call_status", callStatus);
  if (profileName) params.set("profile_name", profileName);
  if (username) params.set("username", username);
  return api.get<PaginatedApplications>(
    `/api/applications?${params.toString()}`
  );
};

export const getApplication = (appId: string) =>
  api.get<ApplicationDetail>(`/api/applications/${appId}`);

export const deleteApplication = (appId: string) =>
  api.delete(`/api/applications/${appId}`);

export const updateCallStatus = (appId: string, callScheduled: boolean) =>
  api.patch(`/api/applications/${appId}/call-status`, { call_scheduled: callScheduled });

export const getApplicationChat = (appId: string) =>
  api.get<AppChatHistory>(`/api/applications/${appId}/chat`);

export const sendApplicationChat = (appId: string, content: string, modelConfigId?: string) =>
  api.post<AppChatSendResponse>(`/api/applications/${appId}/chat`, {
    content,
    model_config_id: modelConfigId ?? null,
  });

export const getActiveModels = () =>
  api.get<ActiveModel[]>("/api/models/active");
