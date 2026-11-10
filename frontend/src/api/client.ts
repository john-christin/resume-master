import axios from "axios";

const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Wrong credentials also answer 401; that is not an expired session
const AUTH_FORM_PATHS = ["/api/auth/login", "/api/auth/register"];

api.interceptors.response.use(
  (response) => {
    // The server renews the token while the user is active (sliding session)
    const renewed = response.headers["x-access-token"];
    if (renewed) localStorage.setItem("access_token", renewed);
    return response;
  },
  (error) => {
    const url: string = error.config?.url ?? "";
    if (
      error.response?.status === 401 &&
      !AUTH_FORM_PATHS.some((p) => url.startsWith(p))
    ) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_username");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_status");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
