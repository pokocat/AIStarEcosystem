// ─────────────────────────────────────────────────────────────────────────────
// account.ts — 平台账号 (AepUser) 与机构归属 (Tenant / Membership)。
// 与 apps/web_new/src/types/account.ts 及后端 com.aistareco.aep.model.* 对齐。
// 见 product_spec.md §1.2 / §1.5。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 账号 ──────────────────────────────────────────────────────────────────────

export type AccountKind = "personal" | "studio";
export type AccountStatus = "active" | "suspended" | "deleted";

export interface AepUser {
  id: ID;
  username: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  kind: AccountKind;
  status: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  langPreference: "zh" | "en";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt?: ISODateTime;
}

// ── 机构归属（仅用于 License 核销统计） ──────────────────────────────────────

export type TenantKind = "platform" | "personal" | "organization";
export type TenantStatus = "active" | "suspended" | "deleted";

export interface Tenant {
  id: ID;
  name: string;
  kind: TenantKind;
  status: TenantStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type MembershipSource =
  | "license_activation"
  | "self_register"
  | "admin_invite";

export interface Membership {
  id: ID;
  userId: ID;
  tenantId: ID;
  source: MembershipSource;
  licenseKeyId?: ID;
  joinedAt: ISODateTime;
}
