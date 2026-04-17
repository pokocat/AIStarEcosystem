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

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  desc: string;
  /** 相对时间文案，如 "2min" / "1h" / "1d" */
  time: string;
  read: boolean;
}
