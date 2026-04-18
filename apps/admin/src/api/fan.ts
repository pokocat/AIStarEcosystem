// ─────────────────────────────────────────────────────────────────────────────
// api/fan.ts — 粉丝端管理 API。
// ─────────────────────────────────────────────────────────────────────────────

import type { FanArtist, TrackItem, NFTItem, FanProfile } from "@/types/fan";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  TrendingArtists,
  HotTracks,
  NFTMarket,
  DefaultFanProfile,
} from "@/mocks/fan";

export async function listTrendingArtists(): Promise<FanArtist[]> {
  if (USE_MOCK) return mockDelay(TrendingArtists);
  return apiFetch<FanArtist[]>("/admin/fan/trending-artists");
}

export async function listHotTracks(): Promise<TrackItem[]> {
  if (USE_MOCK) return mockDelay(HotTracks);
  return apiFetch<TrackItem[]>("/admin/fan/hot-tracks");
}

export async function listNFTMarket(): Promise<NFTItem[]> {
  if (USE_MOCK) return mockDelay(NFTMarket);
  return apiFetch<NFTItem[]>("/admin/fan/nft-market");
}

export async function getFanOverview(): Promise<FanProfile> {
  if (USE_MOCK) return mockDelay(DefaultFanProfile);
  return apiFetch<FanProfile>("/admin/fan/overview");
}
