import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, redirect to login unless already on auth page
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
        window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
