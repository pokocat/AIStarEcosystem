// ─────────────────────────────────────────────────────────────────────────────
// mocks/account.ts — 当前登录用户 & 所属租户样本（web 端）。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Studio, Tenant } from "@ai-star-eco/types/account";

/** 当前登录用户（取第一个工作室账号）。 */
export const CURRENT_USER: AepUser = {
  id: "u-001",
  username: "skywave_studio",
  email: "ops@skywave.io",
  phone: "+8613800000001",
  displayName: "星浪工作室",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=skywave",
  walletAddress: "0xA1b2...8f32",
  kind: "studio",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
  langPreference: "zh",
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: "2026-04-10T11:22:00Z",
  lastLoginAt: "2026-04-17T02:18:00Z",
  studio: {
    id: "s-skywave",
    ownerUserId: "u-001",
    name: "星浪工作室",
    kind: "agency",
    status: "active",
    bio: "专注 AI 虚拟艺人孵化与跨端发行。",
    contactEmail: "ops@skywave.io",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: "2026-04-10T11:22:00Z",
  } satisfies Studio,
};

/** 当前用户可见的租户列表。 */
export const MY_TENANTS: Tenant[] = [
  { id: "t-platform", name: "AI Star Eco 平台", kind: "platform",     status: "active", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-04-01T00:00:00Z" },
  { id: "t-skywave",  name: "星浪工作室",       kind: "organization", status: "active", createdAt: "2025-09-12T08:10:00Z", updatedAt: "2026-04-01T00:00:00Z" },
];
