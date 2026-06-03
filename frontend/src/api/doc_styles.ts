import api from "./client";
import type { DocStyle, DocStyleCreate, DocStyleUpdate } from "../types";

export const getDocStyles = () => api.get<DocStyle[]>("/api/doc-styles");

export const createDocStyle = (data: DocStyleCreate) =>
  api.post<DocStyle>("/api/doc-styles", data);

export const updateDocStyle = (id: string, data: DocStyleUpdate) =>
  api.put<DocStyle>(`/api/doc-styles/${id}`, data);

export const deleteDocStyle = (id: string) =>
  api.delete(`/api/doc-styles/${id}`);
