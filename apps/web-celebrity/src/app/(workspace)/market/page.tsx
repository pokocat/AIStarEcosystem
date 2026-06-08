"use client";

// v0.34+: 链路接通 —— 优先调 /api/celebrity/stars（admin 后台 CRUD 的明星出现在用户端）。
// USE_MOCK=1 走 mocks/MARKET_STARS；USE_MOCK=0 拉真 API。
// listStars() 已封装该开关（apps/web-celebrity/src/api/celebrity-zone.ts L40-65）。

import * as React from "react";
import { CelebrityMarketHero } from "@/components/celebrity-zone/CelebrityMarketHero";
import { CelebrityMarket } from "@/components/celebrity-zone/CelebrityMarket";
import { listStars } from "@/api/celebrity-zone";
import { ZONE_OVERVIEW } from "@/mocks/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function CelebrityMarketPage() {
  const [stars, setStars] = React.useState<CelebrityStar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listStars();
      setStars(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listStars();
        if (!cancelled) setStars(list);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <CelebrityMarketHero
        totalPlays={ZONE_OVERVIEW.hero.totalPlays}
        totalConversions={ZONE_OVERVIEW.hero.totalConversions}
        activeStars={stars.length}
      />
      {loadError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          明星数据加载失败：{loadError}
        </div>
      )}
      {loading && (
        <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">
          明星数据加载中...
        </div>
      )}
      <CelebrityMarket stars={stars} onChanged={reload} />
    </div>
  );
}
