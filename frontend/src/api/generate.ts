import api from "./client";
import type {
  BatchGenerateRequest,
  BatchGenerateResponse,
  CompanyCheckResponse,
  GenerateRequest,
  GenerateResponse,
} from "../types";

export const generateApplication = (data: GenerateRequest) =>
  api.post<GenerateResponse>("/api/generate", data);

export const batchGenerate = (data: BatchGenerateRequest) =>
  api.post<BatchGenerateResponse>("/api/generate/batch", data);

export const checkCompanies = (profile_id: string, companies: string[]) =>
  api.post<CompanyCheckResponse>("/api/generate/check-companies", {
    profile_id,
    companies,
  });
