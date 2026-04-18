// ─────────────────────────────────────────────────────────────────────────────
// film.ts — 影视业务（短剧 / 电影 / 广告 / 配音）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type DramaStatus = "casting" | "filming" | "post-production" | "released";
export type MovieStatus = "pre-production" | "filming" | "post-production" | "released";
export type MovieRole = "lead" | "supporting" | "cameo";
export type AdType = "TVC" | "digital" | "print" | "social";
export type AdStatus = "negotiating" | "shooting" | "completed";
export type VoiceWorkType = "animation" | "documentary" | "audiobook" | "game";
export type VoiceWorkStatus = "recording" | "editing" | "delivered";

export interface Drama {
  id: ID;
  title: string;
  genre: string;
  episodes: number;
  role: string;
  status: DramaStatus;
  views: number;
  revenue: number;
  rating: number;
  releaseDate?: ISODateTime;
}

export interface Movie {
  id: ID;
  title: string;
  genre: string;
  role: MovieRole;
  status: MovieStatus;
  boxOffice: number;
  revenue: number;
  rating: number;
}

export interface Advertisement {
  id: ID;
  brand: string;
  product: string;
  type: AdType;
  /** 时长（秒） */
  duration: number;
  status: AdStatus;
  payment: number;
  views: number;
}

export interface VoiceWork {
  id: ID;
  project: string;
  type: VoiceWorkType;
  /** 时长（分钟） */
  duration: number;
  status: VoiceWorkStatus;
  payment: number;
}
