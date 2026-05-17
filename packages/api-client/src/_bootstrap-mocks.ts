// ─────────────────────────────────────────────────────────────────────────────
// _bootstrap-mocks.ts — api-client 自带的 auth + account mock handler。
// 由 index.ts 顶层 side-effect import；USE_MOCK=0 时 registry 不被读取。
//
// 业务领域 mock 由各 web app 的 src/mocks/_register.ts 自行注册；
// 这里只兜 dev-login / activate / /me / /me/wallet 这些"启动条件"接口，
// 让无后端环境也能跑通 landing → /login → 工作台。
//
// 同 method+path 的后注册者覆盖之前 —— web app 可以通过自家 handler 覆盖
// 这里的默认（例如 drama 的 finance.ts 覆盖 /me/wallet）。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser } from "@ai-star-eco/types/account";
import type { LicenseRedeemRequest, LicenseRedeemResult } from "@ai-star-eco/types/license";
import { mockDelay, setAuthToken } from "./_client";
import { registerMocks } from "./_mock-registry";
import { MOCK_TENANTS, MOCK_USER, MOCK_WALLET } from "./_mocks";
import type { DevAccount, DevLoginResult } from "./api/auth";

registerMocks([
  // ── account ──────────────────────────────────────────────────────────────
  { method: "GET", pattern: "/me", handler: () => mockDelay(MOCK_USER) },
  {
    method: "PATCH",
    pattern: "/me",
    handler: ({ body }) =>
      mockDelay({
        ...MOCK_USER,
        ...((body ?? {}) as Partial<AepUser>),
        updatedAt: new Date().toISOString(),
      }),
  },
  { method: "GET", pattern: "/me/tenants", handler: () => mockDelay(MOCK_TENANTS) },
  { method: "GET", pattern: "/me/wallet", handler: () => mockDelay(MOCK_WALLET) },
  { method: "GET", pattern: "/me/ledger", handler: () => mockDelay([]) },

  // ── auth ────────────────────────────────────────────────────────────────
  // activate / devLogin 的 setAuthToken 副作用仍在 api/auth.ts 内执行；
  // 这里 handler 只返回 result，但为了让 dev 模式能直接登录，token 也写一下。
  {
    method: "POST",
    pattern: "/auth/activate",
    handler: ({ body }) => {
      const req = body as LicenseRedeemRequest;
      const now = new Date().toISOString();
      const token = `mock-activate-${Date.now()}`;
      setAuthToken(token);
      const studio = {
        id: `s-${req.username}`,
        ownerUserId: MOCK_USER.id,
        name: req.studioName,
        kind: req.studioKind ?? "personal_creator",
        status: "active" as const,
        bio: "",
        contactEmail: req.email,
        contactPhone: req.phone,
        createdAt: now,
        updatedAt: now,
      };
      const user: AepUser = {
        ...MOCK_USER,
        username: req.username,
        displayName: req.displayName || req.studioName,
        email: req.email ?? MOCK_USER.email,
        phone: req.phone ?? MOCK_USER.phone,
        updatedAt: now,
        lastLoginAt: now,
        studio,
      };
      return mockDelay<LicenseRedeemResult>({
        token,
        user,
        studio,
        tenantId: `t-${studio.id}`,
      });
    },
  },
  {
    method: "GET",
    pattern: "/auth/dev-accounts",
    handler: () =>
      mockDelay<DevAccount[]>([
        { username: "studio_starlight", displayName: "星光经纪", studioName: "星光工作室", studioKind: "agency" },
        { username: "agency_moonrise", displayName: "月升经纪", studioName: "月升传媒", studioKind: "mcn" },
      ]),
  },
  {
    method: "POST",
    pattern: "/auth/dev-login",
    handler: ({ body }) => {
      const username = (body as { username?: string } | undefined)?.username;
      const token = "mock-dev-token";
      setAuthToken(token);
      const user: AepUser = username
        ? { ...MOCK_USER, username, displayName: username }
        : MOCK_USER;
      return mockDelay<DevLoginResult>({ token, user });
    },
  },
]);
