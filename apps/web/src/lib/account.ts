"use client";

export type CurrentUser = { id: string; username: string | null; name: string; role: string; must_change_password: boolean };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const csrf = typeof document === "undefined" ? "" : (document.cookie.match(/(?:^|;\\s*)csrf_token=([^;]*)/)?.[1] || "");
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> || {}) };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`/api/auth${path}`, { ...init, credentials: "include", headers });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.json().catch(() => null))?.detail || "请求失败"}`);
  return res.status === 204 ? undefined as T : res.json();
}
export const getMe = () => call<CurrentUser>("/me");
export const login = (username: string, password: string) => call<CurrentUser>("/login", { method: "POST", body: JSON.stringify({ username, password }) });
export const register = (username: string, password: string, name?: string) => call<CurrentUser>("/register", { method: "POST", body: JSON.stringify({ username, password, name }) });
export const logout = () => call<void>("/logout", { method: "POST" });
export const changePassword = (current_password: string, new_password: string) => call<CurrentUser>("/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) });
