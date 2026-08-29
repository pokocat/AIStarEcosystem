"use client";

// v0.37+：生成工作台改为 client + getStar API（替代 STAR_DETAIL_MAP mocks）。
// 守卫：未授权 / 待审核 / 已过期均拦截回明星详情页，避免直接拼 URL 越过授权；
//      只有 authorized 状态可进入工作台。
// `?jobId=` 透传给 workspace，用于深链恢复正在进行 / 已完成的任务（来自顶部 PendingJobsBadge）。

import * as React from "react";
import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { CelebrityGenerationWorkspace } from "@/components/celebrity-zone/CelebrityGenerationWorkspace";
import { getStar } from "@/api/celebrity-zone";
import { USE_MOCK } from "@/api/_client";
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

  // v0.132 §8.0：明星形象生成尚无真实视频引擎，live 模式此前会「真扣积分 + 前端假成片」。
  // 真实引擎接入前 live 一律拦截为「能力建设中」；演示流程仅 USE_MOCK=1 开放且全程带演示标。
  if (!USE_MOCK) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <Clapperboard className="mx-auto h-10 w-10 text-zinc-300" />
        <h1 className="mt-3 text-base font-semibold text-zinc-800">明星形象生成 · 能力建设中</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          真实生成引擎接入中，上线后在此开放。现在可以用「脚本带货视频」或「模板混剪」真实出片。
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Link href="/generate" className="rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700">去生成中心</Link>
          <Link href={`/star/${starId}`} className="text-zinc-500 hover:text-violet-600">返回明星详情</Link>
        </div>
      </div>
    );
  }
  if (star === undefined) {
    return <div className="px-6 py-16 text-sm text-zinc-500">加载中…</div>;
  }
  if (star === null) {
    notFound();
  }
  return <CelebrityGenerationWorkspace starId={starId!} star={star} jobId={jobId} />;
}
