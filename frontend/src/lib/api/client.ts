import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Single axios instance for the whole app. In development, requests go to the
 * relative `/api/v1` path and next.config.ts rewrites them to the FastAPI
 * server; set NEXT_PUBLIC_API_URL to point at a deployed backend instead.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Absolute origin of the FastAPI backend, for links that must resolve outside
 * the browser's same-origin proxy (the "API docs" link, the widget <script>
 * snippet). `API_BASE_URL` is deliberately relative in dev (`/api/v1`, proxied
 * by next.config.ts) so browser requests avoid CORS — that relative path
 * doesn't point anywhere on its own, so it can't be reused for these.
 */
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  (API_BASE_URL.startsWith("http")
    ? API_BASE_URL.replace(/\/api\/v1\/?$/, "")
    : "http://localhost:8000");

const ACCESS_KEY = "supportai_access_token";
const REFRESH_KEY = "supportai_refresh_token";
const USER_KEY = "supportai_user";

export const getAccessToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);

export const getRefreshToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);

export const setTokens = (accessToken: string, refreshToken: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
};

export const setStoredUser = (user: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredUser = <T,>(): T | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const clearTokens = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* Refresh-on-401, with a queue so concurrent failures trigger one refresh. */
let isRefreshing = false;
let queue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const flushQueue = (error: unknown, token: string | null = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken || original.url?.includes("/auth/")) {
      clearTokens();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject }))
        .then((token) => {
          if (original.headers) original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token: newRefresh } = response.data;
      setTokens(access_token, newRefresh);
      if (original.headers) original.headers.Authorization = `Bearer ${access_token}`;
      flushQueue(null, access_token);
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      clearTokens();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        // Reached from an interceptor with no router in scope, and a hard load
        // is what we want anyway — the session is gone.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login?expired=1";
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

/** Pulls a human-readable message out of a FastAPI error response. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first?.msg === "string") {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
        return field ? `${field}: ${first.msg}` : first.msg;
      }
    }
    if (typeof error.response?.data?.message === "string") {
      return error.response.data.message;
    }
    if (error.code === "ERR_NETWORK") {
      return "Can't reach the Support-AI API. Is the backend running?";
    }
    if (error.response?.status === 403) return "You don't have permission to do that.";
    if (error.response?.status === 404) return "Not found.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function apiErrorStatus(error: unknown): number | null {
  return axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
}
