import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  AUTH_CALLBACK_PATH,
  OIDC_PENDING_KEY,
  __resetOidcRuntimeForTests,
  base64UrlEncode,
  buildAuthorizeUrl,
  classifyTokenFailure,
  completeAuthCallback,
  computeCodeChallenge,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
  sanitizeReturnPath,
} from "./oidc";
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY } from "./token-store";

// ── 最小浏览器 shim（只装被测代码真正会碰的三样东西） ────────────────────────
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

let localStorageShim: ReturnType<typeof memoryStorage>;
let sessionStorageShim: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  __resetOidcRuntimeForTests();
  localStorageShim = memoryStorage();
  sessionStorageShim = memoryStorage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    localStorage: localStorageShim,
    sessionStorage: sessionStorageShim,
    location: { origin: "https://drama.example.com", search: "", assign: vi.fn() },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe("PKCE 基元", () => {
  it("S256 challenge 与 RFC 7636 附录 B 的官方向量一致", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    await expect(computeCodeChallenge(verifier)).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("base64url 无 padding、不含 + /", () => {
    const encoded = base64UrlEncode(new Uint8Array([251, 255, 190, 0]));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("code_verifier 长度落在 43–128 且只含 unreserved 字符", () => {
    for (const requested of [1, 43, 64, 128, 999]) {
      const v = generateCodeVerifier(requested);
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
      expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it("state 每次不同", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe("buildAuthorizeUrl", () => {
  it("带齐授权码 + PKCE 必需参数，issuer 尾斜杠被归一", () => {
    const url = new URL(
      buildAuthorizeUrl({
        issuer: "https://id.example.com/",
        clientId: "web-drama",
        redirectUri: "https://drama.example.com/auth/callback",
        state: "st4te",
        codeChallenge: "chall",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://id.example.com/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("web-drama");
    expect(url.searchParams.get("redirect_uri")).toBe("https://drama.example.com/auth/callback");
    expect(url.searchParams.get("code_challenge")).toBe("chall");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("openid profile phone offline_access");
  });
});

describe("sanitizeReturnPath", () => {
  it("放行站内相对路径", () => {
    expect(sanitizeReturnPath("/projects/42?tab=cast")).toBe("/projects/42?tab=cast");
  });
  it("拒绝外跳与回调自循环", () => {
    expect(sanitizeReturnPath("//evil.com")).toBe("/");
    expect(sanitizeReturnPath("/\\evil.com")).toBe("/");
    expect(sanitizeReturnPath("https://evil.com")).toBe("/");
    expect(sanitizeReturnPath(AUTH_CALLBACK_PATH)).toBe("/");
    expect(sanitizeReturnPath(null)).toBe("/");
  });
});

describe("completeAuthCallback", () => {
  function seedPending(state: string) {
    sessionStorageShim.setItem(
      OIDC_PENDING_KEY,
      JSON.stringify({ verifier: "v".repeat(43), state, returnPath: "/dashboard" }),
    );
  }

  it("state 不匹配直接拒绝，且不发换令牌请求", async () => {
    seedPending("expected-state");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(completeAuthCallback("?code=abc&state=tampered")).rejects.toMatchObject({
      code: "STATE_MISMATCH",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("没有中间态（会话丢失）时拒绝", async () => {
    await expect(completeAuthCallback("?code=abc&state=whatever")).rejects.toMatchObject({
      code: "NO_PENDING",
    });
  });

  it("账号中心回 error 时抛可读错误", async () => {
    await expect(completeAuthCallback("?error=access_denied")).rejects.toMatchObject({
      code: "access_denied",
    });
  });

  it("state 匹配 → 换令牌并落地存储，返回登录前路径", async () => {
    seedPending("ok-state");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "AT",
        refresh_token: "RT",
        id_token: "IT",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeAuthCallback("?code=abc&state=ok-state")).resolves.toBe("/dashboard");
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBe("AT");
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT");
    // 中间态一次性：读完即删
    expect(sessionStorageShim.getItem(OIDC_PENDING_KEY)).toBeNull();

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("v".repeat(43));
    expect(body.get("redirect_uri")).toBe("https://drama.example.com/auth/callback");
    expect(init.credentials).toBe("omit");
  });
});

describe("refreshAccessToken 单飞", () => {
  it("并发调用只发一次刷新请求，所有调用拿到同一结果", async () => {
    localStorageShim.setItem(AUTH_REFRESH_TOKEN_KEY, "RT");
    // 先造好待决 Promise 再挂 mock —— 刷新要先拿跨标签页锁，fetch 不一定在
    // 本轮同步执行；把 resolver 留到「fetch 被调用时才赋值」会漏掉解析。
    let resolveFetch: (v: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(() => pending);
    vi.stubGlobal("fetch", fetchMock);

    const calls = [refreshAccessToken(), refreshAccessToken(), refreshAccessToken()];
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "AT2", refresh_token: "RT2", expires_in: 60 }),
    });

    await expect(Promise.all(calls)).resolves.toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBe("AT2");
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
  });

  it("刷新完成后闸口复位，下一次会重新发请求", async () => {
    localStorageShim.setItem(AUTH_REFRESH_TOKEN_KEY, "RT");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "AT", expires_in: 60 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await refreshAccessToken();
    await refreshAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("没有 refresh token 直接返回 false，不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("刷新失败清空本地令牌", async () => {
    localStorageShim.setItem(AUTH_TOKEN_KEY, "stale");
    localStorageShim.setItem(AUTH_REFRESH_TOKEN_KEY, "RT");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
    );
    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });
});

// ── P1-8：刷新失败要分「确定失效」和「暂时故障」 ──────────────────────────
//
// 修复前两者一视同仁地清令牌：账号中心抖一下（502 / 网关超时 / 断网），全站用户就被
// 踢回登录页；更糟的是回来以后 /api/me 还可能继续挂，于是原地打转。
describe("classifyTokenFailure（纯函数）", () => {
  it("4xx + OAuth 错误体 = 确定失效", () => {
    expect(classifyTokenFailure(400, { error: "invalid_grant" })).toEqual({
      code: "invalid_grant",
      transient: false,
    });
    expect(classifyTokenFailure(401, { error: "invalid_client" })).toEqual({
      code: "invalid_client",
      transient: false,
    });
  });

  it("5xx / 无错误体 / 读不出 JSON = 暂时故障", () => {
    expect(classifyTokenFailure(502, null).transient).toBe(true);
    expect(classifyTokenFailure(503, { error: "server_error" }).transient).toBe(true);
    // 反代吐 HTML 错误页：状态码像 4xx，但压根不是 OAuth 的结论
    expect(classifyTokenFailure(404, null).transient).toBe(true);
    expect(classifyTokenFailure(400, null).transient).toBe(true);
    // 200 但响应体缺 access_token（网关截断 / 被改写）
    expect(classifyTokenFailure(200, {}).transient).toBe(true);
  });
});

describe("refreshAccessToken 的失败分类（P1-8）", () => {
  beforeEach(() => {
    localStorageShim.setItem(AUTH_TOKEN_KEY, "AT1");
    localStorageShim.setItem(AUTH_REFRESH_TOKEN_KEY, "RT1");
  });

  it("网络错误：抛 TRANSIENT 且令牌一个不动", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(refreshAccessToken()).rejects.toMatchObject({
      code: "TRANSIENT",
      transient: true,
      reason: "NETWORK",
    });
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBe("AT1");
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });

  it("账号中心 502（HTML 错误页）：抛 TRANSIENT 且令牌保留", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );
    await expect(refreshAccessToken()).rejects.toMatchObject({ code: "TRANSIENT", transient: true });
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });

  it("invalid_client：确定失效，返回 false 并清空令牌", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "invalid_client" }) }),
    );
    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorageShim.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("暂时故障不留下脏的单飞状态：网络恢复后下一次能正常刷新", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "AT2", refresh_token: "RT2", expires_in: 60 }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshAccessToken()).rejects.toMatchObject({ code: "TRANSIENT" });
    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(localStorageShim.getItem(AUTH_TOKEN_KEY)).toBe("AT2");
  });
});
