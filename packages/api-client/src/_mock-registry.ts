// ─────────────────────────────────────────────────────────────────────────────
// _mock-registry.ts — apiFetch 的 mock 拦截层。
//
// 设计目标：把「USE_MOCK 短路」从业务 api/*.ts 抽到网络边界。
// 业务模块只写 apiFetch(...)，mock 数据集中在各 web app 的 mocks/_handlers/ 下，
// 通过 registerMock(method, pattern, handler) 注册。USE_MOCK=1 时 apiFetch
// 优先命中 registry；USE_MOCK=0 时 registry 完全不被读取，正常走网络。
//
// 路径模板：/me/scripts/:scriptId/versions —— ":xxx" 段会被 captured 为 params。
// ─────────────────────────────────────────────────────────────────────────────

export type MockMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MockHandlerCtx {
  params: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

export type MockHandler<T = unknown> = (ctx: MockHandlerCtx) => T | Promise<T>;

interface MockRoute {
  method: MockMethod;
  segments: string[]; // pattern split by "/", 空段保留以便 length 对比
  paramKeys: Array<string | null>; // 与 segments 同长，非参数段为 null
  handler: MockHandler;
}

const routes: MockRoute[] = [];

function splitPath(p: string): string[] {
  // 移除查询串 + 去前导斜杠后按 "/" 切片。保留空段以便长度比对。
  const noQuery = p.split("?")[0] ?? "";
  const trimmed = noQuery.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed.length === 0 ? [] : trimmed.split("/");
}

function compile(pattern: string): { segments: string[]; paramKeys: Array<string | null> } {
  const segments = splitPath(pattern);
  const paramKeys = segments.map((s) => (s.startsWith(":") ? s.slice(1) : null));
  return { segments, paramKeys };
}

/**
 * 注册一个 mock handler。
 * 同 method + 同 pattern 重复注册会覆盖之前的（HMR 友好）。
 */
export function registerMock<T>(
  method: MockMethod,
  pattern: string,
  handler: MockHandler<T>
): void {
  const compiled = compile(pattern);
  const idx = routes.findIndex(
    (r) =>
      r.method === method &&
      r.segments.length === compiled.segments.length &&
      r.segments.every((s, i) => s === compiled.segments[i])
  );
  const route: MockRoute = { method, ...compiled, handler: handler as MockHandler };
  if (idx >= 0) routes[idx] = route;
  else routes.push(route);
}

/** 批量注册：常用于 mocks/_handlers/xxx.ts 末尾一次性导出。 */
export function registerMocks(
  entries: Array<{ method: MockMethod; pattern: string; handler: MockHandler }>
): void {
  for (const e of entries) registerMock(e.method, e.pattern, e.handler);
}

/** 清空（测试 / 调试用）。 */
export function clearMocks(): void {
  routes.length = 0;
}

/** 当前已注册的 routes（仅供调试/契约审计读取）。 */
export function listMocks(): ReadonlyArray<{ method: MockMethod; pattern: string }> {
  return routes.map((r) => ({
    method: r.method,
    pattern: "/" + r.segments.map((s, i) => (r.paramKeys[i] ? `:${r.paramKeys[i]}` : s)).join("/"),
  }));
}

/** 查找匹配的 handler；返回 null 表示无匹配。 */
export function findMockHandler(
  method: MockMethod,
  path: string
): { handler: MockHandler; params: Record<string, string> } | null {
  const segs = splitPath(path);
  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.segments.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const key = r.paramKeys[i];
      if (key) {
        params[key] = decodeURIComponent(segs[i]!);
      } else if (r.segments[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}
