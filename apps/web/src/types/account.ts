// ─────────────────────────────────────────────────────────────────────────────
// account.ts — 平台账号 (AepUser) 与机构归属 (Tenant / Membership)。
// 与后端 com.aistareco.aep.model.{AepUser, Tenant, Membership} 对齐。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 账号 ──────────────────────────────────────────────────────────────────────

export type AccountKind = "personal" | "studio";
export type AccountStatus = "active" | "suspended" | "deleted";

export interface AepUser {
  id: ID;
  username: string;             // 唯一登录名
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;       // 链上地址（可选）
  kind: AccountKind;            // personal=粉丝/普通用户; studio=工作室运营者
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
  licenseKeyId?: ID;             // 经 License 入会时的 key 引用
  joinedAt: ISODateTime;
}
