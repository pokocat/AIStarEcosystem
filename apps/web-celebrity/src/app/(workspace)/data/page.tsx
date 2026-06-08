"use client";

// 数据中心（v0.56）：去除写死的模拟经营数据，改为按用户真实资产派生。
// 明星榜按真实生成视频数聚合；播放 / 转化 / GMV / 周趋势 / 渠道占比 没有真实埋点来源，
// 一律展示「暂无数据」诚实空态，待平台回传打通后再填真值（不再用固化假数字）。

import * as React from "react";
import { CelebrityDataCenter } from "@/components/celebrity-zone/CelebrityDataCenter";
import { listStars, listAllVideos } from "@/api/celebrity-zone";
import { MARKET_STARS, PROJECT_VIDEOS_MAP } from "@/mocks/celebrity-zone";
import type {
  CelebrityProjectVideo,
  CelebrityStar,
  CelebrityZoneOverview,
} from "@ai-star-eco/types/celebrity-zone";

function buildOverview(stars: CelebrityStar[], videos: CelebrityProjectVideo[]): CelebrityZoneOverview {
  const activeStars = stars.filter((s) => s.authorization?.status === "authorized").length;

  // 明星榜：按真实生成视频数聚合（plays / gmv 无真实来源 → 占位 —）。
  const byStar = new Map<string, { starId: string; name: string; avatar: string; videoCount: number }>();
  for (const v of videos) {
    const key = v.starId || v.starName;
    const cur = byStar.get(key);
    if (cur) {
      cur.videoCount += 1;
    } else {
      const star = stars.find((s) => s.id === v.starId);
      byStar.set(key, {
        starId: v.starId || key,
        name: v.starName,
        avatar: star?.avatar ?? "",
        videoCount: 1,
      });
    }
  }
  const starLeaderboard = Array.from(byStar.values())
    .sort((a, b) => b.videoCount - a.videoCount)
    .slice(0, 8)
    .map((r) => ({ ...r, plays: "—", gmv: "—" }));

  return {
    hero: { totalPlays: "—", totalConversions: "—", activeStars },
    starLeaderboard,
    weeklyTrend: [],
    channelMix: [],
  };
}

export default function CelebrityDataPage() {
  const fallbackVideos = React.useMemo<CelebrityProjectVideo[]>(
    () => Object.values(PROJECT_VIDEOS_MAP).flat(),
    [],
  );
  const [stars, setStars] = React.useState<CelebrityStar[]>(MARKET_STARS);
  const [videos, setVideos] = React.useState<CelebrityProjectVideo[]>(fallbackVideos);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, v] = await Promise.all([listStars(), listAllVideos()]);
        if (cancelled) return;
        if (s.length > 0) setStars(s);
        if (v.length > 0) setVideos(v);
      } catch {
        // 保留 fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overview = React.useMemo(() => buildOverview(stars, videos), [stars, videos]);
  return <CelebrityDataCenter overview={overview} />;
}
