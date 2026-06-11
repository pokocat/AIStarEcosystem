// ─────────────────────────────────────────────────────────────────────────────
// account.ts — 平台账号 (AepUser) 与机构归属 (Tenant / Membership)。
// 与后端 com.aistareco.aep.model.{AepUser, Tenant, Membership} 对齐。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { Studio } from "./studio";

// ── 账号 ──────────────────────────────────────────────────────────────────────

export type AccountKind = "personal" | "studio";
export type AccountStatus = "active" | "suspended" | "deleted";
/**
 * v0.43+: 子产品（web app）。一个账号可被授予其中若干个的访问权（access 隔离）。
 * 开发阶段「一处注册多端可用」即授予全部子产品。
 * v0.53+: aiavatar（数字人资产平台）纳入全集；秘钥批次可按子产品收窄激活范围。
 * v0.60+: star（明星商务工作台）纳入全集 —— 明星 / 经纪团队专属端。
 * 注：命名为 SubProduct 以区别于 distribution.ts 的 Platform（分发渠道，如抖音/B站）。
 */
export type SubProduct = "music" | "drama" | "celebrity" | "aiavatar" | "star";
export const ALL_SUB_PRODUCTS: readonly SubProduct[] = ["music", "drama", "celebrity", "aiavatar", "star"];
export const SUB_PRODUCT_LABEL_ZH: Record<SubProduct, string> = {
  music: "AI 音乐人",
  drama: "AI 短剧",
  celebrity: "AI 明星带货",
  aiavatar: "数字人资产平台",
  star: "明星商务工作台",
};
/**
 * v0.31+: 内嵌运营角色（celebrity 等用户子产品内的「平台运营人员」标记）。
 * 与 admin 后台的 AdminUser 体系**独立**；这里只用于让运营在用户视角下也能做
 * 部分管理动作（例：在 web-celebrity 界面管理公共商品池）。
 * 非空时 server 在签发 JWT 时会用此值作为 role claim，从而通过 /api/admin/**
 * 的 hasAnyRole 门禁。
 */
export type OperatorRole = "operator" | "super_admin";

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
  /** v0.31+: 内嵌运营角色；null/undefined = 非运营。详见 OperatorRole 注释。 */
  operatorRole?: OperatorRole | null;
  /**
   * v0.43+: 可访问的子产品。后端 /api/me 返回；空配置时后端回落为全集。
   * 各子产品 workspace 布局按 `platforms.includes(本子产品)` 决定是否放行。
   */
  platforms?: SubProduct[];
  emailVerified: boolean;
  phoneVerified: boolean;
  /** 是否已设置手机号密码登录的密码；后端不会返回 passwordHash。 */
  hasPassword: boolean;
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
