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

// ── 互动（like / follow） ────────────────────────────────────────────────────
// ⚠️ TODO(Phase-2): fan_likes / fan_follows 关系表未落库。
// 本期这 4 个 mutation 仅本地 / mock 生效；FanApp UI 顶部有 Banner 提示。
// 待关系表建出后，替换为真实 apiFetch 并移除本段注释。

export async function likeTrack(trackId: string): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/fan/me/liked-tracks/${encodeURIComponent(trackId)}`, {
    method: "POST",
  });
}

export async function unlikeTrack(trackId: string): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/fan/me/liked-tracks/${encodeURIComponent(trackId)}`, {
    method: "DELETE",
  });
}

export async function followArtist(artistId: string): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/fan/me/followed-artists/${encodeURIComponent(artistId)}`, {
    method: "POST",
  });
}

export async function unfollowArtist(artistId: string): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/fan/me/followed-artists/${encodeURIComponent(artistId)}`, {
    method: "DELETE",
  });
}
