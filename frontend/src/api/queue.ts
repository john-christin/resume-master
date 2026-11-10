import api from "./client";

export type QueueTaskStatus =
  | "queued"
  | "processing"
  | "needs_review"
  | "approved"
  | "completed"
  | "failed"
  | "skipped";

export interface QueueTask {
  id: string;
  user_id: string;
  username: string | null; // who queued it
  profile_id: string | null;
  profile_name: string | null;
  doc_style_id: string | null;
  job_source_url: string | null;
  job_url: string | null;
  company: string | null;
  job_title: string | null;
  status: QueueTaskStatus;
  warnings: string[];
  application_id: string | null;
  error: string | null;
  order: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  used_key_label: string | null;
}

export interface QueueStatus {
  queue_running: boolean;
  counts: Partial<Record<QueueTaskStatus, number>>; // my own queue, all time
  list_counts: Partial<Record<QueueTaskStatus, number>>; // same scope/dates as the list
  today_completed: number;
  today_cost: number;
  current_task: QueueTask | null;
}

export interface PaginatedTasks {
  items: QueueTask[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// FastAPI wants repeated keys (profile_id=a&profile_id=b), not axios's profile_id[]=a
const repeatParams = (params: Record<string, unknown>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else if (v !== undefined && v !== null) q.append(k, String(v));
  }
  return q.toString();
};

export interface QueueFilter {
  profile_id?: string[]; // empty = every profile I can see
  created_from?: string; // ISO instant, inclusive
  created_to?: string; // ISO instant, exclusive
}

export const getQueueStatus = (params?: QueueFilter) =>
  api.get<QueueStatus>("/api/queue/status", { params, paramsSerializer: repeatParams });

export const listTasks = (params?: {
  status?: string;
  profile_id?: string[];
  created_from?: string; // ISO instant, inclusive
  created_to?: string; // ISO instant, exclusive
  page?: number;
  page_size?: number;
}) =>
  api.get<PaginatedTasks>("/api/queue", { params, paramsSerializer: repeatParams });

export const enqueueTask = (data: {
  profile_id: string;
  job_url?: string;
  job_source_url?: string;
  company?: string;
  job_title?: string;
  job_description?: string;
  doc_style_id?: string;
}) => api.post<QueueTask>("/api/queue", data);

export const updateTask = (id: string, action: "approve" | "retry" | "skip") =>
  api.patch<QueueTask>(`/api/queue/${id}`, { action });

export const deleteTask = (id: string) =>
  api.delete(`/api/queue/${id}`);

export const startQueue = () =>
  api.post("/api/queue/start");

export const pauseQueue = () =>
  api.post("/api/queue/pause");
