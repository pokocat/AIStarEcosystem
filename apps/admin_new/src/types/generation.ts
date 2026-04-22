// ─────────────────────────────────────────────────────────────────────────────
// types/generation.ts — AI 生成工作流（admin 审计 / 配置视角）。
// 与 apps/web/src/types/generation.ts 对齐；admin 额外附加 userId / artistId 便于审计。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { ThinkDepth } from "./music";

export type GenerationStage =
  | "idle"
  | "analyzing"
  | "composing"
  | "lyrics"
  | "arranging"
  | "mastering"
  | "done"
  | "error";

export type StreamStage = Exclude<GenerationStage, "idle" | "done" | "error">;

export type GenerationRole = "user" | "assistant";

export interface GenerationMessage {
  id: ID;
  role: GenerationRole;
  content: string;
  stage?: StreamStage;
  createdAt: ISODateTime;
}

export interface GeneratedMusicDraft {
  title: string;
  genre: string;
  duration: number;
  lyrics: string;
  coverPrompt: string;
  bpm: number;
  key: string;
  modelVersion: string;
  thinkDepth: ThinkDepth;
  creditsEstimate: number;
}

/**
 * admin 视角的一次生成记录（对应未来后端 GenerationJob 实体）。
 * 比 web 侧多 userId / artistId / promptRaw / status 字段，用于后台审计 / 风控。
 */
export interface GenerationJob {
  id: ID;
  userId: ID;
  artistId: ID;
  artistName: string;
  prompt: string;
  modelVersion: string;
  thinkDepth: ThinkDepth;
  creditsSpent: number;
  draft?: GeneratedMusicDraft;
  /** 是否最终落库为 Song */
  accepted: boolean;
  /** 落库后对应的 Song.id */
  resultSongId?: ID;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
  status: "running" | "done" | "aborted" | "error";
}
