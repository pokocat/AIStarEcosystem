// ─────────────────────────────────────────────────────────────────────────────
// music.ts — 音乐业务（歌曲 / 歌单 / 演唱会 / 曲风）。
// 见 product_spec.md §10：AI 歌曲必须绑定 artistId（DigitalIp），Album 降级为
// "AI 歌手歌单"（无销售 / 无生命周期），Concert 暂保留最简骨架。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type SongStatus = "recording" | "mixing" | "released";
export type ConcertStatus = "planning" | "selling" | "completed";

/** 生成深度档位；配合 modelVersion 查工作流计费配置。 */
export type ThinkDepth = "fast" | "standard" | "deep";

export interface Song {
  id: ID;
  title: string;
  genre: string;
  /** 秒数 */
  duration: number;
  status: SongStatus;
  plays: number;
  revenue: number;
  rating: number;
  releaseDate?: ISODateTime;

  // ── 10.2 新增字段 ─────────────────────────────────────────────────────────
  /** 演唱歌手 = DigitalIp.id；Song 必须绑定一位 AI 艺人，对接发行平台时即为"歌手" */
  artistId: ID;
  /** 音频资源地址；MVP 为 mock 占位 URL，后续迁 OSS */
  audioUrl?: string;
  /** 封面；没有时前端用 artist.avatar 合成占位 */
  coverUrl?: string;
  /** 歌词正文（MVP 纯文本；LRC 时间轴版留待 P2） */
  lyrics?: string;
  /** 生成模型版本（如 "suno-v3"），由 admin 工作流计费下发 */
  modelVersion?: string;
  /** 生成深度档位 */
  thinkDepth?: ThinkDepth;
  /** 本次生成实际扣费（credits 原始值），由后端创建时写入 */
  creditsSpent?: number;
  /** 创建时间 */
  createdAt?: ISODateTime;
}

/**
 * Album = "AI 歌手歌单 / 合集"。
 * 见 product_spec.md §10.4：数字音乐无实体专辑，无"发行"生命周期，无销售字段。
 */
export interface Album {
  id: ID;
  name: string;
  cover: string;
  /** 所属 AI 艺人 */
  artistId: ID;
  /** 收录歌曲 id 顺序（即歌单曲序） */
  trackIds: ID[];
  createdAt?: ISODateTime;
}

/**
 * Concert = 线上直播活动（最简骨架）。
 * 见 product_spec.md §10.5：MVP 仅保留 id/name/artistIds/date/status/streamUrl，
 * 不做票价 / 容量 / 售票 / 推广等深度功能。
 */
export interface Concert {
  id: ID;
  name: string;
  /** 参演 AI 艺人 ID 列表 */
  artistIds: ID[];
  date: ISODateTime;
  status: ConcertStatus;
  /** 线上直播链接 */
  streamUrl?: string;
}

export interface MusicGenre {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// ── 创作请求 / 响应 ──────────────────────────────────────────────────────────

/** 创建歌曲的请求载荷。artistId 必填；扣费由后端按 modelVersion + thinkDepth 查表 */
export interface CreateSongRequest {
  artistId: ID;
  title: string;
  genre: string;
  duration?: number;
  lyrics?: string;
  modelVersion?: string;
  thinkDepth?: ThinkDepth;
  /** 创作 prompt（AI 生成参考） */
  prompt?: string;
}

/** 近 30 天音乐业务趋势点。用于概览折线图。 */
export interface MusicTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  /** 当日累计播放 */
  plays: number;
  /** 当日累计收入（credits） */
  revenue: number;
}
