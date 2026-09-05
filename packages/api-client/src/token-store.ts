// ─────────────────────────────────────────────────────────────────────────────
// token-store.ts — 浏览器端令牌仓库（localStorage）。
//
// legacy 模式只用 access token 一个键（历史行为完全不变）；
// id 模式（统一账号中心）额外存 refresh token / 过期时刻 / id_token
// （id_token 仅用于 RP-initiated logout 的 `id_token_hint`）。
//
// 键名故意与历史保持一致（`aistareco.auth.token`），这样两种模式共用同一把
// Authorization header 逻辑，切模式不会把已登录用户踢下线以外的副作用。
//
// ⚠️ 安全权衡（P1-6，已知且**有意**接受，不是疏忽）
// ────────────────────────────────────────────────────────────────────────────
// 三个令牌（access / refresh / id_token）都存在 localStorage：任一子站点出现 XSS，
// 脚本就能读走它们；其中 refresh token 有效期 30 天，危害远大于 access token。
// 之所以现在仍这么做：
//   · 五个 web app 是纯静态 Next 前端 + `/api` 反代，没有可放 HttpOnly cookie 的
//     自有后端会话层；账号中心按 D9 明确**不做** `.aibuzz.cn` 全域共享 cookie。
//   · 换成 HttpOnly cookie 需要每个 app 前面加一层 BFF（代持令牌 + 转发 API），
//     属于架构级改造，已排到 **P5**（见 docs/unified-identity-plan.md 决策 D9 与
//     TODO.md 统一账号中心段）。
// 在那之前的缓解措施：access token ≤ 1h；refresh token 一次性轮换（用过即废，
// 见 oidc.ts 的跨标签页刷新锁）；令牌只发给 issuer 与本域 `/api`，绝不落 URL。
//
// id_token 为什么也必须存：Spring Authorization Server 的 `/connect/logout` 只能
// 从 `id_token_hint` 反查出注册客户端，没有它就无法校验 `post_logout_redirect_uri`
// （SAS 1.3.3 `OidcLogoutAuthenticationProvider`：registeredClient 为 null 时对带
// post_logout_redirect_uri 的请求直接 `invalid_request`）——用户会停在账号中心的
// 报错页而不是回到我们站内。所以它不是「顺手存的」，是登出闭环的必需品；
// 一旦账号中心支持 `client_id` 参数登出，这个键就可以删掉。
// ─────────────────────────────────────────────────────────────────────────────

/** access token（两种模式共用）。 */
export const AUTH_TOKEN_KEY = "aistareco.auth.token";
/** refresh token（仅 id 模式）。 */
export const AUTH_REFRESH_TOKEN_KEY = "aistareco.auth.refresh";
/** access token 过期时刻（epoch ms，仅 id 模式；用于提前刷新的启发式判断）。 */
export const AUTH_EXPIRES_AT_KEY = "aistareco.auth.expires_at";
/** id_token（仅 id 模式；登出时作为 `id_token_hint` 回传账号中心）。 */
export const AUTH_ID_TOKEN_KEY = "aistareco.auth.id_token";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* 隐私模式 / storage 满，静默失败 */
  }
}

export function getAuthToken(): string | null {
  return read(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  write(AUTH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return read(AUTH_REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  write(AUTH_REFRESH_TOKEN_KEY, token);
}

export function getIdToken(): string | null {
  return read(AUTH_ID_TOKEN_KEY);
}

export function setIdToken(token: string | null) {
  write(AUTH_ID_TOKEN_KEY, token);
}

/** access token 过期时刻（epoch ms）；未知返回 null。 */
export function getTokenExpiresAt(): number | null {
  const raw = read(AUTH_EXPIRES_AT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setTokenExpiresAt(at: number | null) {
  write(AUTH_EXPIRES_AT_KEY, at === null ? null : String(at));
}

/** 清空全部登录痕迹（两种模式都安全）。 */
export function clearAuthTokens() {
  setAuthToken(null);
  setRefreshToken(null);
  setIdToken(null);
  setTokenExpiresAt(null);
}
