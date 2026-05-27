"use client";

// v0.37+：明星详情改为 client + getStar API（替代 STAR_DETAIL_MAP mocks）。
// USE_MOCK=1 时 getStar 回退 mocks；USE_MOCK=0 时拉真后端 → 与 /market 数据源一致。

import * as React from "react";
import { notFound, useParams } from "next/navigation";
import { CelebrityStarDetail } from "@/components/celebrity-zone/CelebrityStarDetail";
import { getStar } from "@/api/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function StarDetailPage() {
  const params = useParams<{ starId: string }>();
  const starId = params?.starId;
  const [star, setStar] = React.useState<CelebrityStar | null | undefined>(undefined);

  React.useEffect(() => {
    if (!starId) return;
    let cancelled = false;
    (async () => {
      const s = await getStar(starId).catch(() => null);
      if (!cancelled) setStar(s);
    })();
    return () => { cancelled = true; };
  }, [starId]);

  if (star === undefined) {
    return <div className="px-6 py-16 text-sm text-zinc-500">加载中…</div>;
  }
  if (star === null) {
    notFound();
  }
  return <CelebrityStarDetail star={star} />;
}
