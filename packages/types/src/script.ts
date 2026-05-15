// ─────────────────────────────────────────────────────────────────────────────
// script.ts — 脚本工坊（drama 端发起，server DTO 待落地）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

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
