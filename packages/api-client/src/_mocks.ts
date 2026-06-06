// ─────────────────────────────────────────────────────────────────────────────
// _mocks.ts — api-client 内置的最小 mock 数据。
// 给 NEXT_PUBLIC_USE_MOCK=1 的 dev 体验用：没有后端也能跑通 dev-login + AuthProvider
// 初始化 + 工作台基础数据（user/wallet）。业务领域 mock 仍在各 web app 的 src/api 层。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, SubProduct, Tenant } from "@ai-star-eco/types/account";
import type { Wallet } from "@ai-star-eco/types/wallet";

const NOW = "2026-05-12T00:00:00Z";
const ALL_MOCK_PLATFORMS: SubProduct[] = ["music", "drama", "celebrity"];

export const MOCK_USER: AepUser = {
  id: "u-mock-001",
  username: "studio_starlight",
  email: "ops@starlight.io",
  phone: "+8613800000001",
  displayName: "星光工作室",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=starlight",
  kind: "studio",
  status: "active",
  operatorRole: null,
  platforms: ALL_MOCK_PLATFORMS,
  emailVerified: true,
  phoneVerified: true,
  hasPassword: true,
  langPreference: "zh",
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: NOW,
  lastLoginAt: NOW,
  studio: {
    id: "s-starlight",
    ownerUserId: "u-mock-001",
    name: "星光工作室",
    kind: "agency",
    status: "active",
    bio: "mock 数据 — 用于无后端 dev 体验。",
    contactEmail: "ops@starlight.io",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: NOW,
  },
};

export const MOCK_AGENCY_USER: AepUser = {
  ...MOCK_USER,
  id: "u-mock-002",
  username: "agency_moonrise",
  email: "ops@moonrise.io",
  phone: "+8613800000002",
  displayName: "月升经纪",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=moonrise",
  studio: {
    id: "s-moonrise",
    ownerUserId: "u-mock-002",
    name: "月升传媒",
    kind: "mcn",
    status: "active",
    bio: "mock 数据 — MCN 机构账号。",
    contactEmail: "ops@moonrise.io",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: NOW,
  },
};

export const MOCK_OPERATOR_USER: AepUser = {
  ...MOCK_USER,
  id: "u-mock-operator",
  username: "celebrity_operator",
  email: "operator@celebrity.local",
  phone: "+8613800000003",
  displayName: "平台运营",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=celebrity-operator",
  operatorRole: "operator",
  studio: {
    id: "s-celebrity-operator",
    ownerUserId: "u-mock-operator",
    name: "平台运营账号",
    kind: "agency",
    status: "active",
    bio: "mock 数据 — 用于验证运营可见菜单和编辑权限。",
    contactEmail: "operator@celebrity.local",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: NOW,
  },
};

export const MOCK_SUPER_ADMIN_USER: AepUser = {
  ...MOCK_USER,
  id: "u-mock-super-admin",
  username: "celebrity_super_admin",
  email: "super-admin@celebrity.local",
  phone: "+8613800000004",
  displayName: "平台超管",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=celebrity-super-admin",
  operatorRole: "super_admin",
  studio: {
    id: "s-celebrity-super-admin",
    ownerUserId: "u-mock-super-admin",
    name: "平台超管账号",
    kind: "agency",
    status: "active",
    bio: "mock 数据 — 用于验证超管可见菜单和编辑权限。",
    contactEmail: "super-admin@celebrity.local",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: NOW,
  },
};

export const MOCK_DEV_USERS: AepUser[] = [
  MOCK_USER,
  MOCK_AGENCY_USER,
  MOCK_OPERATOR_USER,
  MOCK_SUPER_ADMIN_USER,
];

const MOCK_DEV_TOKEN_PREFIX = "mock-dev-token:";
const MOCK_DEV_USER_BY_USERNAME = new Map(MOCK_DEV_USERS.map((user) => [user.username, user]));

export function mockUserForUsername(username?: string | null): AepUser {
  const normalized = username?.trim();
  if (!normalized) return MOCK_USER;
  const known = MOCK_DEV_USER_BY_USERNAME.get(normalized);
  if (known) return known;

  const slug = normalized.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "custom";
  const id = `u-mock-${slug}`;
  return {
    ...MOCK_USER,
    id,
    username: normalized,
    email: `${slug}@example.local`,
    displayName: normalized,
    operatorRole: null,
    studio: {
      ...MOCK_USER.studio!,
      id: `s-${slug}`,
      ownerUserId: id,
      name: normalized,
      contactEmail: `${slug}@example.local`,
      updatedAt: NOW,
    },
  };
}

export function mockDevTokenForUsername(username?: string | null): string {
  return `${MOCK_DEV_TOKEN_PREFIX}${encodeURIComponent(username?.trim() || MOCK_USER.username)}`;
}

export function mockUserForToken(token?: string | null): AepUser {
  if (token?.startsWith(MOCK_DEV_TOKEN_PREFIX)) {
    return mockUserForUsername(decodeURIComponent(token.slice(MOCK_DEV_TOKEN_PREFIX.length)));
  }
  return MOCK_USER;
}

export const MOCK_TENANTS: Tenant[] = [
  {
    id: "t-platform",
    name: "AI Star Eco 平台",
    kind: "platform",
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: NOW,
  },
  {
    id: "t-starlight",
    name: "星光工作室",
    kind: "organization",
    status: "active",
    createdAt: "2025-09-12T08:10:00Z",
    updatedAt: NOW,
  },
];

export const MOCK_WALLET: Wallet = {
  id: "w-mock-001",
  userId: "u-mock-001",
  totalBalance: 88_000,
  licenseBalance: 50_000,
  rechargeBalance: 30_000,
  giftBalance: 8_000,
  pendingBalance: 0,
  createdAt: "2025-09-12T08:10:00Z",
  updatedAt: NOW,
};
