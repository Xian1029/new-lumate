"use client";

export type CurrentUser = { id: string; username: string | null; name: string; role: string; must_change_password: boolean; can_create_courses: boolean; max_courses: number | null };

export class AccountError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "AccountError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const csrf = typeof document === "undefined" ? "" : (document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1] || "");
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> || {}) };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`/api/auth${path}`, { ...init, credentials: "include", headers });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const detail = typeof payload?.detail === "string" ? payload.detail : "请求失败，请稍后重试";
    // Recognize older API images too, so a rolling deployment keeps the same UX.
    const code = payload?.code || (res.status === 403 && detail === "账号已停用" ? "account_disabled" : undefined);
    throw new AccountError(detail, res.status, code);
  }
  return res.status === 204 ? undefined as T : res.json();
}
export const getMe = () => call<CurrentUser>("/me");
export const login = (username: string, password: string) => call<CurrentUser>("/login", { method: "POST", body: JSON.stringify({ username, password }) });
export const logout = () => call<void>("/logout", { method: "POST" });
export const changePassword = (current_password: string, new_password: string) => call<CurrentUser>("/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) });
