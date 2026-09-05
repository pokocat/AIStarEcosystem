// ─────────────────────────────────────────────────────────────────────────────
// oidc.ts — 统一账号中心（id.aibuzz.cn）授权码 + PKCE 登录（docs/unified-identity-plan.md §12.5）。
//
// 只在 `authMode() === "id"` 时生效；legacy / USE_MOCK 模式下这些函数一律不被调用
// （`beginLogin` 自带兜底，误调也只是 no-op，绝不会把 mock 用户踢去外部域名）。
//
// 浏览器直连账号中心 `/oauth2/token`（账号中心已开 CORS，§12.7），因此不需要
// 后端中转；`credentials` 一律不带（公开客户端，PKCE 即防护）。
//
// 存储位置：
//   localStorage  aistareco.auth.token / .refresh / .expires_at / .id_token
//   localStorage  aistareco.auth.refresh_lease ← 无 Web Locks 时的跨标签页刷新租约
//   sessionStorage aistareco.oidc.pending   ← {verifier, state, returnPath}，只活一次跳转
// ─────────────────────────────────────────────────────────────────────────────

import { idClientId, idIssuer, isIdMode, USE_MOCK } from "./config";
import {
  clearAuthTokens,
  getAuthToken,
  getIdToken,
  getRefreshToken,
  setAuthToken,
  setIdToken,
  setRefreshToken,
  setTokenExpiresAt,
} from "./token-store";

/** PKCE 中间态（sessionStorage，跳转前写、回调时读一次即删）。 */
export const OIDC_PENDING_KEY = "aistareco.oidc.pending";

/** 授权回调页路径（各 app 的 `src/app/auth/callback/page.tsx`）。 */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** 申请的 scope：openid 必备；phone 让 server 能拿到手机号；offline_access 换 refresh token。 */
const SCOPE = "openid profile phone offline_access";

export interface OidcPendingState {
  verifier: string;
  state: string;
  returnPath: string;
}

/**
 * 登录 / 刷新过程中的可读错误（文案直接可展示给用户）。
 *
 * `transient`（P1-8）区分两类失败，**决定要不要清掉本地会话**：
 *   - `false`（默认）＝**确定失效**：账号中心明确拒绝（`invalid_grant` / `invalid_client`
 *     等 4xx OAuth 错误体）。此时令牌真的没用了，该清、该回登录。
 *   - `true` ＝**暂时故障**：网络断、账号中心 5xx / 超时、反代吐 HTML。令牌本身很可能
 *     还有效，清了等于「后端抖一下就把所有人踢下线」。调用方应保留令牌并让用户重试。
 */
export class OidcError extends Error {
  code: string;
  /** true = 暂时性故障（网络 / 5xx / 超时 / 等锁超时）：绝不能据此清会话。 */
  transient: boolean;
  /** 原始原因（`HTTP_502` / `NETWORK` / `LOCK_TIMEOUT` …），仅用于排查，不展示给用户。 */
  reason?: string;
  constructor(code: string, message: string, opts?: { transient?: boolean; reason?: string }) {
    super(message);
    this.name = "OidcError";
    this.code = code;
    this.transient = opts?.transient ?? false;
    this.reason = opts?.reason;
  }
}

/** 刷新失败是不是「暂时性」的（调用方据此决定保留还是清空令牌）。 */
export function isTransientOidcError(e: unknown): e is OidcError {
  return e instanceof OidcError && e.transient === true;
}

// ── 纯函数（可单测） ─────────────────────────────────────────────────────────

const UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/** base64url 编码（无 padding）。 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : // Node 侧（vitest）没有 btoa 的极老版本兜底
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function webCrypto(): Crypto {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!c || !c.subtle || !c.getRandomValues) {
    throw new OidcError(
      "CRYPTO_UNAVAILABLE",
      "当前浏览器环境不支持安全登录所需的加密能力，请更换浏览器或使用 HTTPS 访问。",
    );
  }
  return c;
}

/**
 * 生成 RFC 7636 允许的 code_verifier（43–128 个 unreserved 字符）。
 * 用 `getRandomValues` 取随机字节后按字符表取模 —— 字符表长度 64 是 256 的因数，
 * 因此取模不引入偏置。
 */
