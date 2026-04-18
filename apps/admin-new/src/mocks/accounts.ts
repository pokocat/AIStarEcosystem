// ─────────────────────────────────────────────────────────────────────────────
// mocks/accounts.ts — AepUser / Tenant / Membership 样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant, Membership } from "@/types/account";

export const ACCOUNTS: AepUser[] = [
  {
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
  },
  {
    id: "u-002",
    username: "nebula_mcn",
    email: "biz@nebula-mcn.cn",
    displayName: "星云 MCN",
    kind: "studio",
    status: "active",
    emailVerified: true,
    phoneVerified: false,
    langPreference: "zh",
    createdAt: "2025-11-02T03:40:00Z",
    updatedAt: "2026-04-16T09:20:00Z",
    lastLoginAt: "2026-04-16T15:02:00Z",
  },
  {
    id: "u-003",
    username: "fan_yuki",
    email: "yuki@mail.com",
    displayName: "粉丝 · 雪音",
    kind: "personal",
    status: "active",
    emailVerified: true,
    phoneVerified: false,
    langPreference: "zh",
    createdAt: "2026-01-22T12:01:00Z",
    updatedAt: "2026-04-15T18:44:00Z",
    lastLoginAt: "2026-04-17T01:09:00Z",
  },
  {
    id: "u-004",
    username: "drama_lab",
    email: "contact@dramalab.studio",
    displayName: "短剧实验室",
    kind: "studio",
    status: "suspended",
    emailVerified: true,
    phoneVerified: true,
    langPreference: "zh",
    createdAt: "2025-07-05T02:00:00Z",
    updatedAt: "2026-03-29T10:15:00Z",
    lastLoginAt: "2026-03-20T07:30:00Z",
  },
  {
    id: "u-005",
    username: "solo_creator_moka",
    displayName: "摩卡（个人创作者）",
    kind: "studio",
    status: "active",
    emailVerified: false,
    phoneVerified: true,
    langPreference: "zh",
    createdAt: "2026-02-11T09:20:00Z",
    updatedAt: "2026-04-14T03:55:00Z",
  },
];

export const TENANTS: Tenant[] = [
  { id: "t-platform", name: "AI Star Eco 平台", kind: "platform", status: "active", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-04-01T00:00:00Z" },
  { id: "t-personal", name: "个人账号池",         kind: "personal", status: "active", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-04-01T00:00:00Z" },
  { id: "t-skywave",  name: "星浪工作室",         kind: "organization", status: "active", createdAt: "2025-09-12T08:10:00Z", updatedAt: "2026-04-01T00:00:00Z" },
  { id: "t-nebula",   name: "星云 MCN",           kind: "organization", status: "active", createdAt: "2025-11-02T03:40:00Z", updatedAt: "2026-04-01T00:00:00Z" },
  { id: "t-dramalab", name: "短剧实验室",         kind: "organization", status: "suspended", createdAt: "2025-07-05T02:00:00Z", updatedAt: "2026-03-29T10:15:00Z" },
];

export const MEMBERSHIPS: Membership[] = [
  { id: "m-1", userId: "u-001", tenantId: "t-skywave",  source: "self_register",       joinedAt: "2025-09-12T08:10:00Z" },
  { id: "m-2", userId: "u-002", tenantId: "t-nebula",   source: "admin_invite",        joinedAt: "2025-11-02T03:40:00Z" },
  { id: "m-3", userId: "u-003", tenantId: "t-personal", source: "license_activation",  licenseKeyId: "lk-10032", joinedAt: "2026-01-22T12:01:00Z" },
  { id: "m-4", userId: "u-004", tenantId: "t-dramalab", source: "self_register",       joinedAt: "2025-07-05T02:00:00Z" },
  { id: "m-5", userId: "u-005", tenantId: "t-personal", source: "license_activation",  licenseKeyId: "lk-10088", joinedAt: "2026-02-11T09:20:00Z" },
];
