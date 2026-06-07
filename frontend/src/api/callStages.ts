import type { CallStageConfig } from "../types";
import api from "./client";

export interface CallStageCreate {
  name: string;
}

export interface CallStageUpdate {
  name?: string;
  order?: number;
}

export interface CallStageReorder {
  ordered_ids: string[];
}

export const getCallStages = () => api.get<CallStageConfig[]>("/api/call-stages");
export const createCallStage = (data: CallStageCreate) =>
  api.post<CallStageConfig>("/api/call-stages", data);
export const updateCallStage = (id: string, data: CallStageUpdate) =>
  api.patch<CallStageConfig>(`/api/call-stages/${id}`, data);
export const deleteCallStage = (id: string) =>
  api.delete(`/api/call-stages/${id}`);
export const reorderCallStages = (data: CallStageReorder) =>
  api.post("/api/call-stages/reorder", data);
