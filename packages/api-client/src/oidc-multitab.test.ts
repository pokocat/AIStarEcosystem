// 多标签页刷新令牌（P1-7）。
//
// 账号中心开了 refresh token 轮换（用一次即作废），所以「每个标签页各自单飞」不够：
// 两个标签页同时用同一个 refresh token 去换，晚到的必然 invalid_grant，而它的失败
// 分支会把先到者刚写进 localStorage 的新令牌一起清掉 —— 用户被莫名踢下线。
//
// 一个标签页 = 一个模块实例（模块级单飞变量各自独立），所以这里用 `vi.resetModules()`
// + 动态 import 造出两个实例，让它们共享同一份 window.localStorage。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY } from "./token-store";

type Oidc = typeof import("./oidc");

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

/**
 * 串行化的假 Web Locks：同名锁排队执行，等价于浏览器语义。
 * 同时支持 `request(name, cb)` 与 `request(name, options, cb)` 两种签名。
 */
function fakeLocks() {
  const chains = new Map<string, Promise<unknown>>();
  return {
    request: (name: string, a: unknown, b?: unknown) => {
      const cb = (typeof a === "function" ? a : b) as (lock: unknown) => Promise<unknown>;
      const prev = chains.get(name) ?? Promise.resolve();
      const run = prev.then(() => cb({ name }));
      chains.set(
        name,
        run.catch(() => {}),
      );
      return run;
    },
  };
}

let store: ReturnType<typeof memoryStorage>;

/** 造一个「新标签页」：独立模块实例，共享同一份 localStorage。 */
async function openTab(): Promise<Oidc> {
  vi.resetModules();
  const mod = (await import("./oidc")) as Oidc;
  mod.__resetOidcRuntimeForTests();
  return mod;
}

beforeEach(() => {
  store = memoryStorage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    localStorage: store,
    sessionStorage: memoryStorage(),
    location: { origin: "https://drama.example.com", search: "", assign: vi.fn() },
  };
  store.setItem(AUTH_TOKEN_KEY, "AT1");
  store.setItem(AUTH_REFRESH_TOKEN_KEY, "RT1");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

/** 一次成功的轮换响应。 */
function rotateOnce() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }),
  });
}

describe("跨标签页刷新（Web Locks）", () => {
  it("两个标签页同时刷新，只有一个真的请求账号中心", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const fetchMock = rotateOnce();
    vi.stubGlobal("fetch", fetchMock);

    const tabA = await openTab();
    const tabB = await openTab();

    // 同一个 tick 里发起：两边看到的都还是 RT1。
    const results = await Promise.all([tabA.refreshAccessToken(), tabB.refreshAccessToken()]);

    expect(results).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT2");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
  });

  it("后到的标签页拿到的是别人换好的 access token（而不是自己再换一次）", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const fetchMock = rotateOnce();
    vi.stubGlobal("fetch", fetchMock);

    const tabA = await openTab();
    const tabB = await openTab();
    // B 先发起（拿到的 startedWith 也是 RT1），但排在 A 之后进锁。
    const b = tabB.refreshAccessToken();
    const a = tabA.refreshAccessToken();

    await expect(Promise.all([b, a])).resolves.toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 关键：整个过程里 RT1 只被消耗了一次，账号中心不会把这次轮换判成重放。
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
  });

  it("锁不影响正常的连续刷新：两次调用各自轮换一次", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "AT3", refresh_token: "RT3", expires_in: 3600 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const tab = await openTab();
    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT3");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT3");
  });
});

