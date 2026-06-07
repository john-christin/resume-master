import api from "./client";
import type {
  BannedCompanyCheckResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  ClearanceCheckResponse,
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

export const checkClearance = (profile_id: string, job_description: string) =>
  api.post<ClearanceCheckResponse>("/api/generate/check-clearance", {
    profile_id,
    job_description,
  });

export const checkBannedCompanies = (companies: string[]) =>
  api.post<BannedCompanyCheckResponse>("/api/generate/check-banned-companies", {
    companies,
  });
