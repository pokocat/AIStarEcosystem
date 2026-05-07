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

// ── v0.4：AI Bot 同事会话（小程序 chat 页消费） ──────────────────────────────

/** Bot 元数据 */
export interface BotMeta {
  id: ID;
  name: string;
  /** 角色文案，如 "创作官 · 在线" */
  subtitle: string;
  /** 头像背景色（含 # 的 hex） */
  avatarColor: string;
  /** 头像内的图标字符（如 ✦ ✓ ★ 📊 ◯） */
  avatarIcon: string;
  /** 头像内图标的颜色（含 # 的 hex） */
  iconColor: string;
}

/** 会话消息块类型 */
export type ChatMessageType =
  | "time"        // 居中时间分隔条
  | "text"        // Bot 纯文本气泡（左侧带头像）
  | "card-cta"    // 富 CTA 卡片
  | "card-form"   // 表单卡片（资质待完善等）
  | "card-grid"   // 2×N 权益/数据网格
  | "user-text";  // 用户发出（右对齐）

/** 卡片高亮内嵌块 */
export interface ChatHighlight {
  /** 图标字符 */
  icon: string;
  title: string;
  sub: string;
}

/** 表单字段行 */
export interface ChatFormField {
  label: string;
  value: string;
}

/** 状态 chip（待完善 / 已完成 / 进行中等） */
export interface ChatTag {
  text: string;
  /** 视觉色调 */
  tone: "warn" | "info" | "success" | "danger" | "default";
}

/** 网格 cell */
export interface ChatGridItem {
  icon: string;
  label: string;
  sub: string;
}

/** 卡片 CTA */
export interface ChatCta {
  text: string;
  /** 点击后跳转路由（站内） */
  route?: string;
}

/**
 * 单条聊天消息（discriminated union — 服务端用 NON_NULL 序列化避免噪声字段）
 *
 * 各 type 的字段使用规范：
 *   - time:       { type, text }
 *   - text:       { type, text }
 *   - user-text:  { type, text }
 *   - card-cta:   { type, title, body, [accent], [highlight], [cta] }
 *   - card-form:  { type, title, [tag], fields, [cta] }
 *   - card-grid:  { type, title, [sub], items, [cta] }
 */
export interface ChatMessage {
  type: ChatMessageType;
  /** 文本内容（time / text / user-text 用） */
  text?: string;
  /** 是否高亮（card-cta 用，左侧加霓虹绿条） */
  accent?: boolean;
  /** 卡片标题 */
  title?: string;
  /** 卡片正文 */
  body?: string;
  /** 卡片副标题（card-grid 用） */
  sub?: string;
  /** 高亮内嵌块（card-cta 用） */
  highlight?: ChatHighlight;
  /** 状态 chip（card-form 用） */
  tag?: ChatTag;
  /** 表单字段（card-form 用） */
  fields?: ChatFormField[];
  /** 网格项目（card-grid 用） */
  items?: ChatGridItem[];
  /** 主操作 CTA */
  cta?: ChatCta;
}

/** Bot 会话详情：单 Bot 的多消息对话流 */
export interface BotConversation {
  bot: BotMeta;
  messages: ChatMessage[];
}