export function generateCodeVerifier(length = 64): string {
  const len = Math.min(128, Math.max(43, Math.floor(length)));
  const bytes = new Uint8Array(len);
  webCrypto().getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i += 1) out += UNRESERVED[bytes[i] % UNRESERVED.length];
  return out;
}

/** S256 challenge = base64url(sha256(ascii(verifier)))。 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await webCrypto().subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** 生成不可枚举的 state。 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  webCrypto().getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * 只接受站内相对路径作为回跳目标：拒绝 `//`（协议相对外跳）、含 `\`（浏览器会把
 * 反斜杠归一成斜杠，`/\evil.com` 可外跳）、以及回调页自身（避免自循环）。
 */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("\\")) return "/";
  if (raw === AUTH_CALLBACK_PATH || raw.startsWith(`${AUTH_CALLBACK_PATH}?`) || raw.startsWith(`${AUTH_CALLBACK_PATH}/`)) {
    return "/";
  }
  return raw;
}

export interface BuildAuthorizeUrlInput {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}

/** 拼 `/oauth2/authorize` 跳转地址（纯函数，便于单测）。 */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const usp = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scope ?? SCOPE,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${input.issuer.replace(/\/+$/, "")}/oauth2/authorize?${usp.toString()}`;
}

// ── sessionStorage 中间态 ────────────────────────────────────────────────────

export function savePendingState(pending: OidcPendingState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OIDC_PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* 隐私模式：回调时会因取不到 verifier 报「登录会话已失效」，用户重试即可 */
  }
}

export function takePendingState(): OidcPendingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(OIDC_PENDING_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(OIDC_PENDING_KEY);
    const parsed = JSON.parse(raw) as Partial<OidcPendingState>;
    if (!parsed || typeof parsed.verifier !== "string" || typeof parsed.state !== "string") return null;
    return {
      verifier: parsed.verifier,
      state: parsed.state,
      returnPath: sanitizeReturnPath(parsed.returnPath),
    };
  } catch {
    return null;
  }
}

// ── 登录 / 回调 / 刷新 / 登出 ────────────────────────────────────────────────

function redirectUri(): string {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

/** 防止 401 风暴里连发多次 location 跳转。 */
let redirecting = false;

/**
 * 发起账号中心登录：生成 PKCE + state 存 sessionStorage，然后整页跳到 `/oauth2/authorize`。
 * 返回 true 表示已发起跳转；legacy / mock / SSR / 未配 issuer 时返回 false（不做任何事）。
 */
export async function beginLogin(returnPath?: string): Promise<boolean> {
  if (USE_MOCK || !isIdMode()) return false;
  if (typeof window === "undefined") return false;
  if (redirecting) return true;

  const issuer = idIssuer();
  if (!issuer) return false;

  const target = sanitizeReturnPath(
    returnPath ?? `${window.location.pathname}${window.location.search}`,
  );

  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await computeCodeChallenge(verifier);
  savePendingState({ verifier, state, returnPath: target });

  redirecting = true;
  window.location.assign(
    buildAuthorizeUrl({
      issuer,
      clientId: idClientId(),
      redirectUri: redirectUri(),
      state,
      codeChallenge: challenge,
    }),
  );
  return true;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * 判定 `/oauth2/token` 的这次失败是「确定失效」还是「暂时故障」（P1-8）。
 *
 * 只有账号中心**在 4xx 上明确给出 OAuth 错误体**（`{"error":"invalid_grant"}`）才算
 * 确定失效 —— 那是协议层的「这张票据不作数」。其余一律按暂时故障处理：
 *   - 5xx：账号中心自己挂了，令牌没道理跟着作废；
 *   - 没有 error 字段的 4xx / 200：多半是反代或 WAF 吐的 HTML 错误页，读不出结论就
 *     不下结论（宁可让用户点一次重试，也不能把还在有效期的会话清掉）。
 */
export function classifyTokenFailure(
  status: number,
  json: TokenResponse | null,
): { code: string; transient: boolean } {
  const oauthError = typeof json?.error === "string" && json.error ? json.error : null;
  if (oauthError && status >= 400 && status < 500) return { code: oauthError, transient: false };
  if (oauthError) return { code: oauthError, transient: true };
  return { code: `HTTP_${status}`, transient: true };
}

/**
 * 令牌请求的硬超时。必须**小于** REFRESH_LEASE_TTL_MS（10s）：没有 Web Locks 时靠 localStorage 租约互斥，
 * 一个挂住不回的刷新请求若活过租约，另一个标签页会接管租约并重复消费同一个 refresh token，
 * 拿到 invalid_grant 后把会话清掉（Codex P2 第三轮 P1）。超时 → 走 NETWORK（瞬时）分类，保留令牌。
 */
export const TOKEN_FETCH_TIMEOUT_MS = 8_000;

async function postToken(form: Record<string, string>): Promise<TokenResponse> {
  const issuer = idIssuer();
  if (!issuer) throw new OidcError("ID_NOT_CONFIGURED", "尚未配置账号中心地址，请联系管理员。");
  let res: Response;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TOKEN_FETCH_TIMEOUT_MS) : null;
  try {
    res = await fetch(`${issuer}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
      // 公开客户端 + PKCE：不带 cookie，避免被当成机密客户端会话。
      credentials: "omit",
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
  } catch {
    if (timer) clearTimeout(timer);
    // fetch 直接抛 = 网络层没通（断网 / DNS / CORS 预检失败 / 请求被取消 / 超过 TOKEN_FETCH_TIMEOUT_MS）。
    throw new OidcError("NETWORK", "连接账号中心失败，请检查网络后重试。", {
      transient: true,
      reason: "NETWORK",
    });
  }

  // 定时器要活到响应体读完：headers 到了但 body 挂住同样能拖过租约（Codex P2 第四轮）。
  // 被中止的 body 读取（AbortError）和网络抛错同样归入 NETWORK 瞬时错误，保留令牌。
  let json: TokenResponse | null = null;
  try {
    json = (await res.json()) as TokenResponse;
  } catch {
    if (ctrl?.signal.aborted) {
      throw new OidcError("NETWORK", "连接账号中心超时，请稍后重试。", {
        transient: true,
        reason: "TIMEOUT",
      });
    }
    json = null;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok || !json || json.error || !json.access_token) {
    const { code, transient } = classifyTokenFailure(res.status, json);
    throw new OidcError(
      code,
      transient
        ? "账号中心暂时无法访问，请稍后重试。"
        : "账号中心拒绝了这次登录，请重新登录。",
      { transient, reason: `HTTP_${res.status}` },
    );
  }
  return json;
}

