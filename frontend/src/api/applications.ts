import api from "./client";
import type { ApplicationDetail, PaginatedApplications } from "../types";

export const getApplications = (
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  sortBy: string = "created_at",
  sortDir: string = "desc"
) => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  if (search) params.set("search", search);
  return api.get<PaginatedApplications>(
    `/api/applications?${params.toString()}`
  );
};

export const getApplication = (appId: string) =>
  api.get<ApplicationDetail>(`/api/applications/${appId}`);

export const deleteApplication = (appId: string) =>
  api.delete(`/api/applications/${appId}`);
