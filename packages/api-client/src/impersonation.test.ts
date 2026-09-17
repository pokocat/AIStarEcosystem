import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "./_client";
import { getAuthToken, getRefreshToken, clearAuthTokens, setAuthToken, setRefreshToken } from "./token-store";
import { exitImpersonation, expireImpersonation, getImpersonation, setImpersonation, IMPERSONATION_KEY } from "./impersonation-session";
import { refreshAccessToken } from "./oidc";
const TOKEN = "imp_" + "a".repeat(43);
function storage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
}
beforeEach(() => {
  vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage(), location: { replace: vi.fn(), pathname: "/dashboard" } });
  setAuthToken("original"); setRefreshToken("original-refresh");
  setImpersonation({ token: TOKEN, targetName: "目标用户", product: "drama", expiresAt: "2099-01-01T00:00:00Z" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("附身只覆盖当前标签页，不写原账号令牌", () => {
  expect(getAuthToken()).toBe(TOKEN);
  expect(window.localStorage.getItem("aistareco.auth.token")).toBe("original");
  expect(getRefreshToken()).toBeNull();
});
it("清理错误登录态不会误删原账号或切回原账号", () => {
  clearAuthTokens(); expect(getAuthToken()).toBe(TOKEN);
  expect(window.localStorage.getItem("aistareco.auth.token")).toBe("original");
});
it("不使用原账号刷新凭据", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await refreshAccessToken()).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
it("过期标记仍然覆盖原身份，不能悄悄回退", () => {
  window.sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ token: TOKEN, targetName: "目标用户", product: "drama", expiresAt: "2000-01-01T00:00:00Z" }));
  expect(getAuthToken()).toBe(TOKEN);
});
it("POST 等写请求按目标身份发出，不加只读拦截", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { saved: true } }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  expect(await apiFetch("/me/drama/projects", { method: "POST", body: { name: "测试" } })).toEqual({ saved: true });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
});
it("401 后不拿原用户令牌重试写操作", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 })); vi.stubGlobal("fetch", fetch);
  await expect(apiFetch("/me/drama/projects", { method: "POST" })).rejects.toMatchObject({ code: "IMPERSONATION_EXPIRED" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(window.location.replace).toHaveBeenCalledWith("/auth/callback/impersonation?expired=1");
  expect(getAuthToken()).toBe(TOKEN);
});
it("退出请求仅撤销当前附身，原登录态恢复", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetch);
  await exitImpersonation(); expect(getImpersonation()).toBeNull(); expect(getAuthToken()).toBe("original");
  expect(getRefreshToken()).toBe("original-refresh");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  expect(window.location.replace).toHaveBeenCalledWith("/");
});
it("退出失败保留附身标记，允许重试", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
  await expect(exitImpersonation()).rejects.toThrow("退出没有完成"); expect(getAuthToken()).toBe(TOKEN);
});

it("过期回调页不循环导航", () => {
  window.location.pathname = "/auth/callback/impersonation";
  expireImpersonation(); expect(window.location.replace).not.toHaveBeenCalled();
});
it("损坏的附身存储不回落到原用户", () => {
  window.sessionStorage.setItem(IMPERSONATION_KEY, "broken-json");
  expect(getAuthToken()).toBe("imp_invalid"); expect(getRefreshToken()).toBeNull();
});
it("附身期间普通登录写入不能覆盖原账号", () => {
  setAuthToken("different-login"); setRefreshToken("different-refresh");
  expect(window.localStorage.getItem("aistareco.auth.token")).toBe("original");
  expect(window.localStorage.getItem("aistareco.auth.refresh")).toBe("original-refresh");
});
it("不接受已经过期或不完整的登录响应", () => {
  expect(() => setImpersonation({ token: TOKEN, targetName: "用户", product: "drama", expiresAt: "2000-01-01T00:00:00Z" })).toThrow();
  expect(() => setImpersonation({ token: "bad", targetName: "用户", product: "drama", expiresAt: "2099-01-01T00:00:00Z" })).toThrow();
});
