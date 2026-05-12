// ─────────────────────────────────────────────────────────────────────────────
// types/generation.ts — AI 生成工作流（创作工坊 LLM Playground）。
// 首版仅覆盖"音乐生成"；后续影视剧本 / 综艺大纲 / 舞蹈编排等都会复用 stage / message 结构。
// 一次 run = 一个 Job：prompt + stage 序列 + 最终 draft。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { ThinkDepth } from "./music";

export type GenerationStage =
  | "idle"
  | "analyzing"    // 解析主题 / 受众
  | "composing"    // 构建旋律结构
  | "lyrics"       // 撰写歌词
  | "arranging"    // 编曲 / 乐器选择
  | "mastering"    // 母带整合
  | "done"
  | "error";

/** 可流式输出的中间阶段（idle/done/error 除外）。 */
export type StreamStage = Exclude<GenerationStage, "idle" | "done" | "error">;

export type GenerationRole = "user" | "assistant";

/** 对话气泡。assistant 消息按 stage 分组，每段一个 bubble。 */
export interface GenerationMessage {
  id: ID;
  role: GenerationRole;
  content: string;
  stage?: StreamStage;
  createdAt: ISODateTime;
}

/** 生成完成后的结构化产物 —— 音乐场景。 */
export interface GeneratedMusicDraft {
  title: string;
  genre: string;
  duration: number;          // 秒
  lyrics: string;            // \n 分隔
  coverPrompt: string;       // 真实后端会据此调图像模型
  bpm: number;
  key: string;               // e.g. "A minor"
  modelVersion: string;
  thinkDepth: ThinkDepth;
  creditsEstimate: number;
}

export interface GenerationRequest {
  artistId: ID;
  prompt: string;
  modelVersion?: string;
  thinkDepth?: ThinkDepth;
}

export interface GenerationResult {
  jobId: ID;
  draft: GeneratedMusicDraft;
  messages: GenerationMessage[];
  completedAt: ISODateTime;
}
