// ─────────────────────────────────────────────────────────────────────────────
// _mocks.ts — api-client 内置的最小 mock 数据。
// 给 NEXT_PUBLIC_USE_MOCK=1 的 dev 体验用：没有后端也能跑通 dev-login + AuthProvider
// 初始化 + 工作台基础数据（user/wallet）。业务领域 mock 仍在各 web app 的 src/api 层。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@ai-star-eco/types/account";
import type { RechargePackage, Wallet } from "@ai-star-eco/types/wallet";

const NOW = "2026-05-12T00:00:00Z";

// 充值套餐的「单一真值」= admin 后端配置（RechargePackage 实体，运营在财务控制台维护）。
// 后端不再播种 seed —— 上线后充值套餐纯靠后台配置。本表仅用于 USE_MOCK=1 的「无后端 dev
// 体验」：给一组示例套餐让钱包页可演示；真模式（USE_MOCK=0）一律走后端 /me/wallet/packages，
// 不读此表。含赠送积分 bonusCredits；appScope 全为 "all"，sourceApp 过滤后各子应用都可见。
export const DEFAULT_RECHARGE_PACKAGES: RechargePackage[] = [
  { id: "pkg-300", credits: 300, priceCents: 9_900, tag: "体验包", recommended: false, bonusCredits: 0, sortOrder: 10, appScope: "all" },
  { id: "pkg-1000", credits: 1_000, priceCents: 29_900, tag: "标准包", recommended: true, bonusCredits: 100, sortOrder: 20, appScope: "all" },
  { id: "pkg-3000", credits: 3_000, priceCents: 79_900, tag: "热门包", recommended: false, bonusCredits: 500, sortOrder: 30, appScope: "all" },
  { id: "pkg-10000", credits: 10_000, priceCents: 239_900, tag: "企业包", recommended: false, bonusCredits: 2_000, sortOrder: 40, appScope: "all" },
];

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
