// ─────────────────────────────────────────────────────────────────────────────
// account.ts — 平台账号 (AepUser) 与机构归属 (Tenant / Membership)。
// 与 apps/web_new/src/types/account.ts 及后端 com.aistareco.aep.model.* 对齐。
// 见 product_spec.md §1.2 / §1.5。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 账号 ──────────────────────────────────────────────────────────────────────

export type AccountKind = "personal" | "studio";
export type AccountStatus = "active" | "suspended" | "deleted";
/**
 * v0.31+: 内嵌运营角色（celebrity 等用户子产品的「平台运营人员」标记）。
 * 与 admin 后台的 AdminUser 体系**独立**；这里只用于让运营在用户视角下也能做
 * 部分管理动作（如在 web-celebrity 界面内管理公共商品池）。
 */
export type OperatorRole = "operator" | "super_admin";

export interface AepUser {
  id: ID;
  username: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  bio?: string;
  kind: AccountKind;
  status: AccountStatus;
  /** v0.31+: 内嵌运营角色；null = 普通账号。 */
  operatorRole?: OperatorRole | null;
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

// ── 管理员账号（后台运营人员）────────────────────────────────────────────────
// 对应后端 AdminUserDto / admin_users 表
// AdminRole 与 server 的 com.aistareco.aep.model.AdminUser.AdminRole 严格大小写对齐：
//   SUPER_ADMIN  - 超级管理员（全功能）
//   OPERATOR     - 平台运营（CRUD 业务数据，但不能编辑账号 / 权限）

export type AdminRole = "SUPER_ADMIN" | "OPERATOR";
export type AdminStatus = "active" | "suspended";

export interface AdminUser {
  id: ID;
  username: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt?: ISODateTime;
}
