import api from "./client";
import type { JobSheetCheck, JobSheetStatus } from "../types";

export const getJobSheetStatus = (profileId: string) =>
  api.get<JobSheetStatus>(`/api/profiles/${profileId}/job-sheet`);

export const testJobSheet = (profileId: string) =>
  api.post<JobSheetCheck>(`/api/profiles/${profileId}/job-sheet/test`);

export const retryJobSheet = (profileId: string) =>
  api.post<{ requeued: number }>(`/api/profiles/${profileId}/job-sheet/retry`);
