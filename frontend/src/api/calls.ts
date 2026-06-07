import type { Call, CallCreate, CallUpdate } from "../types";
import api from "./client";

export const getCalls = (stage?: string) =>
  api.get<Call[]>(`/api/calls${stage ? `?stage=${stage}` : ""}`);

export const createCall = (data: CallCreate) =>
  api.post<Call>("/api/calls", data);

export const updateCall = (callId: string, data: CallUpdate) =>
  api.patch<Call>(`/api/calls/${callId}`, data);

export const deleteCall = (callId: string) =>
  api.delete(`/api/calls/${callId}`);
