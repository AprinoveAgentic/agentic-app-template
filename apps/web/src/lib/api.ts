// ── API client ────────────────────────────────────────────────────────────────
// Thin wrapper around fetch that adds the auth header and handles
// token refresh automatically.

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface ApiError {
  error: { code: string; message: string };
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { token?: string | undefined }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new ApiClientError(
      res.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? res.statusText
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export const auth = {
  register: (body: { email: string; password: string; name?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  refresh: (refreshToken: string) =>
    request<RefreshResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (token: string) =>
    request<void>("/auth/logout", { method: "POST", token }),

  me: (token: string) =>
    request<{ id: string; email: string; name: string | null }>("/auth/me", { token }),
};

// ── Generic helpers for generated feature endpoints ───────────────────────────

export function get<T>(path: string, token?: string) {
  return request<T>(path, { method: "GET", token });
}

export function post<T>(path: string, body: unknown, token?: string) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body), token });
}

export function put<T>(path: string, body: unknown, token?: string) {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body), token });
}

export function patch<T>(path: string, body: unknown, token?: string) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body), token });
}

export function del<T>(path: string, token?: string) {
  return request<T>(path, { method: "DELETE", token });
}
