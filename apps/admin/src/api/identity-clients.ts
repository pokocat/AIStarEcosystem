// ─────────────────────────────────────────────────────────────────────────────
// api/identity-clients.ts — 统一登录接入全景（只读）。
// 对应 AdminIdentityImportController#identityClients；Java wire 真源
// IdentityAdminClient.IdentityClientOverview（它又 1:1 映账号中心的 ClientOverviewService）。
//
// 这一页回答的是「统一登录到底接了哪些系统、哪些还活着」——
// 客户端注册表在账号中心（独立仓 pokocat/aibuzz-id），我方库里查不到，
// 产品侧只知道自己那一个 client_id。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/** 一个接入端：web app / 小程序 / 产品后端各算一个。 */
export interface IdentityClientRow {
  clientId: string;
  displayName: string | null;
  audience: string | null;
  /** 绑定的微信 appid（只有小程序客户端有）。 */
  wechatAppId: string | null;
  /** 已退役：账号中心把它的 grant 集换成了哨兵值，行还在（审计要按 client_id 追溯）。 */
  disabled: boolean;
  /** 公开客户端（浏览器 / 小程序，无 secret，强制 PKCE）。 */
  publicClient: boolean;
  grants: string[];
  scopes: string[];
  redirectUris: string[];
  /** 最近一次换出令牌；null = 从没换过，**或**活跃度不可用（看 activityAvailable）。 */
  lastTokenAt: string | null;
  /** 近 7 天授权数；null = 活跃度不可用，**不是** 0。 */
  tokens7d: number | null;
}

/** 一个产品下的全部接入端。注意六个 web app 的 productCode 都是 aistar —— 产品 ≠ 应用。 */
export interface IdentityProductRow {
  productCode: string;
  displayName: string;
  clients: IdentityClientRow[];
}

/**
 * 全景快照。
 *
 * error 非 null 时其余字段一律空 —— 「读失败 / 未配置」与「一个都没接」必须分开渲染。
 * activityAvailable=false 表示账号中心那边的活跃度聚合没取到，此时每行的
 * lastTokenAt / tokens7d 都是 null，该显示「暂不可用」而不是「从没用过」。
 */
export interface IdentityClientOverview {
  error: string | null;
  /** false = 这台环境没配后台凭据（不是故障）。 */
  configured: boolean;
  issuer: string;
  /** 我方发起这次读取的时间。 */
  checkedAt: string;
  /** 账号中心生成这份快照的时间。 */
  generatedAt: string | null;
  activityAvailable: boolean;
  productCount: number;
  clientCount: number;
  products: IdentityProductRow[];
}

// Mock 刻意做成「有已退役客户端 + 有从没用过的客户端」的形状：
// 这一页的价值就在这两种异常态，mock 全绿的话这段 UI 永远没人验过。
const MOCK: IdentityClientOverview = {
  error: null,
  configured: true,
  issuer: "https://id.aibuzz.cn",
  checkedAt: new Date().toISOString(),
  generatedAt: new Date().toISOString(),
  activityAvailable: true,
  productCount: 2,
  clientCount: 5,
  products: [
    {
      productCode: "aistar",
      displayName: "AI Star",
      clients: [
        { clientId: "web-music", displayName: "AI 音乐人", audience: "aistar-api", wechatAppId: null, disabled: false, publicClient: true, grants: ["authorization_code", "refresh_token"], scopes: ["offline_access", "openid", "phone", "profile"], redirectUris: ["https://music.aibuzz.cn/auth/callback"], lastTokenAt: "2026-09-06T07:08:41Z", tokens7d: 2 },
        { clientId: "aistar-server", displayName: "AI Star Eco 后端", audience: "id-api", wechatAppId: null, disabled: false, publicClient: false, grants: ["client_credentials"], scopes: ["product.link"], redirectUris: [], lastTokenAt: "2026-09-09T16:48:14Z", tokens7d: 131 },
        { clientId: "mini-legacy", displayName: "旧版小程序", audience: "aistar-api", wechatAppId: "wx-legacy", disabled: true, publicClient: true, grants: ["urn:aibuzz:params:oauth:grant-type:disabled"], scopes: ["openid"], redirectUris: [], lastTokenAt: "2026-06-01T10:00:00Z", tokens7d: 0 },
      ],
    },
    {
      productCode: "admin",
      displayName: "运营后台",
      clients: [
        { clientId: "admin-server", displayName: "运营后台后端", audience: "admin-api", wechatAppId: null, disabled: false, publicClient: false, grants: ["client_credentials", "urn:aibuzz:params:oauth:grant-type:impersonate"], scopes: ["admin.users", "clients.read", "impersonate"], redirectUris: [], lastTokenAt: new Date().toISOString(), tokens7d: 1 },
        { clientId: "web-admin", displayName: "运营后台", audience: "admin-api", wechatAppId: null, disabled: false, publicClient: true, grants: ["authorization_code", "refresh_token"], scopes: ["offline_access", "openid", "phone", "profile"], redirectUris: ["https://admin.aibuzz.cn/admin/auth/callback"], lastTokenAt: null, tokens7d: 0 },
      ],
    },
  ],
};

export async function getIdentityClientOverview(): Promise<IdentityClientOverview> {
  if (USE_MOCK) return mockDelay(MOCK);
  return apiFetch<IdentityClientOverview>("/admin/identity/clients");
}
