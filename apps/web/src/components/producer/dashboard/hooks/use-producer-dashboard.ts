"use client";

// ─────────────────────────────────────────────────────────────────────────────
// use-producer-dashboard.ts
// 经纪大盘 / 艺人视图 共用的数据 hook。集中三份 API 调用：
//   - ArtistsApi.listArtists   → 当前 studio 签约艺人（驱动 sidebar + KPI 聚合 + 艺人视图）
//   - MusicApi.listSongs       → 工坊 / 近期作品 / 艺人作品过滤
//   - FinanceApi.getMonthlyRevenue → 收入趋势 + MoM
//
// 说明：通知 / 钱包 是 app shell 级别（顶栏气泡 / 未读徽标），继续由
// ProducerDashboard 自己的 useEffect 拉取，不放进本 hook。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { ArtistsApi, MusicApi, FinanceApi } from "@/api";
import type { Artist } from "@/types/artist";
import type { Song } from "@/types/music";
import type { MonthlyRevenuePoint } from "@/types/finance";

export interface ProducerDashboardData {
  artists: Artist[];
  songs: Song[];
  monthlyRevenue: MonthlyRevenuePoint[];
  /** 艺人列表是否仍在加载（决定 sidebar 切换器 / noArtistState） */
  artistsLoading: boolean;
  /** songs + monthlyRevenue 是否仍在加载（决定 overview skeleton） */
  dataLoading: boolean;
}

export function useProducerDashboard(userId?: string): ProducerDashboardData {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenuePoint[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setArtistsLoading(true);
    ArtistsApi.listArtists()
      .then(list => { if (!cancelled) setArtists(list); })
      .catch(() => { /* 静默失败，保持空列表 */ })
      .finally(() => { if (!cancelled) setArtistsLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    Promise.allSettled([MusicApi.listSongs(), FinanceApi.getMonthlyRevenue()])
      .then(([songsRes, revRes]) => {
        if (cancelled) return;
        if (songsRes.status === "fulfilled") setSongs(songsRes.value);
        if (revRes.status === "fulfilled") setMonthlyRevenue(revRes.value);
      })
      .finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return { artists, songs, monthlyRevenue, artistsLoading, dataLoading };
}
