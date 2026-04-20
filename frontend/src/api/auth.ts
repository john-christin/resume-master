import api from "./client";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types";

export const register = (data: RegisterRequest) =>
  api.post<AuthResponse>("/api/auth/register", data);

export const login = (data: LoginRequest) =>
  api.post<AuthResponse>("/api/auth/login", data);

export const getMe = () => api.get<AuthResponse>("/api/auth/me");
