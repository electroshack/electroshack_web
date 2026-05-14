import axios from "axios";

/** In CRA dev, prefer same-origin /api via package.json "proxy" so login always hits the dev server. */
function apiBaseURL() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === "development") return "/api";
  return "http://localhost:5000/api";
}

const API = axios.create({
  baseURL: apiBaseURL(),
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || "";
      if (!String(url).includes("auth/login")) {
        localStorage.removeItem("token");
        if (window.location.pathname.startsWith("/admin")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

export default API;