describe("invalid_grant 的清令牌边界", () => {
  it("失效标签页刷新失败时，不清掉别人刚换好的新令牌", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    // 请求发出后、失败返回前，另一个标签页（不走我们这把锁，例如旧版本页面）完成了轮换。
    const fetchMock = vi.fn().mockImplementation(async () => {
      store.setItem(AUTH_TOKEN_KEY, "AT9");
      store.setItem(AUTH_REFRESH_TOKEN_KEY, "RT9");
      return { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const tab = await openTab();
    // 拿到的是别人换好的 access token，因此仍算成功。
    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT9");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT9");
  });

  it("存储里仍是失败的那个 refresh token 时，照常清空并要求重新登录", async () => {
    vi.stubGlobal("navigator", { locks: fakeLocks() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
    );

    const tab = await openTab();
    await expect(tab.refreshAccessToken()).resolves.toBe(false);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });
});

// ── P1-7：等锁超时不许「偷偷不带锁刷一次」 ─────────────────────────────────
//
// 修复前：等锁超时 → 直接不带锁调 doRefresh。持锁标签页此刻多半还在等账号中心回包，
// 新令牌尚未落 localStorage，于是本页拿同一个（已被对方消耗掉的）refresh token 去换 →
// invalid_grant → 失败分支把对方刚写回来的新令牌一起清了。两个标签页一起掉线。
//
// 修复后：超时只做只读的「重读存储 + 有界再等」，一个请求都不发；仍无结论就抛可重试的
// TRANSIENT，令牌原样保留。
describe("等锁超时（P1-7）", () => {
  /** 永远不放行的锁：只有等到调用方自己的 signal 超时才 reject（真实 Web Locks 语义）。 */
  function neverGrantedLocks() {
    return {
      request: (_name: string, a: unknown, b?: unknown) => {
        const opts = (typeof a === "function" ? {} : a) as { signal?: AbortSignal };
        void b;
        return new Promise((_resolve, reject) => {
          const signal = opts?.signal;
          if (!signal) return; // 没有 signal 就真的永远挂着（本测试不会走到）
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        });
      },
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("等不到锁时既不请求账号中心，也不清令牌，而是抛可重试的 TRANSIENT", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { locks: neverGrantedLocks() });
    vi.stubGlobal("fetch", fetchMock);
    const tab = await openTab();

    vi.useFakeTimers();
    const settled = tab.refreshAccessToken().then(
      (v) => ({ value: v }),
      (e) => ({ error: e }),
    );
    // 12s 等锁上限 + 1.5s 只读宽限期，全程走完。
    await vi.advanceTimersByTimeAsync(14_000);
    const outcome = (await settled) as { value?: boolean; error?: { code: string; transient: boolean } };

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.error).toMatchObject({ code: "TRANSIENT", transient: true });
    // 关键：令牌一个都没动 —— 兄弟标签页刚换好的东西不会被我们抹掉。
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT1");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });

  it("超时后兄弟标签页把新令牌写回存储 → 直接采纳，仍然不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { locks: neverGrantedLocks() });
    vi.stubGlobal("fetch", fetchMock);
    const tab = await openTab();

    vi.useFakeTimers();
    const p = tab.refreshAccessToken();
    // 先跑完 12s 等锁，进入只读宽限期。
    await vi.advanceTimersByTimeAsync(12_100);
    // 此刻持锁的标签页刚把结果写回 localStorage。
    store.setItem(AUTH_TOKEN_KEY, "AT2");
    store.setItem(AUTH_REFRESH_TOKEN_KEY, "RT2");
    await vi.advanceTimersByTimeAsync(200);

    await expect(p).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
  });

  it("租约降级路径同样如此：抢不到租约就只读等待，不刷新", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", {}); // 没有 Web Locks
    vi.stubGlobal("fetch", fetchMock);
    // 另一个标签页持有一份长期有效的租约（它自己正卡在 fetch 上）。
    store.setItem(
      "aistareco.auth.refresh_lease",
      JSON.stringify({ id: "sibling-tab", expiresAt: Date.now() + 3_600_000 }),
    );
    const tab = await openTab();

    vi.useFakeTimers();
    const settled = tab.refreshAccessToken().then(
      (v) => ({ value: v }),
      (e) => ({ error: e }),
    );
    await vi.advanceTimersByTimeAsync(14_000);
    const outcome = (await settled) as { value?: boolean; error?: { code: string } };

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.error).toMatchObject({ code: "TRANSIENT" });
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });
});

describe("成功刷新的写入顺序（P1-7）", () => {
  it("新令牌先落存储，再释放锁", async () => {
    // 真实 Web Locks 在回调的 promise settle 时释放锁；这里如实模拟并记录时序。
    const events: string[] = [];
    vi.stubGlobal("navigator", {
      locks: {
        request: (name: string, a: unknown, b?: unknown) => {
          const cb = (typeof a === "function" ? a : b) as (lock: unknown) => Promise<unknown>;
          const run = Promise.resolve().then(() => cb({ name }));
          run.then(
            () => events.push("release"),
            () => events.push("release"),
          );
          return run;
        },
      },
    });
    vi.stubGlobal("fetch", rotateOnce());
    const origSet = store.setItem;
    store.setItem = (k: string, v: string) => {
      if (k === AUTH_REFRESH_TOKEN_KEY) events.push(`write:${v}`);
      origSet(k, v);
    };

    const tab = await openTab();
    await expect(tab.refreshAccessToken()).resolves.toBe(true);

    expect(events.indexOf("write:RT2")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("write:RT2")).toBeLessThan(events.indexOf("release"));
  });
});