/**
 * 「不可判定」标记：接管过期租约后拿到 invalid_grant，分不清是真吊销还是被冻结页用掉了。
 * 把这个判断**跨重试保留**一小段时间（键值绑定到出问题的那个 refresh token）：窗口内同一 token
 * 再失败仍视为瞬时（冻结页醒来落库后，重读会直接采纳新令牌）；窗口过后再失败才是确定性失败 →
 * 清会话、重新登录。这样既不会在一次重试后误清，也不会永久卡在 TRANSIENT（Codex P2 第六轮）。
 */
const REFRESH_AMBIGUOUS_KEY = "aistareco.auth.refresh_ambiguous";
export const REFRESH_AMBIGUOUS_WINDOW_MS = 60_000;

type AmbiguousMarker = { refreshToken: string; until: number };

function ambiguousRead(): AmbiguousMarker | null {
  try {
    const raw = window.localStorage.getItem(REFRESH_AMBIGUOUS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as AmbiguousMarker;
    return v && typeof v.refreshToken === "string" && typeof v.until === "number" ? v : null;
  } catch {
    return null;
  }
}

function ambiguousWrite(marker: AmbiguousMarker | null) {
  try {
    if (marker) window.localStorage.setItem(REFRESH_AMBIGUOUS_KEY, JSON.stringify(marker));
    else window.localStorage.removeItem(REFRESH_AMBIGUOUS_KEY);
  } catch {
    /* 隐私模式：写不进就退化为「下一次失败即清会话」 */
  }
}

/**
 * 判定一次确定性失败该不该被当成「不可判定」吞掉。
 * @returns true = 仍在不确定窗口内（或本次刚接管），保留令牌；false = 窗口已过或从未接管，照常清会话。
 */
export function shouldHoldAmbiguousFailure(refreshToken: string, takeover: boolean, now = Date.now()): boolean {
  const marker = ambiguousRead();
  const active = marker && marker.refreshToken === refreshToken && marker.until > now;
  if (active) return true;
  if (marker && marker.refreshToken === refreshToken) {
    // 同一个 token 的窗口已经用完：这次就是确定性失败。
    ambiguousWrite(null);
    return false;
  }
  if (takeover) {
    ambiguousWrite({ refreshToken, until: now + REFRESH_AMBIGUOUS_WINDOW_MS });
    return true;
  }
  return false;
}

function storeTokens(token: TokenResponse) {
  ambiguousWrite(null); // 换成功了：之前的不确定状态作废
  setAuthToken(token.access_token ?? null);
  if (token.refresh_token) setRefreshToken(token.refresh_token);
  if (token.id_token) setIdToken(token.id_token);
  setTokenExpiresAt(
    typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : null,
  );
}

/**
 * 回调页调用：校验 state → 拿 code 换令牌 → 落地存储 → 返回登录前的站内路径。
 * 失败抛 `OidcError`（message 已是可直接展示的中文）。
 */
export async function completeAuthCallback(search?: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new OidcError("SSR", "登录回调只能在浏览器中完成。");
  }
  const params = new URLSearchParams(search ?? window.location.search);

  const errorCode = params.get("error");
  if (errorCode) {
    throw new OidcError(
      errorCode,
      errorCode === "access_denied" ? "你取消了这次登录。" : "账号中心返回登录失败，请重新登录。",
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    throw new OidcError("MISSING_CODE", "登录信息不完整，请重新登录。");
  }

  const pending = takePendingState();
  if (!pending) {
    throw new OidcError("NO_PENDING", "登录会话已失效（可能是页面被刷新过久），请重新登录。");
  }
  if (pending.state !== state) {
    throw new OidcError("STATE_MISMATCH", "登录校验未通过，请重新登录。");
  }

  const token = await postToken({
    grant_type: "authorization_code",
    client_id: idClientId(),
    code,
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
  });
  storeTokens(token);
  return pending.returnPath;
}

// ── 刷新令牌（跨标签页安全） ─────────────────────────────────────────────────
//
// 账号中心开了 refresh token 轮换：一个 refresh token 只能用一次，用过即作废。
// localStorage 是**整个源共享**的，所以两个标签页各自「单飞」并不够 ——
// 两边同时拿同一个 refresh token 去换，晚到的那个必定 `invalid_grant`，
// 而它的失败分支会把另一个标签页刚换回来的新令牌一起清掉（用户被莫名踢下线）。
//
// 三道防线：
//   1. 跨标签页互斥：Web Locks（`navigator.locks`）；不支持时退化为 localStorage 租约。
//   2. 进锁后**重读**存储：refresh token 已经不是本次开始时那个 → 别人换好了，直接用。
//   3. 失败后**再读一次**：存储里的 refresh token 已被别人换新 → 不清令牌。
//
// 单飞（模块变量）仍然保留：同一个标签页内的并发 401 连锁请求根本不必进锁。
//
// ⚠️ 等锁超时**绝不能**「那就不带锁刷一次」（P1-7 修复前就是这么写的）：
// 持锁的标签页此刻多半正等着账号中心回包，它的新令牌还没写进 localStorage。
// 这时本页拿同一个（已被对方用掉的）refresh token 去换必然 `invalid_grant`，
// 而失败分支紧接着把对方刚写回来的新令牌一并清掉 —— 两个标签页一起掉线。
// 所以超时后只做**只读**的等待与采纳：见 `adoptSiblingRefresh`。
// 换句话说：**只有在锁内、且重读过存储的那次刷新，才有资格清令牌。**

/** Web Locks 锁名（同源全部标签页共享）。 */
const REFRESH_LOCK_NAME = "aistareco.auth.refresh";
/** 无 Web Locks 时的 localStorage 租约键。 */
const REFRESH_LEASE_KEY = "aistareco.auth.refresh_lease";
/** 租约有效期：持有者崩溃 / 标签页被关掉时，其他标签页最多等这么久就接管。 */
const REFRESH_LEASE_TTL_MS = 10_000;
/** 租约轮询间隔与最长等待（等超时也不把请求永久挂起，改为只读地采纳兄弟标签页的结果）。 */
const LEASE_POLL_MS = 50;
const LEASE_MAX_WAIT_MS = 12_000;
/** 等锁超时后，再给持锁标签页多少时间把新令牌写回存储（只读轮询，不发任何请求）。 */
const SIBLING_GRACE_MS = 1_500;

let refreshInFlight: Promise<boolean> | null = null;

function lockManager(): LockManager | null {
  const nav = (globalThis as { navigator?: { locks?: LockManager } }).navigator;
  const locks = nav?.locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

function leaseRead(): { id: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REFRESH_LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; expiresAt?: unknown };
    if (typeof parsed?.id !== "string" || typeof parsed?.expiresAt !== "number") return null;
    return { id: parsed.id, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function leaseWrite(value: { id: string; expiresAt: number } | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(REFRESH_LEASE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(REFRESH_LEASE_KEY);
  } catch {
    /* 隐私模式：拿不到租约就退化为「各刷各的」，由重读逻辑兜底 */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * localStorage 租约（Web Locks 的降级实现）。不是严格互斥 —— 两个标签页在同一毫秒
 * 抢租约时可能都认为自己拿到了；这只是把并发概率压到很低，真正的正确性靠锁内重读。
 */
/** 本次刷新是否是「接管了别人过期的租约」——接管者的 invalid_grant 不可信（见 doRefresh）。 */
export type RefreshContext = { takeover: boolean };

async function withLease<T>(
  fn: (ctx: RefreshContext) => Promise<T>,
  onTimeout: () => Promise<T>,
): Promise<T> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const deadline = Date.now() + LEASE_MAX_WAIT_MS;
  let held = false;
  let takeover = false;
  for (;;) {
    const cur = leaseRead();
    if (!cur || cur.expiresAt <= Date.now()) {
      // 有一条过期租约 = 上一个持有者还没释放就没了（页面被浏览器冻结 / 关闭 / 崩溃）。
      // 它的刷新请求可能已经打到服务器并消费了 refresh token，只是响应没落回存储。
      const tookOverExpired = !!cur;
      leaseWrite({ id, expiresAt: Date.now() + REFRESH_LEASE_TTL_MS });
      // 写后重读：并发写时「最后一个写入者」才是持有者。
      if (leaseRead()?.id === id) {
        held = true;
        takeover = tookOverExpired;
        break;
      }
    }
    if (Date.now() >= deadline) break; // 等超时：走只读的采纳路径，不抢着刷新
    await sleep(LEASE_POLL_MS);
  }
  if (!held) return onTimeout();
  // 心跳续租：只要 fn 还在跑就把 expiresAt 往后推，慢请求不会因租约到期被别的标签页接管
  // （接管 = 重复消费同一 refresh token → invalid_grant → 清会话）。fetch 自身另有 8s 硬超时兜底。
  const heartbeat = setInterval(() => {
    if (leaseRead()?.id === id) leaseWrite({ id, expiresAt: Date.now() + REFRESH_LEASE_TTL_MS });
  }, Math.max(500, Math.floor(REFRESH_LEASE_TTL_MS / 4)));
  try {
    return await fn({ takeover });
  } finally {
    clearInterval(heartbeat);
    // fn 已经把新令牌写进存储（storeTokens 是同步的）才轮到这里释放租约 ——
    // 顺序不能反：先释放会让等待方读到旧令牌又去刷一次。
    if (leaseRead()?.id === id) leaseWrite(null);
  }
}

/**
 * 跨标签页互斥执行：优先 Web Locks，退化到 localStorage 租约。
 *
 * 等锁**必须有上限** —— 持锁的标签页可能卡在一个永不返回的 fetch 上（移动端切后台
 * 尤其常见），没有上限的话本页所有 401 重放都会被永久挂起。但超时**不等于**可以
 * 不带锁去刷（见本节顶部的 P1-7 说明），所以超时交给 `onTimeout`：只读地采纳
 * 兄弟标签页的结果，一个请求都不发。
 */
async function withRefreshLock<T>(
  fn: (ctx: RefreshContext) => Promise<T>,
  onTimeout: () => Promise<T>,
): Promise<T> {
  const locks = lockManager();
  if (!locks) return withLease(fn, onTimeout);

  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), LEASE_MAX_WAIT_MS) : null;
  let entered = false;
  try {
    return await locks.request(REFRESH_LOCK_NAME, ctrl ? { signal: ctrl.signal } : {}, () => {
      entered = true;
      return fn({ takeover: false });
    });
  } catch (e) {
    if (entered) throw e; // 是 fn 自己抛的，原样上抛
    if (ctrl?.signal.aborted) return onTimeout(); // 等锁超时：只读采纳，绝不无锁刷新
    // Web Locks 存在但这次拿不到（非安全上下文的 SecurityError 等）：退到租约互斥，
    // 仍然保有「同一时刻只有一个标签页真的去刷」的语义。
    return withLease(fn, onTimeout);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 只读地检查「别的标签页是不是已经换好了」。
 *   - `true`  ：存储里的 refresh token 已经换新且有 access token → 直接采纳；
 *   - `false` ：令牌已被清空（别人登出 / 别人确认失效）→ 明确失败，但**本页什么都不用清**；
 *   - `null`  ：还是我们开始时那个 → 尚无结论，继续等。
 */
function peekSiblingRefresh(startedWith: string): boolean | null {
  const cur = getRefreshToken();
  if (!cur) return false;
  if (cur !== startedWith) return getAuthToken() ? true : null;
  return null;
}

/**
 * 等锁超时后的处置（P1-7）：**不刷新**，只重读存储。
 * 仍然没结论就抛 `TRANSIENT` —— 可重试的失败，令牌原样保留。
 */
async function adoptSiblingRefresh(startedWith: string): Promise<boolean> {
  const first = peekSiblingRefresh(startedWith);
  if (first !== null) return first;
  const deadline = Date.now() + SIBLING_GRACE_MS;
  while (Date.now() < deadline) {
    await sleep(LEASE_POLL_MS);
    const again = peekSiblingRefresh(startedWith);
    if (again !== null) return again;
  }
  throw new OidcError("TRANSIENT", "登录状态正在刷新中，请稍后重试。", {
    transient: true,
    reason: "LOCK_TIMEOUT",
  });
}

/**
 * 锁内的实际刷新。`startedWith` 是本标签页发起刷新那一刻看到的 refresh token。
 * 这是**唯一**允许清空令牌的地方，且清之前必定重读过存储。
 */
async function doRefresh(startedWith: string, ctx: RefreshContext = { takeover: false }): Promise<boolean> {
  // 防线 2：进锁后重读 —— 等锁期间别的标签页很可能已经换过了。
  const current = getRefreshToken();
  if (!current) return false; // 别的标签页登出了 / 刷新彻底失败并清空了
  if (current !== startedWith) {
    // 已经被别人轮换过：直接用现成的 access token，不再消耗新 refresh token。
    return !!getAuthToken();
  }

  try {
    const token = await postToken({
      grant_type: "refresh_token",
      client_id: idClientId(),
      refresh_token: current,
    });
    // 先落存储、再返回（返回即释放锁）：等锁的标签页醒来时一定读得到新令牌。
    storeTokens(token);
    return true;
  } catch (e) {
    // 防线 3：`invalid_grant` 往往意味着「别的标签页已经用掉了这个 token」。
    // 只有存储里的 refresh token 仍然是失败的这一个，才是真的过期 / 被吊销。
    const after = getRefreshToken();
    if (after && after !== current) return !!getAuthToken();
    if (isTransientOidcError(e)) {
      // 网络断 / 账号中心 5xx：这次没换成，但令牌未必失效 —— 保留，交给调用方重试。
      throw new OidcError("TRANSIENT", "暂时无法连接账号中心，请稍后重试。", {
        transient: true,
        reason: e.reason ?? e.code,
      });
    }
    if (shouldHoldAmbiguousFailure(current, ctx.takeover)) {
      // 接管了一条**过期租约**（或仍在上次接管留下的 60s 不确定窗口内）：上一个持有者（被冻结 / 关闭的
      // 标签页）可能已经在服务器上消费了这个 refresh token，只是响应没落回存储。此时的 invalid_grant
      // 分不清「真吊销」还是「被它用掉了」，不能据此清会话 —— 当瞬时错误抛出，让用户看到重试屏；
      // 那个页面醒来后会把新令牌写进存储，下一次刷新前的重读就能采纳。窗口过后再失败 → 清会话重登。
      throw new OidcError("TRANSIENT", "登录状态正在其他标签页刷新，请稍后重试。", {
        transient: true,
        reason: "LEASE_TAKEOVER_AMBIGUOUS",
      });
    }
    clearAuthTokens();
    return false;
  }
}

/**
 * 用 refresh token 换新的 access token。
 * - **单飞**：同一标签页内并发调用共享同一次执行；
 * - **跨标签页互斥**：多个标签页同时刷新时只有一个真的请求账号中心，其余直接复用结果。
 *
 * 三种结果（P1-8，调用方必须分开处理）：
 *   - `true`  ：拿到可用的 access token（自己换的，或采纳了别的标签页换好的）；
 *   - `false` ：**确认失效**，本地令牌已清空 → 回登录；
 *   - 抛 `OidcError{code:"TRANSIENT", transient:true}`：这次没刷成但令牌保留
 *     （网络断 / 账号中心 5xx / 等锁超时）→ 上层应进「服务暂时不可用」重试屏，
 *     **不要**当成没登录。
 */
export function refreshAccessToken(): Promise<boolean> {
  if (!isIdMode()) return Promise.resolve(false);
  if (refreshInFlight) return refreshInFlight;
  const startedWith = getRefreshToken();
  if (!startedWith) return Promise.resolve(false);
  const p = withRefreshLock(
    (ctx) => doRefresh(startedWith, ctx),
    () => adoptSiblingRefresh(startedWith),
  ).finally(() => {
    if (refreshInFlight === p) refreshInFlight = null;
  });
  refreshInFlight = p;
  return p;
}

/** 仅测试用：重置单飞状态与跳转闸。 */
export function __resetOidcRuntimeForTests() {
  refreshInFlight = null;
  redirecting = false;
}

/**
 * 登出：先清本地令牌；id 模式再跳账号中心的 RP-initiated logout
 * （带 `id_token_hint`，账号中心才会认这次登出并回跳）。
 * 返回 true 表示已发起跳转（调用方不必再自己 router.replace）。
 */
export function logout(): boolean {
  const hint = getIdToken();
  clearAuthTokens();
  if (typeof window === "undefined") return false;
  if (!isIdMode()) return false;
  const issuer = idIssuer();
  if (!issuer) return false;
  const usp = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}/`,
  });
  if (hint) usp.set("id_token_hint", hint);
  redirecting = true;
  window.location.assign(`${issuer}/connect/logout?${usp.toString()}`);
  return true;
}
