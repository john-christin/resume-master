import api from "./client";
import type {
  Profile,
  ProfileCreate,
  ProfileShareUser,
  UserSearchResult,
} from "../types";

export const getProfiles = (accessibleOnly = false) =>
  api.get<Profile[]>(`/api/profiles${accessibleOnly ? "?accessible_only=true" : ""}`);

export const getProfile = (id: string) =>
  api.get<Profile>(`/api/profiles/${id}`);

export const createProfile = (data: ProfileCreate) =>
  api.post<Profile>("/api/profiles", data);

export const updateProfile = (id: string, data: ProfileCreate) =>
  api.put<Profile>(`/api/profiles/${id}`, data);

export const deleteProfile = (id: string) =>
  api.delete(`/api/profiles/${id}`);

export const shareProfile = (profileId: string, userIds: string[]) =>
  api.post(`/api/profiles/${profileId}/share`, { user_ids: userIds });

export const unshareProfile = (profileId: string, userId: string) =>
  api.delete(`/api/profiles/${profileId}/share/${userId}`);

export const getProfileShares = (profileId: string) =>
  api.get<ProfileShareUser[]>(`/api/profiles/${profileId}/shares`);

export const searchUsers = (q: string) =>
  api.get<UserSearchResult[]>(`/api/users/search?q=${encodeURIComponent(q)}`);