describe("没有 Web Locks 时的 localStorage 租约降级", () => {
  it("两个标签页同时刷新，仍然只有一次请求", async () => {
    vi.stubGlobal("navigator", {}); // 老浏览器 / 非安全上下文：没有 navigator.locks
    let release: (v: unknown) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tabA = await openTab();
    const tabB = await openTab();
    const a = tabA.refreshAccessToken();
    const b = tabB.refreshAccessToken();

    // A 拿到租约并发出请求；B 在轮询等待。
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }),
    });

    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    // B 拿到租约后重读存储 → 发现已经不是 RT1，直接复用，不再请求。
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
  });
});

// ── 降级租约的「接管过期租约」不许据 invalid_grant 清会话（Codex P2 第五轮） ─────────
//
// 场景：持有租约的标签页被浏览器冻结（定时器、心跳一起停），租约过期；本页接管并用同一个
// refresh token 去换 → 服务器早被那页消费过了 → invalid_grant。此时分不清「真吊销」和
// 「被冻结页用掉了」，不能清会话；应抛可重试的 TRANSIENT，令牌原样保留。
describe("降级租约：接管过期租约后的 invalid_grant 不可信", () => {
  it("接管过期租约 + invalid_grant → TRANSIENT，不清令牌，不再发第二次请求", async () => {
    vi.stubGlobal("navigator", {}); // 没有 Web Locks → 走租约
    // 一条早已过期、但没被释放的租约（冻结页留下的）。
    store.setItem(
      "aistareco.auth.refresh_lease",
      JSON.stringify({ id: "frozen-tab", expiresAt: Date.now() - 1 }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) });
    vi.stubGlobal("fetch", fetchMock);

    const tab = await openTab();
    await expect(tab.refreshAccessToken()).rejects.toMatchObject({
      code: "TRANSIENT",
      reason: "LEASE_TAKEOVER_AMBIGUOUS",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBe("AT1");
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
  });

  it("空闲取得租约（没有过期残留）时，invalid_grant 仍是确定性失败：照常清空", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
    );
    const tab = await openTab();
    await expect(tab.refreshAccessToken()).resolves.toBe(false);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });
});

describe("不可判定状态跨重试保留（Codex P2 第六轮）", () => {
  it("接管后 60s 窗口内、租约已空闲的重试仍是 TRANSIENT；窗口过后才清会话", async () => {
    vi.stubGlobal("navigator", {});
    store.setItem(
      "aistareco.auth.refresh_lease",
      JSON.stringify({ id: "frozen-tab", expiresAt: Date.now() - 1 }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
    );
    const tab = await openTab();
    // 第一次：接管过期租约 → 不确定，保留。
    await expect(tab.refreshAccessToken()).rejects.toMatchObject({ code: "TRANSIENT" });
    // 第二次：租约已被释放，按「空闲取得」进来 —— 但仍在不确定窗口内，照样保留。
    await expect(tab.refreshAccessToken()).rejects.toMatchObject({ code: "TRANSIENT" });
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT1");
    // 把窗口拨到过期：这次失败就是确定性的 → 清会话、重新登录。
    store.setItem(
      "aistareco.auth.refresh_ambiguous",
      JSON.stringify({ refreshToken: "RT1", until: Date.now() - 1 }),
    );
    await expect(tab.refreshAccessToken()).resolves.toBe(false);
    expect(store.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("残留的不确定标记不会挡住后续成功刷新，且成功后标记被清掉", async () => {
    vi.stubGlobal("navigator", {});
    // 上一轮接管留下的标记（绑定 RT1）；此后一次正常刷新成功换成 RT2。
    store.setItem(
      "aistareco.auth.refresh_ambiguous",
      JSON.stringify({ refreshToken: "RT1", until: Date.now() + 60_000 }),
    );
    const fetchMock = rotateOnce();
    vi.stubGlobal("fetch", fetchMock);
    const tab = await openTab();
    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe("RT2");
    // 成功换发即作废不确定状态，不会拖到下一次失败。
    expect(store.getItem("aistareco.auth.refresh_ambiguous")).toBeNull();
  });
});
