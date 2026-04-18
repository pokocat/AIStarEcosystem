// ─────────────────────────────────────────────────────────────────────────────
// music.ts — 音乐业务（歌曲 / 专辑 / 演唱会 / 曲风）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type SongStatus = "recording" | "mixing" | "released";
export type AlbumStatus = "planning" | "recording" | "released";
export type ConcertStatus = "planning" | "selling" | "completed";

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
}

export interface Album {
  id: ID;
  name: string;
  cover: string;
  trackCount: number;
  status: AlbumStatus;
  sales: number;
  revenue: number;
}

export interface Concert {
  id: ID;
  name: string;
  venue: string;
  date: ISODateTime;
  ticketPrice: number;
  capacity: number;
  soldTickets: number;
  status: ConcertStatus;
  revenue: number;
}

export interface MusicGenre {
  id: string;
  name: string;
  icon: string;
  color: string;
}
