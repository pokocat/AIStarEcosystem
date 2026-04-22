// ─────────────────────────────────────────────────────────────────────────────
// notification.ts — 通知 / 消息中心。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "./_shared";

export type NotificationType =
  | "revenue"       // 收益到账
  | "fan"           // 粉丝相关
  | "content"       // 内容审核 / 发布
  | "system"        // 系统维护 / 公告
  | "achievement";  // 成就 / 里程碑

/** 推送对象类型 —— 与后端 aep_notifications.audience_scope 对齐 */
export type NotificationAudienceScope =
  | "all"        // 全体用户（系统公告）
  | "studio"     // 指定经纪公司 / 工作室
  | "artist"     // 指定艺人（含其粉丝）
  | "account";   // 指定个人账户

export interface NotificationAudience {
  scope: NotificationAudienceScope;
  /** 目标实体 ID（scope=all 时忽略） */
  targetId?: ID;
  /** 目标展示名称（用于列表直接呈现，避免前端二次查询） */
  targetName?: string;
}

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  desc: string;
  /** 相对时间文案，如 "2min" / "1h" / "1d" */
  time: string;
  read: boolean;
  /** 推送对象。运营管理员建新消息时必填。 */
  audience: NotificationAudience;
}
