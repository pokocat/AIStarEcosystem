// ─────────────────────────────────────────────────────────────────────────────
// tracks.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

import type { SingerQuality } from "@/types/contracts/singers";

// ── Enums ────────────────────────────────────────────────────────────────────

/** 统一小写，与后端存储值一致 */
export type TrackStatus = "draft" | "processing" | "published";

export type ChartTrend = "up" | "down" | "same";

/**
 * 音乐生成模式
 * text=文本, melody=旋律, advanced=进阶, interactive=互动写歌,
 * lyrics=歌词成歌, inspiration=灵感写歌, image=图片成歌,
 * remix=热歌爆改, fun=趣味写歌, acrostic=藏头歌, gift=送Ta歌
 */
export type GenerationMode =
  | "text"
  | "melody"
  | "advanced"
  | "interactive"
  | "lyrics"
  | "inspiration"
  | "image"
  | "remix"
  | "fun"
  | "acrostic"
  | "gift";

export type GenerationStage =
  | "analyzing"   // 分析参数
  | "composing"   // 作曲中
  | "arranging"   // 编曲中
  | "mixing"      // 混音中
  | "mastering"   // 母带处理
  | "finalizing"; // 生成完成

// ── 2.7 Track ────────────────────────────────────────────────────────────────

/** 歌词行（含可选时长） */
export interface TrackLyricLine {
  time: number;          // 时间偏移（秒），单调递增
  text: string;          // 歌词内容，最长 200 字符
  duration?: number;     // 该行时长（秒）
}

/** 曲目完整数据 */
export interface Track {
  id: string;
  producerId: string;
  singerId: string | null;
  title: string;
  audioUrl: string | null;
  coverUrl: string | null;
  generationMode: GenerationMode;
  prompt: string | null;
  style: string | null;
  bpm: number | null;      // 40–240
  key: string | null;      // 如 "C", "Am", "F#"
  durationSec: number;     // 30–600
  lyrics: TrackLyricLine[] | null;
  status: TrackStatus;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 列表摘要视图 */
export interface TrackSummary {
  id: string;
  title: string;
  style: string;
  durationSec: number;
  status: TrackStatus;
  createdAt: string;
  playCount: number;
}

// ── 2.8 TrackGeneration ──────────────────────────────────────────────────────

/**
 * 音乐生成请求——包含所有模式的专有参数。
 * 各字段仅在对应 mode 下必填，其余置 null。
 */
export interface TrackGenerationRequest {
  singerId?: string | null;
  mode: GenerationMode;
  title?: string | null;
  prompt: string;
  style?: string | null;
  durationSec: number;      // 30–600，默认 120
  // 进阶模式专有
  bpm?: number | null;
  key?: string | null;
  songStructure?: string | null;
  mood?: string | null;
  instruments?: string | null;
  // 歌词成歌
  lyricsText?: string | null;
  // 旋律模式
  melodyFileUrl?: string | null;
  // 图片成歌
  referenceImageUrl?: string | null;
  // 热歌爆改
  originalSongRef?: string | null;
  remixTarget?: string | null;
  // 藏头歌（acrosticWord 最多8字）
  acrosticWord?: string | null;
  acrosticTopic?: string | null;
  // 送Ta歌
  giftTo?: string | null;
  giftOccasion?: string | null;
  giftMessage?: string | null;
  // 趣味写歌
  funTheme?: string | null;
  corePhrase?: string | null;
}

/** 音乐生成任务状态（轮询响应） */
export interface TrackGenerationResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;              // 0–100
  currentStage: GenerationStage;
  track: Track | null;           // 生成完成后返回完整曲目
  errorMessage: string | null;
  estimatedSeconds: number | null;
}

// ── 2.20 ChartEntry ──────────────────────────────────────────────────────────

export interface ChartEntry {
  id: string;
  chartId: string;
  trackId: string;
  singerId: string;
  title: string;
  artistName: string;
  coverUrl: string;
  votes: number;
  trend: ChartTrend;
  rank: number;
  prevRank: number | null;
  updatedAt: string;
}

export interface VoteRecord {
  id: string;
  chartEntryId: string;
  userId: string;
  votedAt: string;
}

// ── Discovery / Recommendations (UI-only, 不写入DB) ─────────────────────────

export interface DiscoverySpotlight {
  badge: string;
  title: string;
  artist: string;
  coverUrl: string;
  subtitle: string;
}

export interface RecommendationTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

// ── Workspace payload ────────────────────────────────────────────────────────

export interface TrackWorkspacePayload {
  tracks: TrackSummary[];
  chartEntries: ChartEntry[];
  lyrics: TrackLyricLine[];
  discoverySpotlight: DiscoverySpotlight;
  recommendations: RecommendationTrack[];
  generationStages: GenerationStage[];
}
