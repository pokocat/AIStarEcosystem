// P1-8 端到端：`/api/me` 回 401 → 去账号中心换令牌 → **换令牌这一步**自己失败时的处置。
//
// 修复前：换令牌不管因为什么失败都清令牌 + 回登录。于是账号中心一抖（502 / 断网 /
// 网关超时），所有正在使用的用户都被踢下线；回来 `/api/me` 可能还在挂，继续打转。
//
// 修复后按失败性质分流：
//   · 断网 / 5xx / 超时 → `AUTH_REFRESH_UNAVAILABLE`(503)，令牌保留、不通知登出回调；
//   · `invalid_grant` 之类的 OAuth 拒绝 → 照旧 401 + 清令牌 + 通知登出回调。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY } from "./token-store";

type Client = typeof import("./_client");

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

let store: ReturnType<typeof memoryStorage>;

/** 每个用例一份全新的模块实例（刷新单飞是模块级状态）。 */
async function loadClient(): Promise<Client> {
  vi.resetModules();
  const oidc = await import("./oidc");
  oidc.__resetOidcRuntimeForTests();
  return (await import("./_client")) as Client;
}

/** `/api/me` 恒回 401；`/oauth2/token` 由 tokenReply 决定。 */
function routeFetch(tokenReply: () => unknown) {
  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/oauth2/token")) return tokenReply();
    return Promise.resolve({
      status: 401,
      ok: false,
      text: async () => "",
      headers: { get: () => null },
    });
  });
}

beforeEach(() => {
  store = memoryStorage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    localStorage: store,
    sessionStorage: memoryStorage(),
    location: { origin: "https://drama.example.com", search: "", assign: vi.fn() },
  };
  // navigator.locks 不存在 → 走租约路径，本页无人竞争，立刻拿到。
  vi.stubGlobal("navigator", {});
  store.setItem(AUTH_TOKEN_KEY, "AT1");
  store.setItem(AUTH_REFRESH_TOKEN_KEY, "RT1");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe("401 之后刷新失败（暂时故障）", () => {
  it("网络断：抛 AUTH_REFRESH_UNAVAILABLE(503)，令牌保留、不触发登出回调", async () => {
    vi.stubGlobal("fetch", routeFetch(() => Promise.reject(new TypeError("Failed to fetch"))));
    const client = await loadClient();
    const onUnauthorized = vi.fn(() => true);
    client.registerUnauthorizedHandler(onUnauthorized);

    await expect(client.apiFetch("/me")).rejects.toMatchObject({
      code: "AUTH_REFRESH_UNAVAILABLE",
      status: 503,
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT1");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });

  it("账号中心 500：同样按可重试处理", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch(() =>
        Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "server_error" }) }),
      ),
    );
    const client = await loadClient();
    client.registerUnauthorizedHandler(() => true);

    await expect(client.apiFetch("/me")).rejects.toMatchObject({ code: "AUTH_REFRESH_UNAVAILABLE" });
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });
});

describe("401 之后刷新失败（确定失效）", () => {
  it("invalid_grant：照旧 401 + 清令牌 + 通知登出", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch(() =>
        Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
      ),
    );
    const client = await loadClient();
    const onUnauthorized = vi.fn(() => true);
    client.registerUnauthorizedHandler(onUnauthorized);

    await expect(client.apiFetch("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });
});
