"use client";

// v0.37+：申请授权页改为 client + getStar API（与详情页同源）。

import * as React from "react";
import { notFound, useParams } from "next/navigation";
import { CelebrityApplyForm } from "@/components/celebrity-zone/CelebrityApplyForm";
import { getStar } from "@/api/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function StarApplyPage() {
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
  return <CelebrityApplyForm star={star} />;
}
