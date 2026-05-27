"use client";

// v0.34+: 链路接通 —— 优先调 /api/celebrity/stars（admin 后台 CRUD 的明星出现在用户端）。
// USE_MOCK=1 走 mocks/MARKET_STARS；USE_MOCK=0 拉真 API。
// listStars() 已封装该开关（apps/web-celebrity/src/api/celebrity-zone.ts L40-65）。

import * as React from "react";
import { CelebrityMarketHero } from "@/components/celebrity-zone/CelebrityMarketHero";
import { CelebrityMarket } from "@/components/celebrity-zone/CelebrityMarket";
import { listStars } from "@/api/celebrity-zone";
import { MARKET_STARS, ZONE_OVERVIEW } from "@/mocks/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function CelebrityMarketPage() {
  const [stars, setStars] = React.useState<CelebrityStar[]>(MARKET_STARS);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listStars();
        if (!cancelled && list.length > 0) setStars(list);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载失败");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <CelebrityMarketHero
        totalPlays={ZONE_OVERVIEW.hero.totalPlays}
        totalConversions={ZONE_OVERVIEW.hero.totalConversions}
        activeStars={ZONE_OVERVIEW.hero.activeStars}
      />
      {loadError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          明星数据加载失败：{loadError}（已回退到本地占位数据）
        </div>
      )}
      <CelebrityMarket stars={stars} />
    </div>
  );
}
