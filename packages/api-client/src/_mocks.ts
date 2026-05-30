// ─────────────────────────────────────────────────────────────────────────────
// _mocks.ts — api-client 内置的最小 mock 数据。
// 给 NEXT_PUBLIC_USE_MOCK=1 的 dev 体验用：没有后端也能跑通 dev-login + AuthProvider
// 初始化 + 工作台基础数据（user/wallet）。业务领域 mock 仍在各 web app 的 src/api 层。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@ai-star-eco/types/account";
import type { Wallet } from "@ai-star-eco/types/wallet";

const NOW = "2026-05-12T00:00:00Z";

export const MOCK_USER: AepUser = {
  id: "u-mock-001",
  username: "studio_starlight",
  email: "ops@starlight.io",
  phone: "+8613800000001",
  displayName: "星光工作室",
  avatarUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=starlight",
  kind: "studio",
  status: "active",
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
