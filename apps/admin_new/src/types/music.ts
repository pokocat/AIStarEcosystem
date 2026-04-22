// ─────────────────────────────────────────────────────────────────────────────
// music.ts — 音乐业务（歌曲 / 歌单 / 演唱会 / 曲风）。admin 端。
// 与 apps/web/src/types/music.ts 的关系：
//   - Song / ThinkDepth / CreateSongRequest 字段完全一致
//   - Album / Concert 保留了遗留字段（标记 @deprecated），用于 admin 现存
//     "专辑审核 / 演唱会审核" 页面的过渡。product_spec.md §10.4/§10.5 下线后
//     在 P1 迁移这些页面到"歌单运营 / 线上直播管理"时一并删除。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type SongStatus = "recording" | "mixing" | "released";
export type ThinkDepth = "fast" | "standard" | "deep";

/** @deprecated Album 无发布生命周期，保留仅供过渡页面。 */
export type AlbumStatus = "planning" | "recording" | "released";

export type ConcertStatus = "planning" | "selling" | "completed";

export interface Song {
  id: ID;
  title: string;
  genre: string;
  duration: number;
  status: SongStatus;
  plays: number;
  revenue: number;
  rating: number;
  releaseDate?: ISODateTime;

  // ── product_spec.md §10.2 新增字段 ────────────────────────────────────────
  artistId: ID;
  audioUrl?: string;
  coverUrl?: string;
  lyrics?: string;
  modelVersion?: string;
  thinkDepth?: ThinkDepth;
  creditsSpent?: number;
  createdAt?: ISODateTime;

  // ── admin 扩展：用于"审核视图"关联上下文 ────────────────────────────────
  studioId?: ID;
  /** 艺人名（admin 列表便利字段，由后端 enrich 填充） */
  artistName?: string;
  /** 工作室名（admin 列表便利字段，由后端 enrich 填充） */
  studioName?: string;
  description?: string;
}

/**
 * Album = AI 歌手歌单 / 合集（见 product_spec.md §10.4）。
 * 新的规范字段：artistId + trackIds；旧字段仅为过渡保留。
 */
export interface Album {
  id: ID;
  name: string;
  cover: string;

  /** 所属 AI 艺人（新） */
  artistId: ID;
  /** 收录歌曲顺序（新） */
  trackIds: ID[];
  createdAt?: ISODateTime;

  // ── 遗留字段（@deprecated；P1 迁"歌单运营"页面后删除） ─────────────────
  /** @deprecated 由 trackIds.length 派生 */
  trackCount?: number;
  /** @deprecated Album 无发布生命周期 */
  status?: AlbumStatus;
  /** @deprecated 数字音乐无销售 */
  sales?: number;
  /** @deprecated 收入应从歌曲聚合 */
  revenue?: number;
}

/**
 * Concert = 线上直播活动（product_spec.md §10.5）。
 * 新的规范字段只需 id/name/artistIds/date/status/streamUrl；
 * 旧字段保留给 admin 过渡页面。
 */
export interface Concert {
  id: ID;
  name: string;
  date: ISODateTime;
  status: ConcertStatus;

  /** 参演 AI 艺人 ID 列表（新） */
  artistIds: ID[];
  /** 线上直播链接（新） */
  streamUrl?: string;

  // ── 遗留字段（@deprecated；P1 迁"线上直播管理"后删除） ───────────────
  /** @deprecated 数字音乐无线下场馆 */
  venue?: string;
  /** @deprecated 无票务 */
  ticketPrice?: number;
  /** @deprecated 无票务 */
  capacity?: number;
  /** @deprecated 无票务 */
  soldTickets?: number;
  /** @deprecated 收入从歌曲聚合 */
  revenue?: number;
}

export interface MusicGenre {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface CreateSongRequest {
  artistId: ID;
  title: string;
  genre: string;
  duration?: number;
  lyrics?: string;
  modelVersion?: string;
  thinkDepth?: ThinkDepth;
  prompt?: string;
}
