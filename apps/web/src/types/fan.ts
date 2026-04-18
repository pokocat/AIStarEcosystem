// ─────────────────────────────────────────────────────────────────────────────
// fan.ts — 粉丝端业务（艺人卡片 / 热播歌曲 / NFT 市场 / 粉丝档案）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate, Rarity } from "./_shared";

export type FanTab = "home" | "charts" | "market" | "profile";

export interface FanArtist {
  id: ID;
  name: string;
  /** emoji 图标，代表艺人类型（歌手 / 舞者 / 综艺 等） */
  type: string;
  avatar: string;
  /** 预格式化的粉丝数展示，如 "162K" */
  fans: string;
  trending: boolean;
  tags: string[];
}

export interface TrackItem {
  id: ID;
  title: string;
  artist: string;
  /** emoji 封面占位 */
  cover: string;
  /** 预格式化的播放量展示，如 "1.2M" */
  plays: string;
  /** 预格式化的时长展示，如 "3:42" */
  duration: string;
  liked: boolean;
}

export interface NFTItem {
  id: ID;
  name: string;
  artist: string;
  /** emoji 预览占位 */
  preview: string;
  /** 预格式化的价格展示，如 "0.05 ETH" */
  price: string;
  rarity: Rarity;
  holders: number;
}

export interface FanProfile {
  name: string;
  level: number;
  exp: number;
  maxExp: number;
  badges: number;
  nfts: number;
  following: number;
  /** 预格式化的总收听次数展示 */
  totalListens: string;
  joinDate: ISODate;
}
