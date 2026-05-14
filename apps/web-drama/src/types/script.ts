// ─────────────────────────────────────────────────────────────────────────────
// types/script.ts — 脚本工坊本地类型。
// TODO: 后端落地后上推到 packages/types。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "@ai-star-eco/types/_shared";

export type ScriptKind = "drama" | "ad" | "trailer" | "voice";
export type ScriptStatus = "draft" | "review" | "approved" | "archived";

export interface ScriptVersion {
  id: ID;
  scriptId: ID;
  version: number;
  content: string;
  authorName: string;
  /** AI 续写时为 true */
  aiAssisted: boolean;
  createdAt: ISODateTime;
  note?: string;
}

export interface Script {
  id: ID;
  title: string;
  kind: ScriptKind;
  status: ScriptStatus;
  series?: string;
  episode?: string;
  /** 关联 drama id */
  dramaId?: ID;
  /** 当前激活版本 id */
  currentVersionId: ID;
  progress: number;
  suggestion?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  authorName: string;
}
