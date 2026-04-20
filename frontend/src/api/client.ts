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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_username");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_status");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
