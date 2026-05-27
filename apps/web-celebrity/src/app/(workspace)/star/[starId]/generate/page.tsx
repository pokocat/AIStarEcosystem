"use client";

// v0.37+：生成工作台改为 client + getStar API（替代 STAR_DETAIL_MAP mocks）。
// 守卫：未授权 / 待审核 / 已过期均拦截回明星详情页，避免直接拼 URL 越过授权；
//      只有 authorized 状态可进入工作台。
// `?jobId=` 透传给 workspace，用于深链恢复正在进行 / 已完成的任务（来自顶部 PendingJobsBadge）。

import * as React from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { CelebrityGenerationWorkspace } from "@/components/celebrity-zone/CelebrityGenerationWorkspace";
import { getStar } from "@/api/celebrity-zone";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

export default function StarGeneratePage() {
  const params = useParams<{ starId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const starId = params?.starId;
  const jobId = searchParams?.get("jobId") ?? undefined;
  const [star, setStar] = React.useState<CelebrityStar | null | undefined>(undefined);

  React.useEffect(() => {
    if (!starId) return;
    let cancelled = false;
    (async () => {
      const s = await getStar(starId).catch(() => null);
      if (cancelled) return;
      if (s && s.authorization?.status !== "authorized") {
        router.replace(`/star/${starId}`);
        return;
      }
      setStar(s);
    })();
    return () => { cancelled = true; };
  }, [starId, router]);

  if (star === undefined) {
    return <div className="px-6 py-16 text-sm text-zinc-500">加载中…</div>;
  }
  if (star === null) {
    notFound();
  }
  return <CelebrityGenerationWorkspace starId={starId!} jobId={jobId} />;
}
