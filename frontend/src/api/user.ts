import api from "./client";

export const getUserSettings = () => api.get("/api/user/settings");

export const updateUsername = (newUsername: string) =>
  api.put("/api/user/username", { new_username: newUsername });

export const resetPassword = (currentPassword: string, newPassword: string) =>
  api.put("/api/user/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
