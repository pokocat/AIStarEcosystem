// ─────────────────────────────────────────────────────────────────────────────
// account.ts — 平台账号 (AepUser) 与机构归属 (Tenant / Membership)。
// 与后端 com.aistareco.aep.model.{AepUser, Tenant, Membership} 对齐。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { Studio } from "./studio";

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
  bio?: string;                 // 用户自填简介
  kind: AccountKind;            // personal=粉丝/普通用户; studio=工作室运营者
  status: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  langPreference: "zh" | "en";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt?: ISODateTime;
  /**
   * 当前用户名下的经纪公司/工作室档案（后端 GET /api/me 返回）。
   * 服务端逻辑：Studio.ownerUserId == AepUser.id（1:1），无则为 null。
   */
  studio?: Studio | null;
}

// 经纪公司 / 工作室档案类型：见 ./studio.ts。在此仅 re-export 便于组件从
// "@/types/account" 同时拿到 AepUser 与其关联的 Studio 摘要。
export type { Studio, StudioKind, StudioStatus } from "./studio";
export { STUDIO_KIND_LABEL_ZH } from "./studio";

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
