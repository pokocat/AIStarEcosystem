// ─────────────────────────────────────────────────────────────────────────────
// api/fan.ts — 粉丝端（发现 / 排行 / NFT 市场 / 个人中心）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { FanArtist, TrackItem, NFTItem, FanProfile } from "@/types/fan";
import {
  TrendingArtists,
  HotTracks,
  NFTMarket,
  DefaultFanProfile,
  DefaultLikedTrackIds,
  DefaultFollowedArtistIds,
} from "@/mocks/fan";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listTrendingArtists(): Promise<FanArtist[]> {
  if (USE_MOCK) return mockDelay(TrendingArtists);
  return apiFetch<FanArtist[]>("/fan/trending-artists");
}

export async function listHotTracks(): Promise<TrackItem[]> {
  if (USE_MOCK) return mockDelay(HotTracks);
  return apiFetch<TrackItem[]>("/fan/hot-tracks");
}

export async function listNFTMarket(): Promise<NFTItem[]> {
  if (USE_MOCK) return mockDelay(NFTMarket);
  return apiFetch<NFTItem[]>("/fan/nft-market");
}

export async function getMyFanProfile(): Promise<FanProfile> {
  if (USE_MOCK) return mockDelay(DefaultFanProfile);
  return apiFetch<FanProfile>("/fan/me");
}

export async function getMyLikedTrackIds(): Promise<string[]> {
  if (USE_MOCK) return mockDelay(DefaultLikedTrackIds);
  return apiFetch<string[]>("/fan/me/liked-tracks");
}

export async function getMyFollowedArtistIds(): Promise<string[]> {
  if (USE_MOCK) return mockDelay(DefaultFollowedArtistIds);
  return apiFetch<string[]>("/fan/me/followed-artists");
}
