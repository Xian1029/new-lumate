import { afterEach, expect, it, vi } from "vitest";
import { login, changePassword } from "./account";

afterEach(() => { vi.unstubAllGlobals(); document.cookie = "csrf_token=; Max-Age=0"; });
it("classifies disabled-account responses from existing API images", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "账号已停用" }), { status: 403 })));
  await expect(login("test1", "password1")).rejects.toMatchObject({ status: 403, code: "account_disabled", message: "账号已停用" });
});
it("does not interpret unrelated 403 errors as a disabled account", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "CSRF token missing" }), { status: 403 })));
  await expect(login("test1", "password1")).rejects.toMatchObject({ status: 403, code: undefined });
});
it("includes the CSRF cookie when it follows another cookie", async () => {
  document.cookie = "other_cookie=present";
  document.cookie = "csrf_token=test-csrf";
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "user" })));
  vi.stubGlobal("fetch", fetchMock);
  await changePassword("old-password", "new-password");
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/change-password", expect.objectContaining({ headers: expect.objectContaining({ "X-CSRF-Token": "test-csrf" }) }));
  document.cookie = "other_cookie=; Max-Age=0";
});
