import type { BatchGenerateRequest, BatchJobStatus, BatchJobSubmitResponse } from "../types";
import api from "./client";

export const submitBatchJob = (data: BatchGenerateRequest) =>
  api.post<BatchJobSubmitResponse>("/api/batch-jobs", data);

export const getBatchJob = (jobId: string) =>
  api.get<BatchJobStatus>(`/api/batch-jobs/${jobId}`);

export const listBatchJobs = () =>
  api.get<BatchJobStatus[]>("/api/batch-jobs");
