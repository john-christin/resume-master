export function saveAuth(
  token: string,
  userId: string,
  username: string,
  role: string,
  status: string
): void {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user_id", userId);
  localStorage.setItem("user_username", username);
  localStorage.setItem("user_role", role);
  localStorage.setItem("user_status", status);
}

export function clearAuth(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user_username");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_status");
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("access_token");
}

export function getUsername(): string {
  return localStorage.getItem("user_username") || "";
}

export function getUserRole(): string {
  return localStorage.getItem("user_role") || "bidder";
}

export function getUserStatus(): string {
  return localStorage.getItem("user_status") || "pending";
}
