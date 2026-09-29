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
  counts: Partial<Record<QueueTaskStatus, number>>;
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

export const getQueueStatus = () =>
  api.get<QueueStatus>("/api/queue/status");

export const listTasks = (params?: { status?: string; date?: string; page?: number }) =>
  api.get<PaginatedTasks>("/api/queue", { params });

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
