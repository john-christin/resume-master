import api from "./client";
import type {
  BatchGenerateRequest,
  BatchGenerateResponse,
  GenerateRequest,
  GenerateResponse,
} from "../types";

export const generateApplication = (data: GenerateRequest) =>
  api.post<GenerateResponse>("/api/generate", data);

export const batchGenerate = (data: BatchGenerateRequest) =>
  api.post<BatchGenerateResponse>("/api/generate/batch", data);
